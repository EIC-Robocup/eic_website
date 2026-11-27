import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/env';
import { ADMIN_EMAILS, DEV_AUTH_EMAIL } from '$app/env/private';
import { isInvited, normalizeEmail, safeNext } from '#lib/server/auth.ts';
import { clientLimitKey, hit, isSpent, limitKey, spend, type Limit } from '#lib/server/rate-limit.ts';
import { authConfigured, createRequestClient } from '#lib/server/supabase.ts';
import {
	completeSignIn,
	loginErrorMessage,
	rememberNext
} from '../../auth/session.server.ts';
import type { Actions, PageServerLoad } from './$types';

/** The same answer for every address, so the form never tells who is invited. */
const SENT_MESSAGE = 'If this email is invited, a sign in link is on its way.';
const RATE_LIMITED =
	'Too many sign in emails were asked for just now. Try again later, or continue with GitHub or Google.';
const TOO_SOON =
	'A sign in email was asked for this address less than a minute ago. Check your inbox, or try again in a minute.';
const TOO_MANY_CODES = 'Too many tries. Wait a few minutes, then try again.';
const NOT_CONFIGURED = 'Sign in is not set up on this site yet.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVIDERS = ['github', 'google'] as const;
type Provider = (typeof PROVIDERS)[number];

/**
 * Sign in email limits (#lib/server/rate-limit.ts), shared by every server instance. All of
 * them are checked before the invite lookup, so an over-limit request gets the same answer
 * whether or not the address is invited.
 */
const EMAIL_LIMITS = {
	/** Requests from one address (an IPv6 /64). */
	client: { max: 5, windowSeconds: 10 * 60 },
	/** Requests for one email address. */
	address: { max: 3, windowSeconds: 60 * 60 },
	/**
	 * One request per email address a minute. Supabase refuses a second email to an address
	 * within 60 seconds, so without this a quick repeat would reach Supabase only for invited
	 * addresses, and its refusal looks like the project's email limit.
	 */
	interval: { max: 1, windowSeconds: 65 },
	/**
	 * Emails the site sends in all, kept under the Supabase project's email limit (30 an hour
	 * with custom SMTP), so a flood can't use up the quota and lock every editor out. Only real
	 * sends count; Supabase refusing a send for its project email limit uses up the rest of the
	 * hour.
	 */
	sends: { max: 20, windowSeconds: 60 * 60 }
} satisfies Record<string, Limit>;

/** Code entry limits, checked before Supabase sees the code. */
const CODE_LIMITS = {
	client: { max: 10, windowSeconds: 10 * 60 },
	address: { max: 5, windowSeconds: 10 * 60 }
} satisfies Record<string, Limit>;

const SENDS_KEY = 'login-sends';

/**
 * The email action always takes at least this long, invited or not, so the response time
 * doesn't give away who gets an email. Sends slower than this (a slow SMTP server) can still
 * stand out, but the limits above leave only a few tries an hour per address.
 */
const EMAIL_RESPONSE_FLOOR_MS = 1_500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function clientAddress(getClientAddress: () => string): string {
	try {
		return getClientAddress() || 'unknown';
	} catch {
		return 'unknown';
	}
}

function readNext(form: FormData): string {
	const value = form.get('next');
	return safeNext(typeof value === 'string' ? value : null);
}

// No setHeaders here: hooks.server.ts marks every /admin response private, no-store, and the
// Supabase cookie writer may already have set cache headers for this request.
export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (locals.editor) redirect(303, next);

	// Only in `pnpm dev`: explain why the DEV_AUTH_EMAIL shortcut did not sign you in.
	let devNotice: string | null = null;
	if (dev && DEV_AUTH_EMAIL) {
		devNotice = `DEV_AUTH_EMAIL is set to ${DEV_AUTH_EMAIL}, but it did not sign you in: that email is not an invited editor, or the database is unreachable. Add it to ADMIN_EMAILS in .env, check DATABASE_URL, and reload.`;
	}

	return {
		next,
		configured: authConfigured,
		error: loginErrorMessage(url.searchParams.get('error')),
		dev,
		devNotice,
		/** In dev: ADMIN_EMAILS is empty, so nobody can sign in on a fresh database. */
		noBootstrap: dev && !ADMIN_EMAILS
	};
};

export const actions = {
	/** "Continue with GitHub / Google": start the OAuth flow and send the browser to the provider. */
	oauth: async ({ request, locals, url, cookies }) => {
		const form = await request.formData();
		const provider = String(form.get('provider') ?? '') as Provider;
		const next = readNext(form);

		if (!locals.supabase) return fail(503, { stage: 'email' as const, message: NOT_CONFIGURED });
		if (!PROVIDERS.includes(provider)) {
			return fail(400, { stage: 'email' as const, message: 'Choose GitHub or Google.' });
		}

		const { data, error } = await locals.supabase.auth.signInWithOAuth({
			provider,
			options: { redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}` }
		});
		if (error || !data?.url) {
			console.error('Could not start OAuth sign in', error);
			const name = provider === 'github' ? 'GitHub' : 'Google';
			return fail(502, {
				stage: 'email' as const,
				message: `Could not start sign in with ${name}. Check that the provider is switched on in Supabase, then try again.`
			});
		}

		rememberNext(cookies, next);
		redirect(303, data.url, { external: true });
	},

	/** "Email me a sign in link": only invited addresses get an email; everyone sees the same answer. */
	magic: async (event) => {
		const { request, locals, url, cookies, getClientAddress } = event;
		const started = performance.now();
		const form = await request.formData();
		const raw = form.get('email');
		const email = normalizeEmail(typeof raw === 'string' ? raw : '').slice(0, 320);
		const next = readNext(form);

		if (!EMAIL.test(email) || email.length > 254 || email.includes('\u0000')) {
			return fail(400, {
				stage: 'email' as const,
				email: email.replace(/\u0000/g, ''),
				message: 'Enter your email address, like name@example.com.',
				errors: { email: 'Enter a valid email address.' }
			});
		}
		if (!locals.supabase) return fail(503, { stage: 'email' as const, email, message: NOT_CONFIGURED });

		// Every limit before the invite lookup: the same refusal for every address.
		const [clientKey, addressKey, intervalKey] = await Promise.all([
			clientLimitKey('login-client', clientAddress(getClientAddress)),
			limitKey('login-email', email),
			limitKey('login-email-interval', email)
		]);
		const [clientOver, addressOver, tooSoon, sendsSpent] = await Promise.all([
			hit(clientKey, EMAIL_LIMITS.client),
			hit(addressKey, EMAIL_LIMITS.address),
			hit(intervalKey, EMAIL_LIMITS.interval),
			isSpent(SENDS_KEY, EMAIL_LIMITS.sends)
		]);
		if (clientOver || addressOver || sendsSpent) {
			return fail(429, { stage: 'email' as const, email, message: RATE_LIMITED });
		}
		if (tooSoon) return fail(429, { stage: 'email' as const, email, message: TOO_SOON });

		let invited: boolean;
		try {
			invited = await isInvited(email);
		} catch (err) {
			console.error('Could not check the invite list', err);
			return fail(503, {
				stage: 'email' as const,
				email,
				message: 'Sign in is not available right now. Try again in a minute.'
			});
		}

		rememberNext(cookies, next);
		// Uninvited addresses go through a client whose requests never leave the server, and
		// invited ones through a client that keeps its PKCE verifier cookies even when Supabase
		// refuses the email, so both answers carry the same cookies and headers.
		const client =
			createRequestClient(event, invited ? { keepVerifiersAfterSend: true } : { offline: true }) ??
			locals.supabase;
		// No query string: the email template appends ?token_hash=... to this URL.
		const { error } = await client.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: `${url.origin}/auth/confirm`, shouldCreateUser: true }
		});
		if (invited && !error) {
			await hit(SENDS_KEY, EMAIL_LIMITS.sends);
		} else if (error?.status === 429 && !/after \d+ seconds?/i.test(error.message)) {
			// Supabase's project email limit: refuse everyone until the hour is up, but answer
			// this request as usual, since only invited addresses ever reach Supabase. Its other
			// 429, "you can only request this after N seconds" (one email per address a minute),
			// is about this address only, so it is handled like any other send error below.
			console.error('Supabase refused the sign in email (rate limited)', error.code ?? error.name);
			await spend(SENDS_KEY, EMAIL_LIMITS.sends);
		} else if (error) {
			// Logged, but the answer stays the same so it says nothing about the invite list.
			console.error('Could not send the sign in email', error.code ?? error.name, error.message);
		}

		await sleep(Math.max(0, EMAIL_RESPONSE_FLOOR_MS - (performance.now() - started)));
		return { stage: 'code' as const, email, message: SENT_MESSAGE };
	},

	/** The 6 digit code from the email, for when the link can't be opened on this device. */
	verify: async (event) => {
		const { request, locals } = event;
		const form = await request.formData();
		const rawEmail = form.get('email');
		const email = normalizeEmail(typeof rawEmail === 'string' ? rawEmail : '').slice(0, 320);
		const rawCode = form.get('code');
		const token = (typeof rawCode === 'string' ? rawCode : '').replace(/\D/g, '');
		const next = readNext(form);

		if (!EMAIL.test(email) || email.includes('\u0000')) {
			return fail(400, {
				stage: 'email' as const,
				email: email.replace(/\u0000/g, ''),
				message: 'Enter your email address first.'
			});
		}
		if (token.length < 6 || token.length > 10) {
			return fail(400, {
				stage: 'code' as const,
				email,
				message: 'Enter the code from the email.',
				errors: { code: 'The code has 6 digits.' }
			});
		}
		if (!locals.supabase) return fail(503, { stage: 'code' as const, email, message: NOT_CONFIGURED });

		// Wrong codes in a burst would trip Supabase's shared verify limit for every editor.
		const [clientKey, addressKey] = await Promise.all([
			clientLimitKey('verify-client', clientAddress(event.getClientAddress)),
			limitKey('verify-email', email)
		]);
		const [clientOver, addressOver] = await Promise.all([
			hit(clientKey, CODE_LIMITS.client),
			hit(addressKey, CODE_LIMITS.address)
		]);
		if (clientOver || addressOver) {
			return fail(429, { stage: 'code' as const, email, message: TOO_MANY_CODES });
		}

		const { error } = await locals.supabase.auth.verifyOtp({ email, token, type: 'email' });
		if (error) {
			if (error.status === 429) {
				return fail(429, { stage: 'code' as const, email, message: TOO_MANY_CODES });
			}
			return fail(400, {
				stage: 'code' as const,
				email,
				message: 'That code is wrong or has expired. Check the latest email, or request a new one.',
				errors: { code: 'Wrong or expired code.' }
			});
		}

		redirect(303, await completeSignIn(event, next));
	}
} satisfies Actions;
