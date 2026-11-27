import { fail, redirect } from '@sveltejs/kit';
import { blankDraft, validateProject } from '#lib/components/admin/projects/project-form.ts';
import { currentYear } from '#lib/components/site/format.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import {
	createProject,
	featuredOther,
	isUniqueViolation,
	readProjectInput,
	slugTaken,
	takenSlugs
} from '../projects.server.ts';
import type { Actions, PageServerLoad } from './$types';

const SLUG_TAKEN = 'Another project already uses this address. Pick another one.';

export const load: PageServerLoad = async ({ locals }) => {
	requireEditor(locals);
	const [slugs, featured] = await Promise.all([takenSlugs(null), featuredOther(null)]);
	return { project: blankDraft(currentYear()), takenSlugs: slugs, featuredOther: featured };
};

export const actions = {
	create: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const { values, errors } = validateProject(readProjectInput(form));
		if (!errors.slug && (await slugTaken(values.slug, null))) errors.slug = SLUG_TAKEN;
		if (Object.keys(errors).length) return fail(400, { message: 'Check the highlighted fields.', errors });

		let id: string;
		try {
			id = await createProject(values);
		} catch (err) {
			if (isUniqueViolation(err)) {
				return fail(400, { message: 'Check the highlighted fields.', errors: { slug: SLUG_TAKEN } });
			}
			throw err;
		}
		await logActivity(editor, { entityType: 'project', entityId: id, label: values.title, action: 'created' });
		redirect(303, `/admin/projects/${id}`);
	}
} satisfies Actions;
