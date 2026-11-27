/**
 * Rate limits that hold across server instances, counted in the rate_limits table.
 *
 * Every key is a fixed window counter: the first hit opens a window, later hits in it add one,
 * and the first hit after it closes starts a new window. A hit is one atomic upsert, so two
 * instances counting at once can't both slip under the limit.
 *
 * Keys never hold a raw IP or email address. Build them with `limitKey(scope, value)`, which
 * stores a keyed hash (#lib/server/secret.ts), so the table can't be read back into who asked.
 * IPv6 addresses count per /64, because one subscriber usually gets a whole /64.
 *
 * When the query fails (the rate_limits migration has not run yet, or the database is down),
 * the limiter fails open to a per-instance memory counter with the same limits. Failing closed
 * would lock every editor out of email sign in over a limiter fault; the memory counter still
 * slows a burst on the instance that serves it. The error is logged.
 *
 * Rows older than a day are deleted by `pruneRateLimits()`, run by the daily /api/health cron.
 */
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { rateLimits } from '#lib/server/db/schema.ts';
import { keyedHash } from '#lib/server/secret.ts';

export type Limit = { max: number; windowSeconds: number };

/**
 * The address a limit counts for `ip`: IPv4 as is, IPv6 cut to its /64. On Vercel
 * getClientAddress() is the x-forwarded-for header, which Vercel sets to the client's address.
 */
export function addressBucket(ip: string): string {
	const value = (ip.split(',')[0] ?? '').trim().toLowerCase().replace(/%.*$/, '');
	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
	if (mapped) return mapped[1];
	if (!value.includes(':')) return value || 'unknown';
	const [head = '', tail = ''] = value.split('::');
	const left = head ? head.split(':') : [];
	const right = tail ? tail.split(':') : [];
	const groups = value.includes('::')
		? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
		: left;
	return `${groups
		.slice(0, 4)
		.map((g) => g.replace(/^0+(?=.)/, '') || '0')
		.join(':')}::/64`;
}

/** A keyed hash of the client's address bucket. Also stored with contact form messages. */
export function clientHash(ip: string): Promise<string> {
	return keyedHash('client-address-v1', addressBucket(ip));
}

/** A rate limit key: `<scope>:<keyed hash of value>`. */
export async function limitKey(scope: string, value: string): Promise<string> {
	return `${scope}:${await keyedHash(`rate-limit-v1:${scope}`, value)}`;
}

/* ------------------------------------------------------------------------- */
/* Memory fallback                                                            */
/* ------------------------------------------------------------------------- */

const MEMORY_MAX_KEYS = 5_000;
const memory = new Map<string, { start: number; hits: number }>();

function memoryCount(key: string, windowSeconds: number, add: number, atLeast = 0): number {
	const now = Date.now();
	if (memory.size >= MEMORY_MAX_KEYS) {
		for (const [k, v] of memory) if (now - v.start > 86_400_000) memory.delete(k);
		if (memory.size >= MEMORY_MAX_KEYS) memory.delete(memory.keys().next().value as string);
	}
	let entry = memory.get(key);
	if (!entry || now - entry.start >= windowSeconds * 1000) entry = { start: now, hits: 0 };
	entry.hits = Math.max(entry.hits + add, atLeast);
	if (entry.hits > 0) memory.set(key, entry);
	return entry.hits;
}

function logFailure(what: string, err: unknown) {
	console.error(`Rate limit: could not ${what}, counting in memory on this instance`, err);
}

/* ------------------------------------------------------------------------- */
/* Counting                                                                   */
/* ------------------------------------------------------------------------- */

const expired = (windowSeconds: number) =>
	sql`r.window_start <= now() - ${windowSeconds}::integer * interval '1 second'`;

/** Count one hit on `key`. True when this hit goes over `limit.max` (refuse the request). */
export async function hit(key: string, limit: Limit): Promise<boolean> {
	let hits: number;
	try {
		const rows = await db.execute<{ hits: number }>(sql`
			insert into ${rateLimits} as r (key) values (${key})
			on conflict (key) do update set
				hits = case when ${expired(limit.windowSeconds)} then 1 else r.hits + 1 end,
				window_start = case when ${expired(limit.windowSeconds)} then now() else r.window_start end
			returning hits
		`);
		hits = Number(rows[0]?.hits ?? 1);
	} catch (err) {
		logFailure('count a hit', err);
		hits = memoryCount(key, limit.windowSeconds, 1);
	}
	return hits > limit.max;
}

/** True when `key` already has `limit.max` hits in its current window. Counts nothing. */
export async function isSpent(key: string, limit: Limit): Promise<boolean> {
	let hits: number;
	try {
		const rows = await db.execute<{ hits: number }>(sql`
			select r.hits from ${rateLimits} as r
			where r.key = ${key} and not (${expired(limit.windowSeconds)})
		`);
		hits = Number(rows[0]?.hits ?? 0);
	} catch (err) {
		logFailure('read a limit', err);
		hits = memoryCount(key, limit.windowSeconds, 0);
	}
	return hits >= limit.max;
}

/** Use up what is left of `key`'s current window (or a new one), e.g. after an upstream 429. */
export async function spend(key: string, limit: Limit): Promise<void> {
	try {
		await db.execute(sql`
			insert into ${rateLimits} as r (key, hits) values (${key}, ${limit.max})
			on conflict (key) do update set
				hits = greatest(case when ${expired(limit.windowSeconds)} then 0 else r.hits end, ${limit.max}::integer),
				window_start = case when ${expired(limit.windowSeconds)} then now() else r.window_start end
		`);
	} catch (err) {
		logFailure('use up a limit', err);
		memoryCount(key, limit.windowSeconds, 0, limit.max);
	}
}

/** Delete counters whose window opened more than a day ago (no limit here is longer). */
export async function pruneRateLimits(): Promise<number> {
	const rows = await db.execute(sql`
		delete from ${rateLimits} where ${rateLimits.windowStart} < now() - interval '1 day'
	`);
	return rows.count ?? 0;
}
