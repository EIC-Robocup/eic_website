/**
 * Read queries for the admin dashboard. Admin loads still call requireEditor first.
 * These see every row, published or not.
 */
import { and, asc, count, desc, eq, isNull, max, min, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	achievements,
	activity,
	messages,
	people,
	posts,
	projects,
	type Activity,
	type PostCategory
} from '#lib/server/db/schema.ts';
import { getPeopleCounts } from '#lib/server/queries/site.ts';

/**
 * The dashboard numbers. One definition for each, shared with the sidebar badges
 * (src/routes/admin/(app)/+layout.server.ts) and the public site:
 * - every `total` counts every row, like the sidebar badge and the admin list it opens;
 * - what the public site shows is counted the way the site counts it: published projects,
 *   live posts (published, publish time passed), and the People page's numbers.
 */
export type DashboardCounts = {
	/** published: on the Projects page. */
	projects: { total: number; ongoing: number; published: number };
	/**
	 * published: live on the blog (the Published tab in /admin/posts); scheduled: published
	 * with a publish time still to come; drafts: not published.
	 */
	posts: { total: number; published: number; scheduled: number; drafts: number };
	/**
	 * total: everyone in /admin/people (every kind, hidden too). onSite, teams and advisors:
	 * the public People page's numbers (getPeopleCounts in #lib/server/queries/site.ts).
	 */
	people: { total: number; onSite: number; teams: number; advisors: number };
	/** firstYear and lastYear are null when there are no achievements. */
	achievements: { count: number; firstYear: number | null; lastYear: number | null };
	/** Inbox messages not read and not archived. */
	messages: { unread: number };
};

/** Postgres "undefined_table", possibly wrapped by Drizzle. */
function isMissingTable(err: unknown): boolean {
	const e = err as { code?: string; cause?: { code?: string } } | null;
	return e?.code === '42P01' || e?.cause?.code === '42P01';
}

async function countUnreadMessages(): Promise<number> {
	try {
		const [row] = await db
			.select({ n: count() })
			.from(messages)
			.where(and(isNull(messages.readAt), eq(messages.archived, false)));
		return row?.n ?? 0;
	} catch (err) {
		// The messages table comes with a later migration; until it is applied the inbox is empty.
		if (isMissingTable(err)) return 0;
		throw err;
	}
}

/** The four numbers on the dashboard, plus the unread inbox count. */
export async function getDashboardCounts(): Promise<DashboardCounts> {
	const [projectRow, postRow, personRow, onSite, achievementRow, unread] = await Promise.all([
		db
			.select({
				total: count(),
				ongoing: sql<number>`count(*) filter (where ${projects.status} = 'ongoing')::int`,
				published: sql<number>`count(*) filter (where ${projects.published})::int`
			})
			.from(projects),
		db
			.select({
				total: count(),
				published: sql<number>`count(*) filter (where ${posts.status} = 'published' and ${posts.publishedAt} <= now())::int`,
				scheduled: sql<number>`count(*) filter (where ${posts.status} = 'published' and ${posts.publishedAt} > now())::int`,
				drafts: sql<number>`count(*) filter (where ${posts.status} = 'draft')::int`
			})
			.from(posts),
		db.select({ total: count() }).from(people),
		getPeopleCounts(),
		db
			.select({ n: count(), first: min(achievements.year), last: max(achievements.year) })
			.from(achievements),
		countUnreadMessages()
	]);

	return {
		projects: {
			total: projectRow[0]?.total ?? 0,
			ongoing: projectRow[0]?.ongoing ?? 0,
			published: projectRow[0]?.published ?? 0
		},
		posts: {
			total: postRow[0]?.total ?? 0,
			published: postRow[0]?.published ?? 0,
			scheduled: postRow[0]?.scheduled ?? 0,
			drafts: postRow[0]?.drafts ?? 0
		},
		people: {
			total: personRow[0]?.total ?? 0,
			onSite: onSite.people,
			teams: onSite.teams,
			advisors: onSite.advisors
		},
		achievements: {
			count: achievementRow[0]?.n ?? 0,
			firstYear: achievementRow[0]?.first ?? null,
			lastYear: achievementRow[0]?.last ?? null
		},
		messages: { unread }
	};
}

/** "Recent edits": the newest activity entries (see logActivity in #lib/server/activity.ts). */
export async function listRecentActivity(limit = 8): Promise<Activity[]> {
	return db
		.select()
		.from(activity)
		.orderBy(desc(activity.createdAt), asc(activity.id))
		.limit(Math.max(1, Math.min(limit, 100)));
}

export type DraftPost = {
	id: string;
	slug: string;
	title: string;
	category: PostCategory;
	authorName: string | null;
	updatedAt: Date;
};

/** Drafts, most recently edited first. */
export async function listDraftPosts(limit = 5): Promise<DraftPost[]> {
	return db
		.select({
			id: posts.id,
			slug: posts.slug,
			title: posts.title,
			category: posts.category,
			authorName: posts.authorName,
			updatedAt: posts.updatedAt
		})
		.from(posts)
		.where(eq(posts.status, 'draft'))
		.orderBy(desc(posts.updatedAt), asc(posts.title))
		.limit(Math.max(1, Math.min(limit, 100)));
}
