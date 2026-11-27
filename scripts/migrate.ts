/**
 * Apply supabase/migrations/*.sql to DATABASE_URL, the way the Supabase CLI does.
 *
 *   node scripts/migrate.ts            apply what has not run yet
 *   node scripts/migrate.ts --dry-run  list what would run, change nothing
 *
 * Each applied file is recorded in supabase_migrations.schema_migrations
 * (version = the 14 digit prefix, name = the rest of the file name, statements =
 * the file split on drizzle's "--> statement-breakpoint"), the table the Supabase
 * CLI and the Supabase GitHub integration use. So this script, `supabase db push`
 * and the integration all agree on what has already run.
 *
 * Use a direct or session pooler connection (port 5432) for migrations where you
 * can. The transaction pooler works too: every file runs in its own transaction.
 *
 * Runs on Node 24 without a build step (type stripping); uses only postgres and
 * Node built-ins.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postgres from 'postgres';

const root = resolve(import.meta.dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const dryRun = process.argv.includes('--dry-run');

if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const url = process.env.DATABASE_URL?.trim();
if (!url) {
	console.error('DATABASE_URL is not set. Put it in .env or pass it in the environment.');
	console.error('For a local database: export DATABASE_URL="$(scripts/local-db.sh url)"');
	process.exit(1);
}

/** Same file name rule as the Supabase CLI: <timestamp>_<name>.sql */
const FILE_PATTERN = /^(\d{14})_(.+)\.sql$/;

type Migration = { file: string; version: string; name: string; sql: string; statements: string[] };

function loadMigrations(): Migration[] {
	if (!existsSync(migrationsDir)) return [];
	const out: Migration[] = [];
	for (const file of readdirSync(migrationsDir).sort()) {
		if (!file.endsWith('.sql')) continue;
		const match = FILE_PATTERN.exec(file);
		if (!match) {
			console.warn(`Skipping ${file}: the name must look like 20260101120000_name.sql`);
			continue;
		}
		const sql = readFileSync(join(migrationsDir, file), 'utf8');
		const statements = sql
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean);
		out.push({ file, version: match[1], name: match[2], sql, statements });
	}
	const seen = new Set<string>();
	for (const m of out) {
		if (seen.has(m.version)) throw new Error(`Two migrations share the version ${m.version}.`);
		seen.add(m.version);
	}
	return out;
}

/** Shown without the password. */
function describe(connection: string): string {
	try {
		const u = new URL(connection);
		return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
	} catch {
		return 'the database';
	}
}

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

const sql = postgres(url, {
	// The transaction pooler can't hold prepared statements.
	prepare: false,
	max: 1,
	connect_timeout: 15,
	ssl: sslFor(url),
	onnotice: () => {}
});

// Any fixed number: makes two runs at once wait for each other instead of racing.
const LOCK_KEY = 4_281_007;

async function ensureHistoryTable() {
	// Exactly the CLI's statements (supabase/cli pkg/migration/history.go).
	await sql.unsafe('create schema if not exists supabase_migrations');
	await sql.unsafe(
		'create table if not exists supabase_migrations.schema_migrations (version text not null primary key)'
	);
	await sql.unsafe(
		'alter table supabase_migrations.schema_migrations add column if not exists statements text[]'
	);
	await sql.unsafe('alter table supabase_migrations.schema_migrations add column if not exists name text');
}

async function appliedVersions(): Promise<Set<string>> {
	const exists = await sql<{ ok: boolean }[]>`
		select to_regclass('supabase_migrations.schema_migrations') is not null as ok`;
	if (!exists[0]?.ok) return new Set();
	const rows = await sql<{ version: string }[]>`
		select version from supabase_migrations.schema_migrations order by version`;
	return new Set(rows.map((r) => r.version));
}

async function main() {
	const migrations = loadMigrations();
	console.log(`Migrations: ${migrations.length} file(s) in supabase/migrations`);
	console.log(`Database:   ${describe(url!)}`);

	const done = await appliedVersions();
	const pending = migrations.filter((m) => !done.has(m.version));
	for (const m of migrations) {
		if (done.has(m.version)) console.log(`  skip   ${m.file} (already applied)`);
	}
	const unknown = [...done].filter((v) => !migrations.some((m) => m.version === v));
	if (unknown.length) {
		console.warn(`  note   ${unknown.length} recorded version(s) have no file here: ${unknown.join(', ')}`);
	}

	if (!pending.length) {
		console.log('Nothing to apply. The database is up to date.');
		return;
	}
	if (dryRun) {
		for (const m of pending) console.log(`  would apply ${m.file} (${m.statements.length} statements)`);
		return;
	}

	await ensureHistoryTable();

	let applied = 0;
	for (const m of pending) {
		const started = Date.now();
		const ran = await sql.begin(async (tx) => {
			await tx`select pg_advisory_xact_lock(${LOCK_KEY})`;
			// Another run may have applied it while we waited for the lock.
			const [already] = await tx`
				select 1 from supabase_migrations.schema_migrations where version = ${m.version}`;
			if (already) return false;
			// The whole file as one simple-protocol query, like psql -f.
			await tx.unsafe(m.sql);
			await tx`
				insert into supabase_migrations.schema_migrations (version, name, statements)
				values (${m.version}, ${m.name}, ${m.statements}::text[])`;
			return true;
		});
		if (ran) {
			applied += 1;
			console.log(`  apply  ${m.file} (${m.statements.length} statements, ${Date.now() - started} ms)`);
		} else {
			console.log(`  skip   ${m.file} (applied by another run)`);
		}
	}
	console.log(`Done. Applied ${applied} migration(s).`);
}

try {
	await main();
} catch (err) {
	const e = err as { message?: string; detail?: string; hint?: string; position?: string };
	console.error(`Migration failed: ${e.message ?? err}`);
	if (e.detail) console.error(`  detail: ${e.detail}`);
	if (e.hint) console.error(`  hint:   ${e.hint}`);
	console.error('The failing file was rolled back; earlier files stay applied.');
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 5 });
}
