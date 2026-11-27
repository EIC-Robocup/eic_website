/**
 * Shared server code for the post editor (/admin/posts/new and /admin/posts/[id]): the
 * editor's options, reading and validating the form, and saving.
 */
import { fail, type ActionFailure } from '@sveltejs/kit';
import { and, asc, desc, eq, isNotNull, ne, notInArray, sql } from 'drizzle-orm';
import { readBool, readImage, readOptional, readTags, readText, stripNul } from '#lib/components/admin/form-data.ts';
import {
	LIMITS,
	SLUG_PATTERN,
	bangkokParts,
	byteLength,
	parseBangkok,
	slugify
} from '#lib/components/admin/posts/post-fields.ts';
import { logActivity } from '#lib/server/activity.ts';
import type { SessionEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import {
	POST_CATEGORIES,
	POST_STATUSES,
	editors,
	posts,
	projects,
	teams,
	type Post,
	type PostCategory,
	type PostStatus
} from '#lib/server/db/schema.ts';
import { NON_TEAM_SLUGS } from '#lib/server/queries/site.ts';

/** What the editor needs about a post (no internal columns). */
export type EditorPost = {
	id: string | null;
	slug: string;
	title: string;
	excerpt: string;
	body: string;
	category: PostCategory;
	authorName: string;
	status: PostStatus;
	publishedAt: Date | null;
	coverUrl: string;
	coverAlt: string;
	coverCaption: string;
	tags: string[];
	projectId: string;
	featured: boolean;
	updatedAt: Date | null;
	/** Name (or email) of whoever saved it last. */
	updatedBy: string | null;
};

export type EditorOptions = {
	projects: { id: string; title: string }[];
	/** Bylines to suggest: existing authors, then teams. */
	authors: string[];
	/** The post that is featured now, if any. */
	featured: { id: string; title: string } | null;
};

export function blankPost(editor: SessionEditor): EditorPost {
	return {
		id: null,
		slug: '',
		title: '',
		excerpt: '',
		body: '',
		category: 'engineering',
		authorName: editor.name ?? '',
		status: 'draft',
		publishedAt: null,
		coverUrl: '',
		coverAlt: '',
		coverCaption: '',
		tags: [],
		projectId: '',
		featured: false,
		updatedAt: null,
		updatedBy: null
	};
}

export async function loadEditorPost(id: string): Promise<EditorPost | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({ post: posts, editorName: editors.name })
		.from(posts)
		.leftJoin(editors, eq(editors.email, posts.updatedBy))
		.where(eq(posts.id, id))
		.limit(1);
	if (!row) return null;
	const p = row.post;
	return {
		id: p.id,
		slug: p.slug,
		title: p.title,
		excerpt: p.excerpt ?? '',
		body: p.body,
		category: p.category,
		authorName: p.authorName ?? '',
		status: p.status,
		publishedAt: p.publishedAt,
		coverUrl: p.coverUrl ?? '',
		coverAlt: p.coverAlt ?? '',
		coverCaption: p.coverCaption ?? '',
		tags: p.tags,
		projectId: p.projectId ?? '',
		featured: p.featured,
		updatedAt: p.updatedAt,
		updatedBy: row.editorName || p.updatedBy
	};
}

export async function loadEditorOptions(): Promise<EditorOptions> {
	const [projectRows, authorRows, teamRows, featuredRows] = await Promise.all([
		db
			.select({ id: projects.id, title: projects.title })
			.from(projects)
			.orderBy(asc(projects.sortOrder), desc(projects.year), asc(projects.title)),
		db
			.select({ name: posts.authorName, n: sql<number>`count(*)::int` })
			.from(posts)
			.where(isNotNull(posts.authorName))
			.groupBy(posts.authorName)
			.orderBy(desc(sql`count(*)`), asc(posts.authorName)),
		db
			.select({ name: teams.name })
			.from(teams)
			.where(NON_TEAM_SLUGS.length ? notInArray(teams.slug, [...NON_TEAM_SLUGS]) : undefined)
			.orderBy(asc(teams.sortOrder)),
		db
			.select({ id: posts.id, title: posts.title })
			.from(posts)
			.where(eq(posts.featured, true))
			.orderBy(desc(posts.updatedAt))
			.limit(1)
	]);

	const seen = new Set<string>();
	const authors: string[] = [];
	const add = (name: string | null | undefined) => {
		const clean = name?.trim();
		if (!clean || seen.has(clean.toLowerCase())) return;
		seen.add(clean.toLowerCase());
		authors.push(clean);
	};
	for (const row of authorRows) add(row.name);
	add('EIC Chula');
	for (const team of teamRows) add(/team$/i.test(team.name) ? team.name : `${team.name} Team`);

	return { projects: projectRows, authors, featured: featuredRows[0] ?? null };
}

/* ------------------------------------------------------------------------------------------ */
/* Reading the form                                                                            */
/* ------------------------------------------------------------------------------------------ */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

type PostValues = {
	slug: string;
	title: string;
	excerpt: string | null;
	body: string;
	category: PostCategory;
	authorName: string | null;
	status: PostStatus;
	publishedAt: Date | null;
	coverUrl: string | null;
	coverAlt: string | null;
	coverCaption: string | null;
	tags: string[];
	projectId: string | null;
	featured: boolean;
};

export type ReadResult =
	| { ok: true; values: PostValues; slugAuto: boolean; baseUpdatedAt: Date | null; overwrite: boolean }
	| { ok: false; failure: ActionFailure<{ message: string; errors: Record<string, string> }> };

/** Read and check everything the editor submits. */
export async function readPostForm(form: FormData, now = new Date()): Promise<ReadResult> {
	const errors: Record<string, string> = {};

	const title = readText(form, 'title', { max: 1000 });
	if (!title) errors.title = 'Add a title.';
	else if (title.length > LIMITS.title) errors.title = `Keep the title under ${LIMITS.title} characters.`;

	let slug = readText(form, 'slug', { max: 500 }).toLowerCase();
	let slugAuto = readBool(form, 'slugAuto');
	if (!slug) {
		slug = slugify(title);
		slugAuto = true;
	}
	if (!slug && title) {
		// A title with no Latin letters (Thai only): a dated slug the editor can change later.
		slug = `post-${bangkokParts(now).date.replace(/-/g, '')}`;
	}
	if (slug && !SLUG_PATTERN.test(slug)) {
		errors.slug = 'Use lower case letters, numbers and single hyphens, like walkie-picks-up-a-can.';
	} else if (slug.length > LIMITS.slug) {
		errors.slug = `Keep the URL under ${LIMITS.slug} characters.`;
	}

	const excerpt = readText(form, 'excerpt', { max: 2000 }).replace(/\s+/g, ' ');
	if (excerpt.length > LIMITS.excerpt) errors.excerpt = `Keep the excerpt under ${LIMITS.excerpt} characters.`;

	const rawBody = form.get('body');
	const body = typeof rawBody === 'string' ? stripNul(rawBody).replace(/\r\n?/g, '\n') : '';
	if (byteLength(body) > LIMITS.bodyBytes) errors.body = 'The post is longer than 200 KB. Split it into two posts.';

	const category = readText(form, 'category');
	if (!(POST_CATEGORIES as readonly string[]).includes(category)) errors.category = 'Choose a category.';

	const intent = readText(form, 'intent');
	const statusField = readText(form, 'status');
	const status = intent === 'draft' ? 'draft' : intent === 'publish' ? 'published' : statusField;
	if (!(POST_STATUSES as readonly string[]).includes(status)) errors.status = 'Choose Draft or Published.';

	const when = parseBangkok(readText(form, 'publishDate'), readText(form, 'publishTime'));
	if (when === 'invalid') errors.publishDate = 'Use a real date and time, like 14 Sep 2026, 09:00.';

	const authorName = readOptional(form, 'authorName', { max: 1000 });
	if (authorName && authorName.length > LIMITS.author) errors.authorName = `Keep the author under ${LIMITS.author} characters.`;

	const cover = readImage(form, 'cover');
	if (cover.invalid) errors.cover = 'Use an https:// link or upload the image.';
	else if (cover.url && !cover.alt) errors.cover = 'Describe the cover image for people who cannot see it.';
	const coverCaption = readOptional(form, 'coverCaption', { max: 1000 });
	if (coverCaption && coverCaption.length > LIMITS.caption) errors.coverCaption = `Keep the caption under ${LIMITS.caption} characters.`;

	const tags = readTags(form, 'tags', { max: 20, maxLength: 40 });

	let projectId: string | null = readText(form, 'projectId');
	if (!projectId || projectId === 'none') projectId = null;
	else if (!isUuid(projectId)) errors.projectId = 'Choose a project from the list.';
	else {
		const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
		if (!project) errors.projectId = 'That project no longer exists. Choose another one.';
	}

	const featured = readBool(form, 'featured');

	if (Object.keys(errors).length) {
		return { ok: false, failure: fail(400, { message: 'Check the highlighted fields.', errors }) };
	}

	// Publishing without a date means "now". A draft keeps the planned date, if any.
	let publishedAt = when instanceof Date ? when : null;
	if (status === 'published' && !publishedAt) publishedAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000);

	const baseRaw = readText(form, 'baseUpdatedAt');
	const base = baseRaw ? new Date(baseRaw) : null;

	return {
		ok: true,
		slugAuto,
		baseUpdatedAt: base && !Number.isNaN(base.getTime()) ? base : null,
		overwrite: readBool(form, 'overwrite'),
		values: {
			slug,
			title,
			excerpt: excerpt || null,
			body,
			category: category as PostCategory,
			authorName,
			status: status as PostStatus,
			publishedAt,
			coverUrl: cover.url || null,
			coverAlt: cover.url ? cover.alt || null : null,
			coverCaption: coverCaption || null,
			tags,
			projectId,
			featured
		}
	};
}

/* ------------------------------------------------------------------------------------------ */
/* Saving                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** A free slug: the one asked for, or (for automatic slugs) the first free `slug-2`, `slug-3`... */
async function freeSlug(slug: string, auto: boolean, id: string | null): Promise<{ slug: string } | { taken: string }> {
	const owner = async (candidate: string) => {
		const [row] = await db
			.select({ id: posts.id, title: posts.title })
			.from(posts)
			.where(id ? and(eq(posts.slug, candidate), ne(posts.id, id)) : eq(posts.slug, candidate))
			.limit(1);
		return row ?? null;
	};
	const first = await owner(slug);
	if (!first) return { slug };
	if (!auto) return { taken: first.title };
	for (let n = 2; n < 100; n++) {
		const suffix = `-${n}`;
		const candidate = slug.slice(0, LIMITS.slug - suffix.length).replace(/-+$/, '') + suffix;
		if (!(await owner(candidate))) return { slug: candidate };
	}
	return { taken: first.title };
}

function isUniqueViolation(err: unknown): boolean {
	const e = err as { code?: string; cause?: { code?: string } } | null;
	return e?.code === '23505' || e?.cause?.code === '23505';
}

export type SaveResult =
	| { ok: true; id: string; slug: string; message: string }
	| { ok: false; failure: ActionFailure<Record<string, unknown>> };

/** A second earlier: timestamps that differ by less are the same save. */
const secondBefore = (d: Date) => new Date(d.getTime() - 1000);

/**
 * Create (id null) or update a post. Only one post is featured at a time, so featuring this one
 * un-features the other (without touching its updated time). Logs the activity.
 */
export async function savePost(
	editor: SessionEditor,
	id: string | null,
	read: Extract<ReadResult, { ok: true }>
): Promise<SaveResult> {
	const { values } = read;

	let previous: Pick<Post, 'status' | 'publishedAt' | 'updatedAt' | 'updatedBy' | 'slug'> | null = null;
	const gone = () => ({ ok: false as const, failure: fail(404, { message: 'This post was deleted. Copy your text before leaving the page.' }) });
	if (id) {
		// Not a post id at all (a hand-made URL): Postgres would refuse it with a 500.
		if (!isUuid(id)) return gone();
		const [row] = await db
			.select({ status: posts.status, publishedAt: posts.publishedAt, updatedAt: posts.updatedAt, updatedBy: posts.updatedBy, slug: posts.slug })
			.from(posts)
			.where(eq(posts.id, id))
			.limit(1);
		if (!row) return gone();
		previous = row;

		// Someone else saved since this editor opened the post.
		if (
			read.baseUpdatedAt &&
			!read.overwrite &&
			row.updatedAt > read.baseUpdatedAt &&
			secondBefore(row.updatedAt) > read.baseUpdatedAt &&
			row.updatedBy &&
			row.updatedBy !== editor.email
		) {
			const [who] = await db.select({ name: editors.name }).from(editors).where(eq(editors.email, row.updatedBy)).limit(1);
			const by = who?.name || row.updatedBy;
			return {
				ok: false,
				failure: fail(409, {
					message: `${by} saved this post while you were editing. Save again to replace their version, or reload to see it.`,
					conflict: { by, at: row.updatedAt.toISOString() }
				})
			};
		}
	}

	const slug = await freeSlug(values.slug, read.slugAuto && (!previous || previous.slug !== values.slug), id);
	if ('taken' in slug) {
		return {
			ok: false,
			failure: fail(400, {
				message: 'Check the highlighted fields.',
				errors: { slug: `“${slug.taken}” already uses this URL. Choose another one.` }
			})
		};
	}

	const row = { ...values, slug: slug.slug, updatedBy: editor.email };
	let saved: { id: string; slug: string; title: string };
	let unfeatured: string | null = null;
	try {
		saved = await db.transaction(async (tx) => {
			if (values.featured) {
				const cleared = await tx
					.update(posts)
					// Keep the other post's updated time: un-featuring it is not an edit to it.
					.set({ featured: false, updatedAt: sql`${posts.updatedAt}` })
					.where(id ? and(eq(posts.featured, true), ne(posts.id, id)) : eq(posts.featured, true))
					.returning({ title: posts.title });
				unfeatured = cleared[0]?.title ?? null;
			}
			if (id) {
				const [updated] = await tx
					.update(posts)
					.set(row)
					.where(eq(posts.id, id))
					.returning({ id: posts.id, slug: posts.slug, title: posts.title });
				return updated;
			}
			const [created] = await tx
				.insert(posts)
				.values(row)
				.returning({ id: posts.id, slug: posts.slug, title: posts.title });
			return created;
		});
	} catch (err) {
		if (isUniqueViolation(err)) {
			return {
				ok: false,
				failure: fail(400, {
					message: 'Check the highlighted fields.',
					errors: { slug: 'Another post took this URL a moment ago. Choose another one.' }
				})
			};
		}
		throw err;
	}

	const nowLive = values.status === 'published';
	const wasPublished = previous?.status === 'published';
	const action = !id ? (nowLive ? 'published' : 'created') : nowLive && !wasPublished ? 'published' : 'updated';
	await logActivity(editor, { entityType: 'post', entityId: saved.id, label: saved.title, action });

	const future = nowLive && values.publishedAt && values.publishedAt.getTime() > Date.now();
	let message: string;
	if (!nowLive) message = id && wasPublished ? 'Moved back to drafts. It leaves the blog within a minute.' : 'Draft saved.';
	else if (future) message = 'Scheduled. It goes live on its publish date.';
	else if (!wasPublished) message = 'Published. It shows on the blog within a minute.';
	else message = 'Post updated.';
	if (unfeatured) message += ` It replaces “${unfeatured}” as the featured post.`;

	return { ok: true, id: saved.id, slug: saved.slug, message };
}

/** Delete a post and log it. Returns its title, or null when it was already gone. */
export async function deletePost(editor: SessionEditor, id: string): Promise<string | null> {
	if (!isUuid(id)) return null;
	const [row] = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id, title: posts.title });
	if (!row) return null;
	await logActivity(editor, { entityType: 'post', entityId: row.id, label: row.title, action: 'deleted' });
	return row.title;
}
