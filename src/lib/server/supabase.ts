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

/**
 * A Supabase client bound to this request's cookies. Used only for auth: sign in,
 * code exchange, reading the verified user, sign out. Create one per request.
 *
 * `offline: true` gives a stand-in whose requests never reach Supabase but which writes the
 * same cookies and headers. The sign in form uses it for uninvited addresses, so its answer
 * looks the same whoever asks.
 */
export function createRequestClient(
	event: RequestEvent,
	{ offline = false }: { offline?: boolean } = {}
): SupabaseClient | null {
	if (!SUPABASE_URL || !publicKey) return null;
	return createServerClient(SUPABASE_URL, publicKey, {
		...(offline ? { global: { fetch: offlineFetch } } : {}),
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				for (const { name, value, options } of cookiesToSet) {
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
