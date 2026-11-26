import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL, POSTGRES_URL } from '$app/env/private';
import * as schema from './schema';

/**
 * The connection string: DATABASE_URL, or POSTGRES_URL as set by the Supabase
 * integration on Vercel (preview branches sync their own POSTGRES_URL).
 * Query parameters postgres.js would forward to the server as settings are dropped.
 */
export function connectionString(): string | undefined {
	const raw = DATABASE_URL ?? POSTGRES_URL;
	if (!raw) return undefined;
	try {
		const url = new URL(raw);
		for (const key of ['supa', 'pgbouncer', 'connection_limit']) url.searchParams.delete(key);
		return url.toString();
	} catch {
		return raw;
	}
}

function isLocal(url: string): boolean {
	try {
		const host = new URL(url).hostname;
		return host === 'localhost' || host === '127.0.0.1' || host === '::1';
	} catch {
		return false;
	}
}

function createDb() {
	const url = connectionString();
	if (!url) {
		throw new Error(
			'DATABASE_URL is not set. Copy .env.example to .env and fill it in (see docs/setup-supabase.md).'
		);
	}
	const client = postgres(url, {
		// The Supabase transaction pooler (port 6543) does not support prepared statements.
		prepare: false,
		// Supavisor can stall on pipelined queries in transaction mode.
		max_pipeline: 1,
		// Serverless functions should hold few connections; the pooler does the multiplexing.
		max: 5,
		idle_timeout: 20,
		connect_timeout: 10,
		query_timeout: 15,
		ssl: isLocal(url) ? false : 'require'
	});
	return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

let instance: Db | undefined;

/**
 * The Drizzle client. Created on first use so that pages which never touch the
 * database (and builds) work without DATABASE_URL.
 */
export const db: Db = new Proxy({} as Db, {
	get(_target, prop) {
		instance ??= createDb();
		const value = Reflect.get(instance, prop);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});

export { schema };
