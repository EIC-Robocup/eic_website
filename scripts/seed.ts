/**
 * Load supabase/seed.sql (the club's first content) into DATABASE_URL.
 *
 *   node scripts/seed.ts           refuses if the projects table already has rows
 *   node scripts/seed.ts --force   runs anyway; rows that already exist are left alone
 *
 * The seed is idempotent (fixed ids, `on conflict do nothing`) and runs in one
 * transaction, so a failure changes nothing. Run the migrations first.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postgres from 'postgres';

const root = resolve(import.meta.dirname, '..');
const seedFile = join(root, 'supabase', 'seed.sql');
const force = process.argv.includes('--force');

if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const url = process.env.DATABASE_URL?.trim();
if (!url) {
	console.error('DATABASE_URL is not set. Put it in .env or pass it in the environment.');
	console.error('For a local database: export DATABASE_URL="$(scripts/local-db.sh url)"');
	process.exit(1);
}

const TABLES = [
	'teams',
	'people',
	'projects',
	'posts',
	'publications',
	'achievements',
	'archive_photos',
	'sponsors'
] as const;

/**
 * TLS for every host but this machine, like the app's own client (src/lib/server/db/index.ts):
 * postgres.js sends everything in plain text unless asked, and the Supabase connection strings
 * carry no sslmode. An sslmode in the URL (e.g. verify-full) or PGSSLMODE still wins.
 */
function sslFor(connection: string): false | 'require' | undefined {
	let parsed: URL;
	try {
		parsed = new URL(connection);
	} catch {
		return 'require';
	}
	if (parsed.searchParams.has('sslmode') || parsed.searchParams.has('ssl') || process.env.PGSSLMODE) return undefined;
	return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname) ? false : 'require';
}

// max: 1 lets the file's own begin/commit run on a single connection.
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15, ssl: sslFor(url), onnotice: () => {} });

async function counts(): Promise<Record<string, number>> {
	const out: Record<string, number> = {};
	for (const table of TABLES) {
		const [row] = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(table)}`;
		out[table] = row.n;
	}
	return out;
}

async function main() {
	const [ready] = await sql<{ ok: boolean }[]>`select to_regclass('public.projects') is not null as ok`;
	if (!ready.ok) {
		console.error('The tables do not exist yet. Run the migrations first: node scripts/migrate.ts');
		process.exitCode = 1;
		return;
	}

	const [{ n: existing }] = await sql<{ n: number }[]>`select count(*)::int as n from projects`;
	if (existing > 0 && !force) {
		console.error(
			`The projects table already has ${existing} row(s), so this database looks seeded.\n` +
				'Run with --force to load the seed anyway (existing rows are kept, missing ones are added).'
		);
		process.exitCode = 1;
		return;
	}

	const before = await counts();
	const text = readFileSync(seedFile, 'utf8');
	try {
		await sql.unsafe(text);
	} catch (err) {
		// The file opens its own transaction; make sure it is closed before we leave.
		await sql.unsafe('rollback').catch(() => {});
		throw err;
	}
	const after = await counts();

	console.log('Seeded from supabase/seed.sql');
	const width = Math.max(...TABLES.map((t) => t.length));
	for (const table of TABLES) {
		const added = after[table] - before[table];
		console.log(`  ${table.padEnd(width)}  ${String(after[table]).padStart(3)} rows  (+${added})`);
	}
}

try {
	await main();
} catch (err) {
	const e = err as { message?: string; detail?: string; hint?: string };
	console.error(`Seed failed: ${e.message ?? err}`);
	if (e.detail) console.error(`  detail: ${e.detail}`);
	if (e.hint) console.error(`  hint:   ${e.hint}`);
	console.error('Nothing was changed.');
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 5 });
}
