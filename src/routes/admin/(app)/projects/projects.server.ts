/**
 * Server side of the Projects admin: reading the editor's form, the queries the list and the
 * editor share, and the writes (in transactions, so only one project is ever featured).
 */
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { parseSubmittedJson, readBool, readTags, readText } from '#lib/components/admin/form-data.ts';
import { LIMITS, type ProjectInput, type ProjectValues } from '#lib/components/admin/projects/project-form.ts';
import { db } from '#lib/server/db/index.ts';
import { posts, projects } from '#lib/server/db/schema.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
	return typeof value === 'string' && UUID.test(value);
}

/** The order of the public Projects page: sort order, then newest year, then title. */
export const projectOrder = [asc(projects.sortOrder), sql`${projects.year} desc nulls last`, asc(projects.title)];

/** Parsed JSON from a hidden field; `undefined` (reported as unreadable) when it is not JSON. */
function readJsonField(form: FormData, name: string): unknown {
	const raw = form.get(name);
	if (raw === null || raw === '') return [];
	if (typeof raw !== 'string' || raw.length > 200_000) return undefined;
	try {
		return parseSubmittedJson(raw);
	} catch {
		return undefined;
	}
}

/** What the editor submitted, for validateProject. */
export function readProjectInput(form: FormData): ProjectInput {
	const t = (name: string, max = 5000) => readText(form, name, { max });
	return {
		title: t('title'),
		slug: t('slug'),
		category: t('category', 40),
		status: t('status', 40),
		year: t('year', 20),
		yearEnd: t('yearEnd', 20),
		tagline: t('tagline'),
		summary: t('summary'),
		event: t('event'),
		place: t('place'),
		result: t('result'),
		teamSize: t('teamSize', 20),
		highlightValue: t('highlightValue'),
		highlightLabel: t('highlightLabel'),
		highlightNote: t('highlightNote'),
		coverUrl: t('coverUrl', 4000),
		coverAlt: t('coverAlt'),
		coverCaption: t('coverCaption'),
		// One extra so going over the limit is reported instead of silently cut.
		tags: readTags(form, 'tags', { max: LIMITS.tags + 1, maxLength: 200 }),
		software: readTags(form, 'software', { max: LIMITS.software + 1, maxLength: 200 }),
		systems: readJsonField(form, 'systems'),
		parts: readJsonField(form, 'parts'),
		gallery: readJsonField(form, 'gallery'),
		linkUrl: t('linkUrl', 4000),
		repoUrl: t('repoUrl', 4000),
		paperUrl: t('paperUrl', 4000),
		published: readBool(form, 'published'),
		featured: readBool(form, 'featured'),
		showGallery: readBool(form, 'showGallery')
	};
}

/** Postgres unique_violation, possibly wrapped by Drizzle. */
export function isUniqueViolation(err: unknown): boolean {
	const e = err as { code?: string; cause?: { code?: string } } | null;
	return e?.code === '23505' || e?.cause?.code === '23505';
}

/** Slugs other projects use, for the editor's live "already used" check. */
export async function takenSlugs(exceptId: string | null): Promise<string[]> {
	const rows = await db
		.select({ slug: projects.slug })
		.from(projects)
		.where(exceptId ? ne(projects.id, exceptId) : undefined);
	return rows.map((r) => r.slug);
}

export async function slugTaken(slug: string, exceptId: string | null): Promise<boolean> {
	const [row] = await db
		.select({ id: projects.id })
		.from(projects)
		.where(exceptId ? and(eq(projects.slug, slug), ne(projects.id, exceptId)) : eq(projects.slug, slug))
		.limit(1);
	return Boolean(row);
}

/** The project featured on the home page now (other than `exceptId`), for the editor's hint. */
export async function featuredOther(exceptId: string | null): Promise<{ id: string; title: string } | null> {
	const [row] = await db
		.select({ id: projects.id, title: projects.title })
		.from(projects)
		.where(exceptId ? and(eq(projects.featured, true), ne(projects.id, exceptId)) : eq(projects.featured, true))
		.orderBy(...projectOrder)
		.limit(1);
	return row ?? null;
}

export async function countLinkedPosts(projectId: string): Promise<number> {
	const [row] = await db.select({ n: count() }).from(posts).where(eq(posts.projectId, projectId));
	return row?.n ?? 0;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Only one project is featured: featuring one unfeatures the rest (inside the caller's transaction). */
async function unfeatureOthers(tx: Tx, exceptId: string | null) {
	await tx
		.update(projects)
		.set({ featured: false })
		.where(exceptId ? and(eq(projects.featured, true), ne(projects.id, exceptId)) : eq(projects.featured, true));
}

/** Insert a project at the top of the list. Returns its id. */
export async function createProject(values: ProjectValues): Promise<string> {
	return db.transaction(async (tx) => {
		if (values.featured) await unfeatureOthers(tx, null);
		const [{ first }] = await tx
			.select({ first: sql<number | null>`min(${projects.sortOrder})` })
			.from(projects);
		const [row] = await tx
			.insert(projects)
			.values({ ...values, sortOrder: (first ?? 1) - 1 })
			.returning({ id: projects.id });
		return row.id;
	});
}

/** Update a project. Returns false when it no longer exists. */
export async function updateProject(id: string, values: ProjectValues): Promise<boolean> {
	return db.transaction(async (tx) => {
		if (values.featured) await unfeatureOthers(tx, id);
		const rows = await tx.update(projects).set(values).where(eq(projects.id, id)).returning({ id: projects.id });
		return rows.length > 0;
	});
}

/**
 * Feature a project on the home page (unfeaturing the others) or stop featuring it.
 * Returns the project's title, or null when it does not exist.
 */
export async function setFeatured(id: string, featured: boolean): Promise<string | null> {
	return db.transaction(async (tx) => {
		if (featured) await unfeatureOthers(tx, id);
		const [row] = await tx
			.update(projects)
			.set({ featured })
			.where(eq(projects.id, id))
			.returning({ title: projects.title });
		return row?.title ?? null;
	});
}

/**
 * Move a project one place up or down in the list order. Renumbers every project 0, 1, 2...
 * in the current order first, so ties and gaps (from new projects) never stop a move.
 * Returns the title, or null when the project is not there.
 */
export async function moveProject(
	id: string,
	direction: 'up' | 'down'
): Promise<{ title: string; moved: boolean } | null> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: projects.id, title: projects.title, sortOrder: projects.sortOrder })
			.from(projects)
			.orderBy(...projectOrder)
			.for('update');
		const from = rows.findIndex((r) => r.id === id);
		if (from === -1) return null;
		const to = direction === 'up' ? from - 1 : from + 1;
		const title = rows[from].title;
		if (to < 0 || to >= rows.length) return { title, moved: false };

		const order = rows.slice();
		[order[from], order[to]] = [order[to], order[from]];
		const changed = order.map((r, index) => ({ id: r.id, index, before: r.sortOrder })).filter((r) => r.index !== r.before);
		if (changed.length) {
			const values = sql.join(
				changed.map((r) => sql`(${r.id}::uuid, ${r.index}::int)`),
				sql`, `
			);
			await tx.execute(sql`
				update ${projects} set sort_order = v.ord
				from (values ${values}) as v(id, ord)
				where ${projects.id} = v.id
			`);
		}
		return { title, moved: true };
	});
}
