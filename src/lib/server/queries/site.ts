/**
 * Read queries for the public site. Every function returns plain, serialisable
 * objects (Dates included) that can go straight out of a `load`, and only
 * published or visible rows.
 *
 * Errors (for example an unreachable database) are not caught here: wrap a call
 * in try/catch in the load if the page should still render without it.
 */
import { and, asc, desc, eq, isNotNull, lte, ne, notInArray, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import {
	achievements,
	archivePhotos,
	people,
	posts,
	projects,
	publications,
	sponsors,
	teams,
	type Achievement,
	type ArchivePhoto,
	type PersonKind,
	type PostCategory,
	type Project,
	type ProjectCategory,
	type ProjectStatus,
	type Publication,
	type Sponsor
} from '#lib/server/db/schema.ts';
import { extractHeadings, readingMinutes, renderMarkdown } from '#lib/server/markdown.ts';
import { displayRole, initials } from '#lib/content/labels.ts';
import type { SiteCounts } from '#lib/content/stats.ts';

/**
 * Team slugs that are groups on the People page but not counted as teams.
 * The designs count five teams (Navigation, AI, Mechanical Design, Integration,
 * Operations & Support); Leadership is listed but is not one of them.
 */
export const NON_TEAM_SLUGS: readonly string[] = ['leadership'];

const isExternal = (href: string) => /^https?:\/\//i.test(href);

/* ------------------------------------------------------------------------- */
/* Projects                                                                   */
/* ------------------------------------------------------------------------- */

export type ProjectCard = {
	id: string;
	slug: string;
	title: string;
	category: ProjectCategory;
	year: number | null;
	/** Last year for multi-year projects ("2006 to 2008"). */
	yearEnd: number | null;
	status: ProjectStatus;
	tagline: string | null;
	summary: string | null;
	event: string | null;
	place: string | null;
	result: string | null;
	coverUrl: string | null;
	coverAlt: string | null;
	coverCaption: string | null;
	tags: string[];
	linkUrl: string | null;
	featured: boolean;
	/** Where a card links: `linkUrl` when set, else `/projects/<slug>`. */
	href: string;
	/** True when `href` leaves the site (open it in a new tab). */
	external: boolean;
};

export type FeaturedProject = Project & { href: string; external: boolean };

export type ProjectDetail = Project & {
	href: string;
	external: boolean;
	/** Up to two published posts linked to the project, newest first (featured ones preferred). */
	relatedPosts: PostCard[];
};

const projectCardColumns = {
	id: projects.id,
	slug: projects.slug,
	title: projects.title,
	category: projects.category,
	year: projects.year,
	yearEnd: projects.yearEnd,
	status: projects.status,
	tagline: projects.tagline,
	summary: projects.summary,
	event: projects.event,
	place: projects.place,
	result: projects.result,
	coverUrl: projects.coverUrl,
	coverAlt: projects.coverAlt,
	coverCaption: projects.coverCaption,
	tags: projects.tags,
	linkUrl: projects.linkUrl,
	featured: projects.featured
};

function projectHref(p: { slug: string; linkUrl: string | null }): { href: string; external: boolean } {
	const href = p.linkUrl?.trim() || `/projects/${p.slug}`;
	return { href, external: isExternal(href) };
}

const projectOrder = [asc(projects.sortOrder), sql`${projects.year} desc nulls last`, asc(projects.title)];

/** The big card on the home page: the first published project marked featured. */
export async function getFeaturedProject(): Promise<FeaturedProject | null> {
	const [row] = await db
		.select()
		.from(projects)
		.where(and(eq(projects.published, true), eq(projects.featured, true)))
		.orderBy(...projectOrder)
		.limit(1);
	return row ? { ...row, ...projectHref(row) } : null;
}

/** Published projects for the Projects page: sort order, then newest year. */
export async function listProjects(): Promise<ProjectCard[]> {
	const rows = await db
		.select(projectCardColumns)
		.from(projects)
		.where(eq(projects.published, true))
		.orderBy(...projectOrder);
	return rows.map((r) => ({ ...r, ...projectHref(r) }));
}

/** A published project with up to two related published posts, or null. */
export async function getProjectBySlug(slug: string): Promise<ProjectDetail | null> {
	const [row] = await db
		.select()
		.from(projects)
		.where(and(eq(projects.slug, slug), eq(projects.published, true)))
		.limit(1);
	if (!row) return null;

	const linked = await selectPostCards(eq(posts.projectId, row.id), {
		orderBy: [desc(posts.featured), desc(posts.publishedAt)],
		limit: 2
	});
	linked.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

	return { ...row, ...projectHref(row), relatedPosts: linked };
}

/** Papers for the Projects page, newest first. */
export async function listPublications(): Promise<Publication[]> {
	return db
		.select()
		.from(publications)
		.orderBy(desc(publications.year), asc(publications.sortOrder), asc(publications.title));
}

/* ------------------------------------------------------------------------- */
/* People                                                                     */
/* ------------------------------------------------------------------------- */

export type PersonCard = {
	id: string;
	name: string;
	/** The line under the name: the role, or "<Team> team" when the role is empty. */
	role: string;
	/** True when the stored role is empty (the line is the team name). */
	roleIsTeam: boolean;
	kind: PersonKind;
	/** Leads show their role in brand red. */
	isLead: boolean;
	featured: boolean;
	cohort: number | null;
	photoUrl: string | null;
	profileUrl: string | null;
	initials: string;
	teamSlug: string | null;
	teamName: string | null;
};

export type PeopleGroup = {
	/** The team id, or 'advisors' / 'members' for the groups that are not teams. */
	id: string;
	slug: string;
	name: string;
	people: PersonCard[];
};

export type PeopleByTeam = {
	/** Advisors first, then the teams in their sort order. Empty groups are left out. */
	groups: PeopleGroup[];
	/** Visible alumni (not part of the groups or totals). */
	alumni: PersonCard[];
	totals: {
		/** Visible members and advisors (the designs' "41 people"). */
		people: number;
		/** Teams with visible members, not counting NON_TEAM_SLUGS (the designs' "5 teams"). */
		teams: number;
		advisors: number;
	};
};

const personColumns = {
	id: people.id,
	name: people.name,
	role: people.role,
	kind: people.kind,
	isLead: people.isLead,
	featured: people.featured,
	cohort: people.cohort,
	photoUrl: people.photoUrl,
	profileUrl: people.profileUrl,
	teamId: people.teamId,
	teamSlug: teams.slug,
	teamName: teams.name
};

type PersonRow = {
	id: string;
	name: string;
	role: string | null;
	kind: PersonKind;
	isLead: boolean;
	featured: boolean;
	cohort: number | null;
	photoUrl: string | null;
	profileUrl: string | null;
	teamId: string | null;
	teamSlug: string | null;
	teamName: string | null;
};

function toPersonCard(r: PersonRow): PersonCard {
	const hasRole = Boolean(r.role?.trim());
	return {
		id: r.id,
		name: r.name,
		role: hasRole || r.kind !== 'advisor' ? displayRole(r.role, r.teamName) : 'Advisor',
		roleIsTeam: !hasRole && r.kind !== 'advisor',
		kind: r.kind,
		isLead: r.isLead,
		featured: r.featured,
		cohort: r.cohort,
		photoUrl: r.photoUrl,
		profileUrl: r.profileUrl,
		initials: initials(r.name),
		teamSlug: r.teamSlug,
		teamName: r.teamName
	};
}

/** Everyone visible, grouped for the People page. */
export async function listPeopleByTeam(): Promise<PeopleByTeam> {
	const [teamRows, personRows] = await Promise.all([
		db
			.select({ id: teams.id, slug: teams.slug, name: teams.name })
			.from(teams)
			.orderBy(asc(teams.sortOrder), asc(teams.name)),
		db
			.select(personColumns)
			.from(people)
			.leftJoin(teams, eq(people.teamId, teams.id))
			.where(eq(people.visible, true))
			.orderBy(asc(people.sortOrder), asc(people.name))
	]);

	const advisors: PersonCard[] = [];
	const alumni: PersonCard[] = [];
	const unassigned: PersonCard[] = [];
	const byTeam = new Map<string, PersonCard[]>();
	for (const row of personRows) {
		const card = toPersonCard(row);
		if (row.kind === 'advisor') advisors.push(card);
		else if (row.kind === 'alumni') alumni.push(card);
		else if (row.teamId) {
			const list = byTeam.get(row.teamId) ?? [];
			list.push(card);
			byTeam.set(row.teamId, list);
		} else unassigned.push(card);
	}

	const groups: PeopleGroup[] = [];
	if (advisors.length) groups.push({ id: 'advisors', slug: 'advisors', name: 'Advisors', people: advisors });
	let teamCount = 0;
	let memberCount = 0;
	for (const team of teamRows) {
		const list = byTeam.get(team.id);
		if (!list?.length) continue;
		groups.push({ id: team.id, slug: team.slug, name: team.name, people: list });
		memberCount += list.length;
		if (!NON_TEAM_SLUGS.includes(team.slug)) teamCount += 1;
	}
	if (unassigned.length) {
		groups.push({ id: 'members', slug: 'members', name: 'Members', people: unassigned });
		memberCount += unassigned.length;
	}

	return {
		groups,
		alumni,
		totals: { people: memberCount + advisors.length, teams: teamCount, advisors: advisors.length }
	};
}

/** The home page People strip: featured, visible people; members first, then advisors. */
export async function listFeaturedPeople(): Promise<PersonCard[]> {
	const rows = await db
		.select(personColumns)
		.from(people)
		.leftJoin(teams, eq(people.teamId, teams.id))
		.where(and(eq(people.visible, true), eq(people.featured, true)))
		.orderBy(
			sql`(${people.kind} = 'advisor')`,
			sql`${teams.sortOrder} asc nulls last`,
			asc(people.sortOrder),
			asc(people.name)
		);
	return rows.map(toPersonCard);
}

/* ------------------------------------------------------------------------- */
/* Site numbers                                                               */
/* ------------------------------------------------------------------------- */

export type { SiteCounts };

/**
 * The public People numbers, counted exactly like the People page (listPeopleByTeam):
 * - people: visible members and advisors (alumni are listed apart and not counted);
 * - teams: teams with at least one visible member, leaving out NON_TEAM_SLUGS (Leadership);
 * - advisors: visible advisors.
 * The admin dashboard shows the same numbers as "on the site".
 */
export async function getPeopleCounts(): Promise<Pick<SiteCounts, 'people' | 'teams' | 'advisors'>> {
	const countedTeam = NON_TEAM_SLUGS.length ? notInArray(teams.slug, [...NON_TEAM_SLUGS]) : sql`true`;
	const [counts] = await db
		.select({
			people: sql<number>`count(*) filter (where ${people.kind} in ('member', 'advisor'))::int`,
			advisors: sql<number>`count(*) filter (where ${people.kind} = 'advisor')::int`,
			teams: sql<number>`count(distinct ${people.teamId}) filter (where ${people.kind} = 'member' and ${countedTeam})::int`
		})
		.from(people)
		.leftJoin(teams, eq(people.teamId, teams.id))
		.where(eq(people.visible, true));
	return { people: counts?.people ?? 0, teams: counts?.teams ?? 0, advisors: counts?.advisors ?? 0 };
}

/**
 * The numbers the home page strip can show (see resolveStats in #lib/content/stats.ts),
 * counted the same way as the People and Projects pages. Three queries, run together.
 */
export async function getSiteCounts(): Promise<SiteCounts> {
	const [peopleCounts, [projectCount], [latest]] = await Promise.all([
		getPeopleCounts(),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(projects)
			.where(eq(projects.published, true)),
		db
			.select({
				placement: achievements.placement,
				entrants: achievements.entrants,
				competition: achievements.competition,
				year: achievements.year
			})
			.from(achievements)
			.orderBy(desc(achievements.year), asc(achievements.sortOrder), asc(achievements.createdAt))
			.limit(1)
	]);
	return {
		...peopleCounts,
		projects: projectCount?.n ?? 0,
		latestResult: latest ?? null
	};
}

/* ------------------------------------------------------------------------- */
/* Posts                                                                      */
/* ------------------------------------------------------------------------- */

export type PostCard = {
	id: string;
	slug: string;
	title: string;
	excerpt: string | null;
	category: PostCategory;
	authorName: string | null;
	publishedAt: Date;
	coverUrl: string | null;
	coverAlt: string | null;
	coverCaption: string | null;
	tags: string[];
	featured: boolean;
	projectId: string | null;
	readingMinutes: number;
	/** `/blog/<slug>` */
	href: string;
};

export type PostHeading = { id: string; text: string; depth: number };

export type PostDetail = PostCard & {
	/** The Markdown source. */
	body: string;
	/** Rendered and sanitised HTML, safe for {@html}. */
	html: string;
	/** h2 and h3 headings, for a table of contents. */
	headings: PostHeading[];
	updatedAt: Date;
	/** The linked project, when it is published. */
	project: { slug: string; title: string } | null;
	/** Three other published posts, same category first, then same project, then newest. */
	related: PostCard[];
};

/** Published and not scheduled for later. */
const isLive = () =>
	and(eq(posts.status, 'published'), isNotNull(posts.publishedAt), lte(posts.publishedAt, sql`now()`));

const postCardColumns = {
	id: posts.id,
	slug: posts.slug,
	title: posts.title,
	excerpt: posts.excerpt,
	category: posts.category,
	authorName: posts.authorName,
	publishedAt: posts.publishedAt,
	coverUrl: posts.coverUrl,
	coverAlt: posts.coverAlt,
	coverCaption: posts.coverCaption,
	tags: posts.tags,
	featured: posts.featured,
	projectId: posts.projectId,
	body: posts.body
};

type PostCardRow = Omit<PostCard, 'readingMinutes' | 'href' | 'publishedAt'> & {
	publishedAt: Date | null;
	body: string;
};

function toPostCard({ body, ...row }: PostCardRow): PostCard {
	return {
		...row,
		// isLive() guarantees a date; the fallback only satisfies the type.
		publishedAt: row.publishedAt ?? new Date(0),
		readingMinutes: readingMinutes(body),
		href: `/blog/${row.slug}`
	};
}

async function selectPostCards(
	where: SQL | undefined,
	opts: { orderBy?: SQL[]; limit?: number; offset?: number } = {}
): Promise<PostCard[]> {
	let query = db
		.select(postCardColumns)
		.from(posts)
		.where(and(isLive(), where))
		.orderBy(...(opts.orderBy ?? [desc(posts.publishedAt), asc(posts.title)]))
		.$dynamic();
	if (opts.limit !== undefined) query = query.limit(opts.limit);
	if (opts.offset) query = query.offset(opts.offset);
	const rows = await query;
	return rows.map(toPostCard);
}

/**
 * Published posts, newest first, without their bodies.
 * `featured: true` / `false` keeps only (or leaves out) featured posts.
 */
export async function listPublishedPosts(
	opts: {
		limit?: number;
		offset?: number;
		category?: PostCategory;
		featured?: boolean;
		/** Leave this post out, e.g. the one already shown big. */
		excludeId?: string;
	} = {}
): Promise<PostCard[]> {
	const filters: SQL[] = [];
	if (opts.category) filters.push(eq(posts.category, opts.category));
	if (opts.featured !== undefined) filters.push(eq(posts.featured, opts.featured));
	if (opts.excludeId) filters.push(ne(posts.id, opts.excludeId));
	return selectPostCards(filters.length ? and(...filters) : undefined, {
		limit: opts.limit,
		offset: opts.offset
	});
}

/** Number of published posts (for "Load older posts"), optionally in one category. */
export async function countPublishedPosts(category?: PostCategory): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(posts)
		.where(and(isLive(), category ? eq(posts.category, category) : undefined));
	return row?.n ?? 0;
}

/** A published post with its rendered HTML, headings, linked project and three related posts. */
export async function getPublishedPostBySlug(slug: string): Promise<PostDetail | null> {
	const [row] = await db
		.select({
			...postCardColumns,
			updatedAt: posts.updatedAt,
			projectSlug: projects.slug,
			projectTitle: projects.title
		})
		.from(posts)
		.leftJoin(projects, and(eq(posts.projectId, projects.id), eq(projects.published, true)))
		.where(and(eq(posts.slug, slug), isLive()))
		.limit(1);
	if (!row) return null;

	const { projectSlug, projectTitle, updatedAt, ...cardRow } = row;
	const card = toPostCard(cardRow);
	// Same category first, then same project (only when the post has one: Postgres rejects a
	// constant like `false` in ORDER BY), then newest.
	const order = [desc(sql`(${posts.category} = ${row.category})`)];
	if (row.projectId) order.push(desc(sql`coalesce(${posts.projectId} = ${row.projectId}, false)`));
	order.push(desc(posts.publishedAt));
	const related = await selectPostCards(ne(posts.id, row.id), { orderBy: order, limit: 3 });

	return {
		...card,
		body: row.body,
		html: renderMarkdown(row.body),
		headings: extractHeadings(row.body),
		updatedAt,
		project: projectSlug && projectTitle ? { slug: projectSlug, title: projectTitle } : null,
		related
	};
}

/* ------------------------------------------------------------------------- */
/* About page lists                                                           */
/* ------------------------------------------------------------------------- */

/** For the timeline: oldest first; entries in the same year by sort order. */
export async function listAchievements(): Promise<Achievement[]> {
	return db
		.select()
		.from(achievements)
		.orderBy(asc(achievements.year), asc(achievements.sortOrder), asc(achievements.createdAt));
}

export async function listArchivePhotos(): Promise<ArchivePhoto[]> {
	return db
		.select()
		.from(archivePhotos)
		.orderBy(asc(archivePhotos.sortOrder), asc(archivePhotos.createdAt));
}

export async function listSponsors(): Promise<Sponsor[]> {
	return db.select().from(sponsors).orderBy(asc(sponsors.sortOrder), asc(sponsors.name));
}
