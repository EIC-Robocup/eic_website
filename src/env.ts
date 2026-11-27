import { defineEnvVars } from '@sveltejs/kit/env';

/** An optional variable: empty or unset becomes undefined. */
const optional = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

/**
 * Environment variables. Values come from `.env` locally and from the Vercel project
 * settings in production. See docs/setup-vercel.md for where each one comes from.
 *
 * Everything here is private (server only). Sign in and data go through the SvelteKit
 * server. The browser talks to Supabase Storage only to PUT an upload to a signed URL the
 * server creates (/admin/api/upload) and to load public files from the media bucket.
 */
export const variables = defineEnvVars({
	DATABASE_URL: {
		description:
			'Postgres connection string. Wins over POSTGRES_URL. On Vercel, set it only without the Supabase integration (transaction pooler, port 6543).',
		schema: optional
	},
	POSTGRES_URL: {
		description:
			'Set by the Supabase integration on Vercel. Used when DATABASE_URL is not set (e.g. on preview branches).',
		schema: optional
	},
	// Also read by vite.config.ts at build time: Vercel Image Optimization may resize only
	// this project's media bucket, and a build without it serves media photos as they are.
	SUPABASE_URL: {
		description: 'Supabase project URL, e.g. https://abcd1234.supabase.co',
		schema: optional
	},
	SUPABASE_PUBLISHABLE_KEY: {
		description: 'Supabase publishable key (sb_publishable_...). Used for sign in.',
		schema: optional
	},
	SUPABASE_ANON_KEY: {
		description:
			'Legacy Supabase anon key, used only when SUPABASE_PUBLISHABLE_KEY is not set. Legacy keys stop working at the end of 2026.',
		schema: optional
	},
	SUPABASE_SECRET_KEY: {
		description: 'Supabase secret key (sb_secret_...). Used on the server for uploads.',
		schema: optional
	},
	SUPABASE_SERVICE_ROLE_KEY: {
		description: 'Legacy Supabase service_role key. Used only when SUPABASE_SECRET_KEY is not set.',
		schema: optional
	},
	ADMIN_EMAILS: {
		description:
			'Comma separated emails that may always sign in to the admin panel and become owners on first sign in.',
		schema: optional
	},
	VERCEL_ENV: {
		description: 'Set by Vercel: production, preview or development. Unset locally.',
		static: true,
		schema: optional
	},
	DEV_AUTH_EMAIL: {
		description:
			'Local development only: treat every request as signed in with this email. Ignored in production builds.',
		schema: optional
	}
});
