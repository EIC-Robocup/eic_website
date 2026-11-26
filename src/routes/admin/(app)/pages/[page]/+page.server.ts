import { error, fail } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import {
	PAGE_KEYS,
	cleanSectionInput,
	getSectionDef,
	isPageKey,
	pages,
	resolveSection,
	type PageKey,
	type SectionDef
} from '#lib/content/sections.ts';
import { readJson, readText } from '#lib/components/admin/form-data.ts';
import {
	stableStringify,
	validateSection,
	type SectionDraft
} from '#lib/components/admin/sections/values.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { getPageSections } from '#lib/server/content.ts';
import { db } from '#lib/server/db/index.ts';
import { editors, siteSections } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

function pageKeyOr404(value: string): PageKey {
	if (!isPageKey(value)) error(404, 'There is no page with that name.');
	return value;
}

const sectionDefs = (page: PageKey) => pages[page].sections as Record<string, SectionDef>;

/** "Home · Hero", the label used in Recent edits. */
const activityLabel = (page: PageKey, def: SectionDef) => `${pages[page].title} · ${def.title}`;

export const load: PageServerLoad = async ({ locals, params }) => {
	requireEditor(locals);
	const page = pageKeyOr404(params.page);

	const [resolved, rows] = await Promise.all([
		getPageSections(page),
		db
			.select({
				key: siteSections.key,
				updatedAt: siteSections.updatedAt,
				updatedBy: siteSections.updatedBy,
				editorName: editors.name
			})
			.from(siteSections)
			.leftJoin(editors, eq(editors.email, siteSections.updatedBy))
			.where(eq(siteSections.page, page))
	]);

	const defs = sectionDefs(page);
	const values: Record<string, SectionDraft> = {};
	for (const key of Object.keys(defs)) {
		const section = (resolved as Record<string, SectionDraft>)[key];
		values[key] = { enabled: section.enabled, data: section.data };
	}

	const saved: Record<string, { updatedAt: Date; updatedBy: string | null }> = {};
	let lastSaved: Date | null = null;
	for (const row of rows) {
		if (!Object.hasOwn(defs, row.key)) continue;
		saved[row.key] = { updatedAt: row.updatedAt, updatedBy: row.editorName || row.updatedBy };
		if (!lastSaved || row.updatedAt > lastSaved) lastSaved = row.updatedAt;
	}

	return {
		page,
		values,
		saved,
		lastSaved,
		pageList: PAGE_KEYS.map((key) => ({
			key,
			title: pages[key].title,
			sections: Object.keys(pages[key].sections).length
		})),
		now: new Date()
	};
};

export const actions = {
	/** Save every changed section of the page (one hidden JSON field per section). */
	publish: async ({ locals, params, request }) => {
		const editor = requireEditor(locals);
		const page = pageKeyOr404(params.page);
		const form = await request.formData();
		const defs = sectionDefs(page);

		const errors: Record<string, string> = {};
		const submitted: { key: string; def: SectionDef; data: Record<string, unknown>; enabled: boolean }[] = [];

		for (const [key, def] of Object.entries(defs)) {
			if (form.get(`section.${key}`) === null) continue; // not sent: leave it as it is
			const draft = readJson<Partial<SectionDraft>>(form, `section.${key}`);
			if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
				errors[key] = 'This section could not be read. Reload the page and try again.';
				continue;
			}
			for (const [path, message] of Object.entries(validateSection(def, draft.data))) {
				errors[`${key}.${path}`] = message;
			}
			submitted.push({
				key,
				def,
				data: cleanSectionInput(def, draft.data),
				enabled: def.toggleable ? draft.enabled !== false : true
			});
		}

		if (Object.keys(errors).length) {
			const count = Object.keys(errors).length;
			return fail(400, {
				message: count === 1 ? 'One field needs a fix before publishing.' : `${count} fields need a fix before publishing.`,
				errors
			});
		}
		if (!submitted.length) return fail(400, { message: 'Nothing was sent. Reload the page and try again.' });

		const existing = await db
			.select({ key: siteSections.key, data: siteSections.data, enabled: siteSections.enabled })
			.from(siteSections)
			.where(
				and(
					eq(siteSections.page, page),
					inArray(
						siteSections.key,
						submitted.map((s) => s.key)
					)
				)
			);
		const saved = new Map(existing.map((row) => [row.key, row]));

		// Only sections that differ from what the site shows now. A section still on its
		// default copy gets no row, so later changes to the defaults reach it.
		const changed = submitted.filter(({ key, def, data, enabled }) => {
			const current = resolveSection(def, saved.get(key) ?? null);
			return stableStringify(current.data) !== stableStringify(data) || current.enabled !== enabled;
		});
		if (!changed.length) return { message: 'Nothing to publish: the page already shows these changes.' };

		const now = new Date();
		await db.transaction(async (tx) => {
			for (const { key, data, enabled } of changed) {
				await tx
					.insert(siteSections)
					.values({ page, key, data, enabled, updatedBy: editor.email, updatedAt: now })
					.onConflictDoUpdate({
						target: [siteSections.page, siteSections.key],
						set: { data, enabled, updatedBy: editor.email, updatedAt: now }
					});
			}
		});

		for (const { key, def } of changed) {
			await logActivity(editor, {
				entityType: 'page',
				entityId: `${page}.${key}`,
				label: activityLabel(page, def),
				action: 'updated'
			});
		}

		const names = changed.map((s) => s.def.title);
		return {
			message:
				names.length === 1
					? `Published. ${names[0]} is live.`
					: `Published ${names.length} sections. They are live now.`
		};
	},

	/** Delete a section's saved row so the page shows the default copy again. */
	reset: async ({ locals, params, request }) => {
		const editor = requireEditor(locals);
		const page = pageKeyOr404(params.page);
		const form = await request.formData();
		const key = readText(form, 'id', { max: 100 });
		const def = getSectionDef(page, key);
		if (!def) return fail(400, { message: 'That section does not exist on this page.' });

		const deleted = await db
			.delete(siteSections)
			.where(and(eq(siteSections.page, page), eq(siteSections.key, key)))
			.returning({ key: siteSections.key });
		if (!deleted.length) return { message: `${def.title} already shows the default copy.` };

		await logActivity(editor, {
			entityType: 'page',
			entityId: `${page}.${key}`,
			label: activityLabel(page, def),
			action: 'reset'
		});
		return { message: `${def.title} is back to the default copy.` };
	}
} satisfies Actions;
