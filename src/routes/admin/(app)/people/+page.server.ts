import { fail } from '@sveltejs/kit';
import { readJson, readText } from '#lib/components/admin/form-data.ts';
import { describeDiff } from '#lib/components/admin/lists/rows.ts';
import { isUuid, validatePerson, validateTeams, type TeamDraft } from '#lib/components/admin/people/person-form.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import {
	createPerson,
	deletePerson,
	listPeople,
	listTeams,
	movePerson,
	readPersonDraft,
	saveTeams,
	teamIds,
	updatePerson
} from './people.server.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireEditor(locals);
	const [teamRows, peopleRows] = await Promise.all([listTeams(), listPeople()]);
	return { teams: teamRows, people: peopleRows };
};

export const actions = {
	/** Add a person (no `id`) or save one. */
	save: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const draft = readPersonDraft(form);
		if (draft.id && !isUuid(draft.id)) return fail(400, { message: 'Reload the page and try again.', errors: {} });

		const { values, errors } = validatePerson(draft, await teamIds());
		if (Object.keys(errors).length) {
			return fail(400, { message: errors.teamId ?? 'Check the highlighted fields.', errors });
		}

		if (draft.id) {
			const found = await updatePerson(draft.id, values);
			if (!found) return fail(404, { message: 'This person was removed. Close the panel and reload the page.', errors: {} });
			await logActivity(editor, { entityType: 'person', entityId: draft.id, label: values.name, action: 'updated' });
			return { message: `${values.name} saved.`, id: draft.id };
		}
		const id = await createPerson(values);
		await logActivity(editor, { entityType: 'person', entityId: id, label: values.name, action: 'created' });
		return { message: `${values.name} added.`, id };
	},

	delete: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const id = readText(form, 'id', { max: 60 });
		if (!isUuid(id)) return fail(400, { message: 'Pick a person to remove.' });
		const name = await deletePerson(id);
		if (!name) return fail(404, { message: 'This person was already removed.' });
		await logActivity(editor, { entityType: 'person', entityId: id, label: name, action: 'deleted' });
		return { message: `${name} removed. They leave the site within a minute.`, deleted: id };
	},

	/** Move a person one place within their team (or the advisors, or the alumni): `target=<id>:up`. */
	move: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const [id, direction] = readText(form, 'target', { max: 80 }).split(':');
		if (!isUuid(id) || (direction !== 'up' && direction !== 'down')) {
			return fail(400, { message: 'Pick a person to move.' });
		}
		const result = await movePerson(id, direction);
		if (!result) return fail(404, { message: 'That person no longer exists. Reload the page.' });
		if (!result.moved) {
			return { message: `${result.name} is already at the ${direction === 'up' ? 'top' : 'bottom'}.`, moved: id, direction };
		}
		await logActivity(editor, { entityType: 'person', entityId: id, label: result.name, action: `moved ${direction}` });
		return { message: `${result.name} moved ${direction}.`, moved: id, direction };
	},

	/** The Manage teams dialog: the whole list as JSON in `teams` ({ id, name } in order). */
	teams: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const raw = readJson<unknown>(form, 'teams', null);
		if (!Array.isArray(raw) || raw.some((row) => !row || typeof row !== 'object')) {
			return fail(400, { message: 'The teams could not be read. Reload the page and try again.', errors: {} });
		}
		const drafts: TeamDraft[] = raw.map((row: Record<string, unknown>) => ({
			id: typeof row.id === 'string' ? row.id : '',
			name: typeof row.name === 'string' ? row.name.slice(0, 400) : ''
		}));
		const { values, errors, message } = validateTeams(drafts);
		if (message) return fail(400, { message, errors });
		if (Object.keys(errors).length) return fail(400, { message: 'Check the highlighted team names.', errors });

		const result = await saveTeams(values);
		if (!result.ok) return fail(result.status, { message: result.message, errors: {} });
		const { diff, insertedIds, before } = result;
		const changes = describeDiff(diff);
		if (!changes) return { message: 'No changes to the teams.' };

		const single = (i: number, e: number, d: number) =>
			diff.inserts.length === i && diff.edited.length === e && diff.deletes.length === d && !diff.reordered;
		if (single(1, 0, 0)) {
			await logActivity(editor, { entityType: 'team', entityId: insertedIds[0], label: diff.inserts[0].name, action: 'created' });
		} else if (single(0, 1, 0)) {
			const team = diff.updates.find((u) => u.id === diff.edited[0]);
			const label = team ? `${before.get(team.id) ?? 'Team'} → ${team.name}` : 'Teams';
			await logActivity(editor, { entityType: 'team', entityId: team?.id ?? null, label, action: 'renamed' });
		} else if (single(0, 0, 1)) {
			const id = diff.deletes[0];
			await logActivity(editor, { entityType: 'team', entityId: id, label: before.get(id) ?? 'Team', action: 'deleted' });
		} else {
			await logActivity(editor, { entityType: 'team', label: `Teams · ${changes}`, action: 'updated' });
		}
		return { message: `Teams saved: ${changes}.` };
	}
} satisfies Actions;
