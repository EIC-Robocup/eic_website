import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle is the source of truth for the database schema.
 *
 * `pnpm db:generate` writes SQL migrations into supabase/migrations using the
 * Supabase file prefix (YYYYMMDDHHMMSS_name.sql), so the Supabase CLI and the
 * Supabase GitHub integration can apply them. Keep the prefix as it is: prefix
 * formats can't be mixed once migrations exist. The meta/ folder is Drizzle's
 * journal; the Supabase CLI ignores sub-folders.
 *
 * Use drizzle-kit only to generate migrations (and for studio). Never run
 * `drizzle-kit migrate` or `drizzle-kit push` against Supabase: Supabase tracks
 * applied migrations in its own table. Apply them with the GitHub integration or
 * `pnpm db:migrate`.
 *
 * DATABASE_URL is only needed for studio. Use the session pooler (port 5432) there.
 */
const url = process.env.DATABASE_URL_SESSION ?? process.env.DATABASE_URL;

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './supabase/migrations',
	dialect: 'postgresql',
	migrations: { prefix: 'supabase' },
	schemaFilter: ['public'],
	entities: { roles: { provider: 'supabase' } },
	...(url ? { dbCredentials: { url } } : {}),
	verbose: true,
	strict: true
});
