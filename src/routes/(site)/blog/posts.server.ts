/**
 * Post queries for the Blog pages.
 *
 * - findPosts: the Blog grid (cards only, no bodies) filtered by category, tag and a search
 *   phrase, newest first. `listPublishedPosts` in #lib/server/queries/site.ts has no tag or
 *   text filter.
 * - getLivePost: one post with its linked project and three related posts. The post page
 *   renders the body itself with renderPost(), so this returns the Markdown, not HTML
 *   (getPublishedPostBySlug renders it again, and fails for posts without a project).
 *
 * The "live" rule is the same as site.ts: status published and published_at not in the future.
 */
import { and, asc, desc, eq, ilike, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { POST_CATEGORIES, posts, projects, type PostCategory } from '#lib/server/db/schema.ts';

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

export type LivePost = BlogCard & {
	/** Markdown source. */
	body: string;
	coverCaption: string | null;
	updatedAt: Date;
	/** The linked project, when it is published. */
	project: { slug: string; title: string } | null;
	/** Three other live posts: same category first, then same project, then newest. */
	related: BlogCard[];
};

export function parseCategory(value: string | null): PostCategory | null {
	return value && (POST_CATEGORIES as readonly string[]).includes(value)
		? (value as PostCategory)
		: null;
}

const cardColumns = {
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
};

/** The live rule guarantees a date; the fallback only satisfies the type. */
const withDate = <T extends { publishedAt: Date | null }>(row: T) => ({
	...row,
	publishedAt: row.publishedAt ?? new Date(0)
});

/** Published and not scheduled for later. */
const live = (): SQL[] => [
	eq(posts.status, 'published'),
	isNotNull(posts.publishedAt),
	lte(posts.publishedAt, sql`now()`)
];

/** `%`, `_` and `\` are LIKE wildcards; match them literally. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function where(filters: BlogFilters, excludeId: string | null): SQL | undefined {
	const parts: (SQL | undefined)[] = live();
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
			.select(cardColumns)
			.from(posts)
			.where(condition)
			.orderBy(desc(posts.publishedAt), asc(posts.title))
			.limit(opts.limit),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(posts)
			.where(condition)
	]);

	return { posts: rows.map(withDate), total: counted?.n ?? 0 };
}

/** A live post by slug, or null (drafts and scheduled posts are not found). */
export async function getLivePost(slug: string): Promise<LivePost | null> {
	const [row] = await db
		.select({
			...cardColumns,
			body: posts.body,
			coverCaption: posts.coverCaption,
			updatedAt: posts.updatedAt,
			projectId: posts.projectId,
			projectSlug: projects.slug,
			projectTitle: projects.title
		})
		.from(posts)
		.leftJoin(projects, and(eq(posts.projectId, projects.id), eq(projects.published, true)))
		.where(and(eq(posts.slug, slug), ...live()))
		.limit(1);
	if (!row) return null;

	const { projectId, projectSlug, projectTitle, ...post } = row;
	const order: SQL[] = [desc(sql`(${posts.category} = ${post.category})`)];
	if (projectId) order.push(desc(sql`coalesce(${posts.projectId} = ${projectId}, false)`));
	order.push(desc(posts.publishedAt), asc(posts.title));

	const related = await db
		.select(cardColumns)
		.from(posts)
		.where(and(...live(), ne(posts.id, post.id)))
		.orderBy(...order)
		.limit(3);

	return {
		...withDate(post),
		project: projectSlug && projectTitle ? { slug: projectSlug, title: projectTitle } : null,
		related: related.map(withDate)
	};
}
