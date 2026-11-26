/**
 * The Blog grid's query: published posts (cards only, no bodies) filtered by
 * category, tag and a search phrase, newest first. `listPublishedPosts` in
 * #lib/server/queries/site.ts has no tag or text filter, so this page keeps its own
 * query. The "live" rule is the same: status published and published_at not in the
 * future.
 */
import { and, asc, desc, eq, ilike, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { POST_CATEGORIES, posts, type PostCategory } from '#lib/server/db/schema.ts';

export type BlogFilters = {
	category: PostCategory | null;
	tag: string | null;
	q: string | null;
};

export type BlogCard = {
	id: string;
	slug: string;
	title: string;
	excerpt: string | null;
	category: PostCategory;
	authorName: string | null;
	publishedAt: Date;
	coverUrl: string | null;
	coverAlt: string | null;
	tags: string[];
};

export function parseCategory(value: string | null): PostCategory | null {
	return value && (POST_CATEGORIES as readonly string[]).includes(value)
		? (value as PostCategory)
		: null;
}

/** `%`, `_` and `\` are LIKE wildcards; match them literally. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function where(filters: BlogFilters, excludeId: string | null): SQL | undefined {
	const parts: (SQL | undefined)[] = [
		eq(posts.status, 'published'),
		isNotNull(posts.publishedAt),
		lte(posts.publishedAt, sql`now()`)
	];
	if (filters.category) parts.push(eq(posts.category, filters.category));
	if (filters.tag) {
		// Tags match case-insensitively, so /blog?tag=walkie%204 finds "Walkie 4".
		parts.push(
			sql`exists (select 1 from unnest(${posts.tags}) as t(tag) where lower(t.tag) = lower(${filters.tag}))`
		);
	}
	if (filters.q) {
		const pattern = likePattern(filters.q);
		parts.push(or(ilike(posts.title, pattern), ilike(posts.excerpt, pattern)));
	}
	if (excludeId) parts.push(ne(posts.id, excludeId));
	return and(...parts);
}

/** The first `limit` matching posts and how many match in all. */
export async function findPosts(
	filters: BlogFilters,
	opts: { limit: number; excludeId?: string | null }
): Promise<{ posts: BlogCard[]; total: number }> {
	const condition = where(filters, opts.excludeId ?? null);
	const [rows, [counted]] = await Promise.all([
		db
			.select({
				id: posts.id,
				slug: posts.slug,
				title: posts.title,
				excerpt: posts.excerpt,
				category: posts.category,
				authorName: posts.authorName,
				publishedAt: posts.publishedAt,
				coverUrl: posts.coverUrl,
				coverAlt: posts.coverAlt,
				tags: posts.tags
			})
			.from(posts)
			.where(condition)
			.orderBy(desc(posts.publishedAt), asc(posts.title))
			.limit(opts.limit),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(posts)
			.where(condition)
	]);

	return {
		// The live rule guarantees a date; the fallback only satisfies the type.
		posts: rows.map((row) => ({ ...row, publishedAt: row.publishedAt ?? new Date(0) })),
		total: counted?.n ?? 0
	};
}
