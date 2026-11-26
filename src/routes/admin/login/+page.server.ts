import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/env';
import { ADMIN_EMAILS, DEV_AUTH_EMAIL, SUPABASE_URL } from '$app/env/private';
import { isInvited, normalizeEmail, safeNext } from '#lib/server/auth.ts';
import { authConfigured } from '#lib/server/supabase.ts';
import {
	completeSignIn,
	loginErrorMessage,
	rememberNext
} from '../../auth/session.server.ts';
import type { Actions, PageServerLoad } from './$types';

/** The same answer for every address, so the form never tells who is invited. */
const SENT_MESSAGE = 'If this email is invited, a sign in link is on its way.';
const RATE_LIMITED = 'Too many sign in emails were sent just now. Wait a minute, then try again.';
const NOT_CONFIGURED = 'Sign in is not set up on this site yet.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVIDERS = ['github', 'google'] as const;
type Provider = (typeof PROVIDERS)[number];

/**
 * One email per address per minute, checked before the invite lookup so invited and
 * uninvited addresses get the same answer. Per server instance; Supabase's own limits
 * still apply behind it.
 */
const recentRequests = new Map<string, number>();
const REQUEST_GAP_MS = 60_000;

function tooSoon(email: string): boolean {
	const now = Date.now();
	if (recentRequests.size > 500) {
		for (const [key, at] of recentRequests) if (now - at > REQUEST_GAP_MS) recentRequests.delete(key);
	}
	const last = recentRequests.get(email);
	if (last !== undefined && now - last < REQUEST_GAP_MS) return true;
	recentRequests.set(email, now);
	return false;
}

function readNext(form: FormData): string {
	const value = form.get('next');
	return safeNext(typeof value === 'string' ? value : null);
}

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (locals.editor) redirect(303, next);

	setHeaders({ 'cache-control': 'private, no-store' });

	// Only in `pnpm dev`: explain why the DEV_AUTH_EMAIL shortcut did not sign you in.
	let devNotice: string | null = null;
	if (dev && DEV_AUTH_EMAIL) {
		devNotice = `DEV_AUTH_EMAIL is set to ${DEV_AUTH_EMAIL}, but that email is not an invited editor. Add it to ADMIN_EMAILS in .env (or to the editors table) and reload.`;
	}

	return {
		next,
		configured: authConfigured,
		error: loginErrorMessage(url.searchParams.get('error')),
		dev,
		devNotice,
		/** Whether ADMIN_EMAILS is empty (a fresh install with nobody to let in). */
		noBootstrap: dev && !ADMIN_EMAILS,
		/** Supabase project host, shown in the setup notice in dev only. */
		supabaseHost: dev && SUPABASE_URL ? new URL(SUPABASE_URL).host : null
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
	magic: async ({ request, locals, url, cookies }) => {
		const form = await request.formData();
		const raw = form.get('email');
		const email = normalizeEmail(typeof raw === 'string' ? raw : '').slice(0, 320);
		const next = readNext(form);

		if (!EMAIL.test(email) || email.length > 254) {
			return fail(400, {
				stage: 'email' as const,
				email,
				message: 'Enter your email address, like name@example.com.',
				errors: { email: 'Enter a valid email address.' }
			});
		}
		if (!locals.supabase) return fail(503, { stage: 'email' as const, email, message: NOT_CONFIGURED });
		if (tooSoon(email)) return fail(429, { stage: 'email' as const, email, message: RATE_LIMITED });

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

		if (invited) {
			rememberNext(cookies, next);
			// No query string: the email template appends ?token_hash=... to this URL.
			const { error } = await locals.supabase.auth.signInWithOtp({
				email,
				options: { emailRedirectTo: `${url.origin}/auth/confirm`, shouldCreateUser: true }
			});
			if (error) {
				if (error.status === 429) {
					return fail(429, { stage: 'email' as const, email, message: RATE_LIMITED });
				}
				// Logged, but the answer stays the same so it says nothing about the invite list.
				console.error('Could not send the sign in email', error.code ?? error.name, error.message);
			}
		}

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

		if (!EMAIL.test(email)) {
			return fail(400, { stage: 'email' as const, email, message: 'Enter your email address first.' });
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

		const { error } = await locals.supabase.auth.verifyOtp({ email, token, type: 'email' });
		if (error) {
			if (error.status === 429) {
				return fail(429, { stage: 'code' as const, email, message: 'Too many tries. Wait a few minutes, then try again.' });
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
