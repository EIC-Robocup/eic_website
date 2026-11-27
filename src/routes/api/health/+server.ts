import { and, isNotNull, lt, sql } from 'drizzle-orm';
import { CRON_SECRET } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { messages } from '#lib/server/db/schema.ts';
import { pruneRateLimits } from '#lib/server/rate-limit.ts';
import type { RequestHandler } from './$types';

/**
 * Is this the daily Vercel cron (vercel.json)? With CRON_SECRET set, Vercel sends it as
 * `Authorization: Bearer <secret>` and nothing else passes. Without it, the cron's user agent
 * is the only sign: anyone can copy that, but all it buys them is one small delete.
 */
function fromCron(request: Request): boolean {
	if (CRON_SECRET) return request.headers.get('authorization') === `Bearer ${CRON_SECRET}`;
	return (request.headers.get('user-agent') ?? '').startsWith('vercel-cron/');
}

/**
 * Health check. Anyone may call it; it only reads (`select 1`). The daily Vercel cron also
 * keeps a Free plan Supabase project from pausing after a quiet week, and only the cron's
 * call tidies up: rate limit counters older than a day are deleted, and contact messages
 * older than a day lose their hashed sender address (only the last hour is ever checked).
 */
export const GET: RequestHandler = async ({ request }) => {
	let database: 'ok' | 'error' = 'ok';
	try {
		await db.execute(sql`select 1`);
	} catch (err) {
		console.error('Health check: database unreachable', err);
		database = 'error';
	}

	if (database === 'ok' && fromCron(request)) {
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
