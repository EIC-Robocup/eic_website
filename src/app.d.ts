// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionEditor } from '#lib/server/auth.js';

declare global {
	namespace App {
		/** A user whose session token was verified by Supabase. */
		interface AuthUser {
			/** Supabase auth user id (null for the local DEV_AUTH_EMAIL bypass). */
			id: string | null;
			email: string;
		}

		interface Locals {
			/** Per-request Supabase client for auth, or null when Supabase is not configured. */
			supabase: SupabaseClient | null;
			/** The verified signed-in user, cached for the request. */
			getUser(): Promise<AuthUser | null>;
			/** The invited editor on /admin routes, otherwise null. */
			editor: SessionEditor | null;
			/** Set by handleError when a load failed with a 5xx, so the answer is never cached. */
			serverError?: boolean;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
