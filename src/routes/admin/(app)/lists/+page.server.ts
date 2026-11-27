import { fail } from '@sveltejs/kit';
import { readJson } from '#lib/components/admin/form-data.ts';
import { describeDiff, type ListKey } from '#lib/components/admin/lists/rows.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { getPageSections } from '#lib/server/content.ts';
import { LIST_META, loadLists, saveList } from './lists.server.ts';
import type { Actions, PageServerLoad } from './$types';

/** Whether each list's section is switched on on its public page (null when unknown). */
async function sectionsShown(): Promise<Record<ListKey, boolean | null>> {
	try {
		const [about, projects] = await Promise.all([getPageSections('about'), getPageSections('projects')]);
		return {
			achievements: about.achievements.enabled,
			archive: about.archive.enabled,
			sponsors: about.sponsors.enabled,
			publications: projects.publications.enabled
		};
	} catch (err) {
		console.error('Lists: could not read the page sections', err);
		return { achievements: null, archive: null, sponsors: null, publications: null };
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	requireEditor(locals);
	const [lists, shown] = await Promise.all([loadLists(), sectionsShown()]);
	return { lists, shown };
};

/** Save one list: the form submits the whole list as JSON in `rows`. */
async function saveAction(list: ListKey, { request, locals }: { request: Request; locals: App.Locals }) {
	const editor = requireEditor(locals);
	const form = await request.formData();
	const raw = form.get('rows');
	if (typeof raw === 'string' && raw.length > 500_000) {
		return fail(413, { message: 'That list is too long to save at once.', errors: {}, list });
	}
	const result = await saveList(list, readJson(form, 'rows', undefined));
	if (!result.ok) return fail(result.status, { message: result.message, errors: result.errors ?? {}, list });

	const meta = LIST_META[list];
	if (!result.changed) return { message: `No changes to the ${meta.title.toLowerCase()}.`, list };
	if (result.activity) await logActivity(editor, { entityType: meta.entityType, ...result.activity });
	return { message: `${meta.title} saved: ${describeDiff(result.diff)}.`, list };
}

export const actions = {
	achievements: (event) => saveAction('achievements', event),
	archive: (event) => saveAction('archive', event),
	sponsors: (event) => saveAction('sponsors', event),
	publications: (event) => saveAction('publications', event)
} satisfies Actions;
