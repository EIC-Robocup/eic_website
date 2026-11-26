import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL } from '$app/env/private';
import * as schema from './schema';

function createDb() {
	if (!DATABASE_URL) {
		throw new Error(
			'DATABASE_URL is not set. Copy .env.example to .env and fill it in (see docs/setup-supabase.md).'
		);
	}
	const client = postgres(DATABASE_URL, {
		// The Supabase transaction pooler (port 6543) does not support prepared statements.
		prepare: false,
		// Serverless functions should hold few connections; the pooler does the multiplexing.
		max: 5,
		idle_timeout: 20,
		connect_timeout: 10
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
