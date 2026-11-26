import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import type { RequestHandler } from './$types';

/**
 * Health check. Also called once a day by the Vercel cron in vercel.json: the query keeps a
 * Free plan Supabase project from pausing after a quiet week.
 */
export const GET: RequestHandler = async () => {
	let database: 'ok' | 'error' = 'ok';
	try {
		await db.execute(sql`select 1`);
	} catch (err) {
		console.error('Health check: database unreachable', err);
		database = 'error';
	}
	return Response.json(
		{ ok: database === 'ok', database },
		{ status: database === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
};
