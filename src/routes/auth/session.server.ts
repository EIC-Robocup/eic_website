/**
 * Shared sign in plumbing for /auth/callback, /auth/confirm, /admin/login and /admin/logout.
 *
 * Every successful Supabase sign in ends in `completeSignIn`, which checks the verified email
 * against the editors table. Anyone not invited is signed out straight away, and the Supabase
 * user that sign in just created is deleted (best effort).
 */
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { eq, or } from 'drizzle-orm';
import { findEditor, markSignedIn, normalizeEmail, safeNext } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { editors } from '#lib/server/db/schema.ts';
import { getAdminClient } from '#lib/server/supabase.ts';

/** Error codes /admin/login?error= understands. */
export type LoginErrorCode =
	| 'not_invited'
	| 'link_expired'
	| 'auth_failed'
	| 'not_configured'
	| 'unavailable'
	| 'unverified';

const LOGIN_ERRORS: Record<LoginErrorCode, string> = {
	not_invited:
		'That account is not invited to the admin panel. Ask the team leader to invite the email you signed in with.',
	link_expired:
		'That sign in link has expired, was already used, or was opened in another browser. Request a new one.',
	auth_failed: 'Sign in did not go through. Try again.',
	not_configured: 'Sign in is not set up on this site yet.',
	unavailable: 'We could not check your invite just now. Try again in a minute.',
	unverified: 'That account has no verified email address. Verify it with the provider, then try again.'
};

/** The friendly message for an `?error=` code, or null for codes we don't know. */
export function loginErrorMessage(code: string | null | undefined): string | null {
	return code && Object.hasOwn(LOGIN_ERRORS, code) ? LOGIN_ERRORS[code as LoginErrorCode] : null;
}

/** `/admin/login?error=...`, keeping `next` when it isn't the dashboard. */
export function loginUrl(code?: LoginErrorCode, next?: string | null): string {
	const params = new URLSearchParams();
	if (code) params.set('error', code);
	const target = safeNext(next);
	if (target !== '/admin') params.set('next', target);
	const query = params.toString();
	return query ? `/admin/login?${query}` : '/admin/login';
}

/**
 * Where to go after sign in. Email links return to /auth/confirm without a query string (the
 * email template appends `?token_hash=...`), so the page the editor asked for travels in this
 * short lived cookie instead.
 */
export const NEXT_COOKIE = 'eic_auth_next';

export function rememberNext(cookies: Cookies, next: string): void {
	cookies.set(NEXT_COOKIE, safeNext(next), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60
	});
}

/** The remembered page (falls back to `fromUrl`), cleared once read. */
export function takeNext(cookies: Cookies, fromUrl?: string | null): string {
	const stored = cookies.get(NEXT_COOKIE);
	if (stored !== undefined) cookies.delete(NEXT_COOKIE, { path: '/' });
	return safeNext(fromUrl || stored);
}

/** Supabase auth error codes that mean "this link or code can't be used any more". */
const EXPIRED_CODES = new Set([
	'otp_expired',
	'flow_state_expired',
	'flow_state_not_found',
	'bad_code_verifier',
	'pkce_code_verifier_not_found',
	'session_not_found'
]);

/** Map a Supabase auth error (or an error redirect's `error_code`) to a login error code. */
export function authErrorCode(error: { code?: string; name?: string } | string | null | undefined): LoginErrorCode {
	const code = typeof error === 'string' ? error : (error?.code ?? '');
	if (EXPIRED_CODES.has(code)) return 'link_expired';
	if (typeof error === 'object' && error?.name === 'AuthPKCECodeVerifierMissingError') return 'link_expired';
	return 'auth_failed';
}

/**
 * Supabase sends errors back to the redirect URL as `?error=...&error_code=...` (for example
 * when a link has expired). Returns the login error code, or null when there is no error.
 */
export function errorFromRedirect(url: URL): LoginErrorCode | null {
	const errorCode = url.searchParams.get('error_code');
	const error = url.searchParams.get('error');
	if (!errorCode && !error) return null;
	if (errorCode) return authErrorCode(errorCode);
	return 'auth_failed';
}

const SESSION_COOKIE = /^sb-.+-auth-token(?:-code-verifier)?(?:\.\d+)?$/;

/**
 * Sign out of this browser's session, ignoring errors, and make sure no Supabase session
 * cookie survives even when the Auth API could not be reached.
 */
export async function signOutQuietly(event: Pick<RequestEvent, 'locals' | 'cookies'>): Promise<void> {
	const { locals, cookies } = event;
	try {
		const result = await locals.supabase?.auth.signOut({ scope: 'local' });
		if (result?.error) console.warn('Sign out returned an error', result.error.message);
	} catch (err) {
		console.warn('Sign out failed', err);
	}
	for (const { name, value } of cookies.getAll()) {
		if (value && SESSION_COOKIE.test(name)) cookies.delete(name, { path: '/' });
	}
}

/** Delete the Supabase user a refused sign in just created. Never throws. */
async function removeUninvitedUser(email: string, userId: string): Promise<void> {
	const admin = getAdminClient();
	if (!admin) return;
	try {
		// Only when nothing in the editors table points at this person.
		const [row] = await db
			.select({ id: editors.id })
			.from(editors)
			.where(or(eq(editors.email, normalizeEmail(email)), eq(editors.userId, userId)))
			.limit(1);
		if (row) return;
		const { error } = await admin.auth.admin.deleteUser(userId);
		if (error) console.warn('Could not delete the uninvited auth user', error.message);
	} catch (err) {
		console.warn('Could not delete the uninvited auth user', err);
	}
}

/**
 * Finish a sign in once Supabase has set the session cookies: check the verified email
 * against the editors table and return where to send the browser. Callers redirect:
 *
 *     redirect(303, await completeSignIn(event, next));
 *
 * Never throws for expected failures; those return a /admin/login?error= URL.
 */
export async function completeSignIn(
	event: Pick<RequestEvent, 'locals' | 'cookies'>,
	next: string | null | undefined
): Promise<string> {
	const client = event.locals.supabase;
	if (!client) return loginUrl('not_configured');

	let userId: string | undefined;
	let email: string | undefined;
	let emailVerified: unknown;
	try {
		// getClaims() verifies the new session's token; never trust getSession() on the server.
		const { data, error } = await client.auth.getClaims();
		if (error) throw error;
		userId = data?.claims?.sub;
		email = typeof data?.claims?.email === 'string' ? data.claims.email : undefined;
		const meta = data?.claims?.user_metadata as Record<string, unknown> | undefined;
		emailVerified = meta?.email_verified;
	} catch (err) {
		console.error('Could not read the new session', err);
		await signOutQuietly(event);
		return loginUrl('auth_failed', next);
	}

	if (!userId) {
		await signOutQuietly(event);
		return loginUrl('auth_failed', next);
	}
	if (!email || emailVerified === false) {
		await signOutQuietly(event);
		return loginUrl('unverified', next);
	}

	let editor: Awaited<ReturnType<typeof findEditor>>;
	try {
		editor = await findEditor(email, userId);
	} catch (err) {
		console.error('Could not look up the editor during sign in', err);
		await signOutQuietly(event);
		return loginUrl('unavailable', next);
	}

	if (!editor) {
		await signOutQuietly(event);
		await removeUninvitedUser(email, userId);
		return loginUrl('not_invited');
	}

	try {
		await markSignedIn(editor.id, userId);
	} catch (err) {
		// Not worth refusing the sign in over.
		console.error('Could not record the sign in', err);
	}
	return safeNext(next);
}
