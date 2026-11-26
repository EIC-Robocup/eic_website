import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle is the source of truth for the database schema.
 *
 * `pnpm db:generate` writes SQL migrations into supabase/migrations using the
 * Supabase file prefix (YYYYMMDDHHMMSS_name.sql), so the Supabase CLI and the
 * Supabase GitHub integration can apply them. Keep the prefix as it is: prefix
 * formats can't be mixed once migrations exist.
 *
 * DATABASE_URL is only needed for commands that talk to a database (studio, push).
 * Use the session pooler or direct connection here, not the transaction pooler.
 */
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './supabase/migrations',
	dialect: 'postgresql',
	migrations: { prefix: 'supabase' },
	...(process.env.DATABASE_URL ? { dbCredentials: { url: process.env.DATABASE_URL } } : {}),
	verbose: true,
	strict: true
});
