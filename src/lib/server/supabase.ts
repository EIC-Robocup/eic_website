import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import {
	SUPABASE_ANON_KEY,
	SUPABASE_PUBLISHABLE_KEY,
	SUPABASE_SECRET_KEY,
	SUPABASE_SERVICE_ROLE_KEY,
	SUPABASE_URL
} from '$app/env/private';

const publicKey = SUPABASE_PUBLISHABLE_KEY ?? SUPABASE_ANON_KEY;
const secretKey = SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY;

/** True when sign in can work (URL and publishable key are set). */
export const authConfigured = Boolean(SUPABASE_URL && publicKey);

/** True when uploads can work (URL and secret key are set). */
export const storageConfigured = Boolean(SUPABASE_URL && secretKey);

/** Answers every request with an empty success, without leaving the server. */
const offlineFetch: typeof fetch = async () =>
	new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });

/** PKCE verifier cookies: each flow's slot, the index of flows and the fixed legacy key. */
const isVerifierCookie = (name: string) => /-code-verifier(?:\.\d+)?$/.test(name);

/** The path of a fetch call's URL, or '' when it can't be read. */
function requestPath(input: RequestInfo | URL): string {
	try {
		return new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname;
	} catch {
		return '';
	}
}

type RequestClientOptions = {
	/**
	 * A stand-in whose requests never reach Supabase but which writes the same cookies and
	 * headers. The sign in form uses it for uninvited addresses, so its answer looks the same
	 * whoever asks.
	 */
	offline?: boolean;
	/**
	 * Keep the PKCE verifier cookies once the sign in email has been asked for (`/otp`), whatever
	 * Supabase answers. When signInWithOtp fails, auth-js deletes them, which the offline
	 * stand-in never does, so a refused send would show in the Set-Cookie lines that this
	 * address is invited. A kept verifier is harmless: no email carries its flow.
	 */
	keepVerifiersAfterSend?: boolean;
};

/**
 * A Supabase client bound to this request's cookies. Used only for auth: sign in,
 * code exchange, reading the verified user, sign out. Create one per request.
 */
export function createRequestClient(
	event: RequestEvent,
	{ offline = false, keepVerifiersAfterSend = false }: RequestClientOptions = {}
): SupabaseClient | null {
	if (!SUPABASE_URL || !publicKey) return null;

	let sent = false;
	const trackedFetch: typeof fetch = async (input, init) => {
		try {
			return await fetch(input, init);
		} finally {
			if (requestPath(input).endsWith('/otp')) sent = true;
		}
	};
	const customFetch = offline ? offlineFetch : keepVerifiersAfterSend ? trackedFetch : undefined;

	return createServerClient(SUPABASE_URL, publicKey, {
		...(customFetch ? { global: { fetch: customFetch } } : {}),
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				for (const { name, value, options } of cookiesToSet) {
					if (sent && isVerifierCookie(name)) continue;
					// httpOnly: no browser code ever reads the session (there is no browser Supabase client).
					event.cookies.set(name, value, { ...options, path: '/', httpOnly: true });
				}
				// Responses that set auth cookies must never be cached.
				if (headers && Object.keys(headers).length) {
					try {
						event.setHeaders(headers);
					} catch {
						// A header was already set for this response; the no-store hook covers it.
					}
				}
			}
		}
	});
}

let admin: SupabaseClient | null | undefined;

/**
 * A Supabase client with the secret key, for Storage uploads and deleting auth users.
 * Server only. Never send its results' credentials anywhere.
 */
export function getAdminClient(): SupabaseClient | null {
	if (admin !== undefined) return admin;
	admin =
		SUPABASE_URL && secretKey
			? createClient(SUPABASE_URL, secretKey, {
					auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
				})
			: null;
	return admin;
}
