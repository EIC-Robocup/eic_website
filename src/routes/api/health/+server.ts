import { and, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { messages } from '#lib/server/db/schema.ts';
import { pruneRateLimits } from '#lib/server/rate-limit.ts';
import type { RequestHandler } from './$types';

/**
 * Health check. Also called once a day by the Vercel cron in vercel.json: the query keeps a
 * Free plan Supabase project from pausing after a quiet week, and the run tidies up:
 * rate limit counters older than a day are deleted, and contact messages older than a day
 * lose their hashed sender address (only the last hour is ever checked).
 */
export const GET: RequestHandler = async () => {
	let database: 'ok' | 'error' = 'ok';
	try {
		await db.execute(sql`select 1`);
	} catch (err) {
		console.error('Health check: database unreachable', err);
		database = 'error';
	}

	if (database === 'ok') {
		try {
			await Promise.all([
				pruneRateLimits(),
				db
					.update(messages)
					.set({ ipHash: null })
					.where(and(isNotNull(messages.ipHash), lt(messages.createdAt, sql`now() - interval '1 day'`)))
			]);
		} catch (err) {
			// Housekeeping only (the tables may not be migrated yet): the check still passes.
			console.error('Health check: could not tidy up rate limit data', err);
		}
	}

	return Response.json(
		{ ok: database === 'ok', database },
		{ status: database === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
};
