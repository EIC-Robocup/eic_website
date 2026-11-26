import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { readText } from '#lib/components/admin/form-data.ts';
import { draftFrom, validateProject } from '#lib/components/admin/projects/project-form.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { projects } from '#lib/server/db/schema.ts';
import { setFlash } from '../flash.ts';
import {
	countLinkedPosts,
	featuredOther,
	isUniqueViolation,
	isUuid,
	readProjectInput,
	slugTaken,
	takenSlugs,
	updateProject
} from '../projects.server.ts';
import type { Actions, PageServerLoad } from './$types';

const SLUG_TAKEN = 'Another project already uses this address. Pick another one.';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireEditor(locals);
	if (!isUuid(params.id)) error(404, 'Project not found');

	const [row] = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);
	if (!row) error(404, 'Project not found');

	const [slugs, featured, linkedPosts] = await Promise.all([
		takenSlugs(row.id),
		featuredOther(row.id),
		countLinkedPosts(row.id)
	]);

	return {
		id: row.id,
		project: draftFrom(row),
		saved: { slug: row.slug, title: row.title, published: row.published, featured: row.featured },
		updatedAt: row.updatedAt,
		takenSlugs: slugs,
		featuredOther: featured,
		linkedPosts,
		now: new Date()
	};
};

export const actions = {
	save: async ({ request, locals, params }) => {
		const editor = requireEditor(locals);
		if (!isUuid(params.id)) error(404, 'Project not found');
		const form = await request.formData();
		const { values, errors } = validateProject(readProjectInput(form));
		if (!errors.slug && (await slugTaken(values.slug, params.id))) errors.slug = SLUG_TAKEN;
		if (Object.keys(errors).length) return fail(400, { message: 'Check the highlighted fields.', errors });

		let found: boolean;
		try {
			found = await updateProject(params.id, values);
		} catch (err) {
			if (isUniqueViolation(err)) {
				return fail(400, { message: 'Check the highlighted fields.', errors: { slug: SLUG_TAKEN } });
			}
			throw err;
		}
		if (!found) error(404, 'This project was deleted. Copy what you need, then go back to Projects.');

		await logActivity(editor, { entityType: 'project', entityId: params.id, label: values.title, action: 'updated' });
		return { message: 'Project saved.' };
	},

	delete: async ({ request, locals, params, cookies }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const id = readText(form, 'id', { max: 60 });
		if (!isUuid(params.id) || id !== params.id) return fail(400, { message: 'Pick the project to delete.' });

		const linked = await countLinkedPosts(id);
		// Posts keep existing: the foreign key sets their project_id to null.
		const [row] = await db.delete(projects).where(eq(projects.id, id)).returning({ title: projects.title });
		if (!row) return fail(404, { message: 'That project was already deleted.' });

		await logActivity(editor, { entityType: 'project', entityId: id, label: row.title, action: 'deleted' });
		const posts = linked === 1 ? 'Its post stays on the blog.' : linked > 1 ? `Its ${linked} posts stay on the blog.` : '';
		setFlash(cookies, `${row.title} deleted. ${posts}`.trim());
		redirect(303, '/admin/projects');
	}
} satisfies Actions;
