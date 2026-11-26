import { fail, redirect } from '@sveltejs/kit';
import { desc, eq, like } from 'drizzle-orm';
import { readText } from '#lib/components/admin/form-data.ts';
import { LIMITS } from '#lib/components/admin/posts/post-fields.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { posts } from '#lib/server/db/schema.ts';
import { isUuid } from './posts.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireEditor(locals);
	const rows = await db
		.select({
			id: posts.id,
			slug: posts.slug,
			title: posts.title,
			category: posts.category,
			status: posts.status,
			authorName: posts.authorName,
			publishedAt: posts.publishedAt,
			updatedAt: posts.updatedAt,
			featured: posts.featured
		})
		.from(posts)
		.orderBy(desc(posts.updatedAt));
	return { posts: rows, now: new Date() };
};

/** `slug-copy`, `slug-copy-2`, ... the first one no post uses. */
async function copySlug(slug: string): Promise<string> {
	const base = `${slug.slice(0, LIMITS.slug - 8).replace(/-+$/, '')}-copy`;
	const used = new Set(
		(await db.select({ slug: posts.slug }).from(posts).where(like(posts.slug, `${base}%`))).map((r) => r.slug)
	);
	if (!used.has(base)) return base;
	for (let n = 2; n < 1000; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
	return `${base}-${Date.now()}`;
}

export const actions = {
	/** A draft copy of a post (title, body, cover, tags...), opened in the editor. */
	duplicate: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const id = readText(await request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'Choose a post to copy.' });
		const [source] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
		if (!source) return fail(404, { message: 'That post no longer exists.' });

		const title = `Copy of ${source.title}`.slice(0, LIMITS.title);
		const [created] = await db
			.insert(posts)
			.values({
				slug: await copySlug(source.slug),
				title,
				excerpt: source.excerpt,
				body: source.body,
				category: source.category,
				authorName: source.authorName,
				status: 'draft',
				publishedAt: null,
				coverUrl: source.coverUrl,
				coverAlt: source.coverAlt,
				coverCaption: source.coverCaption,
				tags: source.tags,
				projectId: source.projectId,
				featured: false,
				updatedBy: editor.email
			})
			.returning({ id: posts.id });
		await logActivity(editor, { entityType: 'post', entityId: created.id, label: title, action: 'created' });
		redirect(303, `/admin/posts/${created.id}`);
	}
} satisfies Actions;
