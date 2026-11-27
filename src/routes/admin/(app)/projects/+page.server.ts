import { fail } from '@sveltejs/kit';
import { readText } from '#lib/components/admin/form-data.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { projects } from '#lib/server/db/schema.ts';
import { FLASH_COOKIE } from './flash.ts';
import { isUuid, moveProject, projectOrder, setFeatured } from './projects.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	requireEditor(locals);

	const rows = await db
		.select({
			id: projects.id,
			slug: projects.slug,
			title: projects.title,
			category: projects.category,
			year: projects.year,
			yearEnd: projects.yearEnd,
			status: projects.status,
			event: projects.event,
			tags: projects.tags,
			coverUrl: projects.coverUrl,
			coverAlt: projects.coverAlt,
			published: projects.published,
			featured: projects.featured,
			updatedAt: projects.updatedAt
		})
		.from(projects)
		.orderBy(...projectOrder);

	// A message from an action that redirected here (e.g. "Walkie 3 deleted.").
	const flash = cookies.get(FLASH_COOKIE) ?? null;
	if (flash) cookies.delete(FLASH_COOKIE, { path: '/admin' });

	return { projects: rows, flash, now: new Date() };
};

export const actions = {
	/** Move a project one place up or down: `target=<id>:up` or `<id>:down`. */
	move: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const [id, direction] = readText(form, 'target', { max: 60 }).split(':');
		if (!isUuid(id) || (direction !== 'up' && direction !== 'down')) {
			return fail(400, { message: 'Pick a project to move.' });
		}
		const result = await moveProject(id, direction);
		if (!result) return fail(404, { message: 'That project no longer exists. Reload the page.' });
		if (!result.moved) {
			return { message: `${result.title} is already at the ${direction === 'up' ? 'top' : 'bottom'}.` };
		}
		await logActivity(editor, { entityType: 'project', entityId: id, label: result.title, action: `moved ${direction}` });
		return { message: `${result.title} moved ${direction}.`, moved: id, direction };
	},

	/** Feature a project on the home page (only one at a time) or stop: `target=<id>:on` or `<id>:off`. */
	feature: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const [id, state] = readText(form, 'target', { max: 60 }).split(':');
		if (!isUuid(id) || (state !== 'on' && state !== 'off')) return fail(400, { message: 'Pick a project to feature.' });
		const featured = state === 'on';
		const title = await setFeatured(id, featured);
		if (!title) return fail(404, { message: 'That project no longer exists. Reload the page.' });
		await logActivity(editor, { entityType: 'project', entityId: id, label: title, action: featured ? 'featured' : 'unfeatured' });
		return {
			message: featured
				? `${title} is now the featured project. It shows on the home page within a minute.`
				: `${title} is no longer featured.`,
			featured: id
		};
	}
} satisfies Actions;
