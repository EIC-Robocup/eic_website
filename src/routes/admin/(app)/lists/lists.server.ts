/**
 * Server side of the Lists admin: reading the four lists for the editor, and saving one list
 * at a time ("Save" diffs the submitted rows against the database in one transaction).
 */
import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
	VALIDATORS,
	coerceRows,
	describeDiff,
	diffRows,
	hasChanges,
	type Diff,
	type Errors,
	type ListKey,
	type ListRows,
	type ListValues
} from '#lib/components/admin/lists/rows.ts';
import { db } from '#lib/server/db/index.ts';
import { achievements, archivePhotos, publications, sponsors } from '#lib/server/db/schema.ts';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Runner = Tx | typeof db;

const s = (value: string | null | undefined) => value ?? '';
const n = (value: number | null | undefined) => (value == null ? '' : String(value));

/** The current rows in their saved order, with the same keys as the validated values. */
const READERS: { [K in ListKey]: (runner: Runner) => Promise<(ListValues[K] & { id: string })[]> } = {
	achievements: (r) =>
		r
			.select({
				id: achievements.id,
				year: achievements.year,
				placement: achievements.placement,
				entrants: achievements.entrants,
				competition: achievements.competition,
				shortName: achievements.shortName,
				location: achievements.location,
				sortOrder: achievements.sortOrder
			})
			.from(achievements)
			// Newest first, as the editor shows them; the timeline reads oldest first.
			.orderBy(desc(achievements.year), asc(achievements.sortOrder), asc(achievements.createdAt)),
	archive: (r) =>
		r
			.select({
				id: archivePhotos.id,
				imageUrl: archivePhotos.imageUrl,
				alt: archivePhotos.alt,
				caption: archivePhotos.caption,
				sortOrder: archivePhotos.sortOrder
			})
			.from(archivePhotos)
			.orderBy(asc(archivePhotos.sortOrder), asc(archivePhotos.createdAt)),
	sponsors: (r) =>
		r
			.select({
				id: sponsors.id,
				name: sponsors.name,
				logoUrl: sponsors.logoUrl,
				url: sponsors.url,
				sortOrder: sponsors.sortOrder
			})
			.from(sponsors)
			.orderBy(asc(sponsors.sortOrder), asc(sponsors.name)),
	publications: (r) =>
		r
			.select({
				id: publications.id,
				year: publications.year,
				title: publications.title,
				venue: publications.venue,
				authors: publications.authors,
				url: publications.url,
				sortOrder: publications.sortOrder
			})
			.from(publications)
			.orderBy(desc(publications.year), asc(publications.sortOrder), asc(publications.title))
};

const TO_ROW: { [K in ListKey]: (value: ListValues[K] & { id: string }) => ListRows[K] } = {
	achievements: (a) => ({
		id: a.id,
		year: n(a.year),
		placement: a.placement,
		entrants: n(a.entrants),
		competition: a.competition,
		shortName: s(a.shortName),
		location: s(a.location)
	}),
	archive: (p) => ({ id: p.id, imageUrl: p.imageUrl, alt: p.alt, caption: s(p.caption) }),
	sponsors: (sp) => ({ id: sp.id, name: sp.name, logoUrl: s(sp.logoUrl), url: s(sp.url) }),
	publications: (p) => ({
		id: p.id,
		year: n(p.year),
		title: p.title,
		venue: s(p.venue),
		authors: s(p.authors),
		url: s(p.url)
	})
};

async function readRows<K extends ListKey>(list: K): Promise<ListRows[K][]> {
	const rows = await READERS[list](db);
	return rows.map((row) => TO_ROW[list](row));
}

/** All four lists as the editor holds them (every field a string). */
export async function loadLists(): Promise<{ [K in ListKey]: ListRows[K][] }> {
	const [a, ar, sp, p] = await Promise.all([
		readRows('achievements'),
		readRows('archive'),
		readRows('sponsors'),
		readRows('publications')
	]);
	return { achievements: a, archive: ar, sponsors: sp, publications: p };
}

const TABLES: { [K in ListKey]: { table: PgTable; id: PgColumn } } = {
	achievements: { table: achievements, id: achievements.id },
	archive: { table: archivePhotos, id: archivePhotos.id },
	sponsors: { table: sponsors, id: sponsors.id },
	publications: { table: publications, id: publications.id }
};

/** How each list names itself in toasts and the dashboard's "Recent edits". */
export const LIST_META: {
	[K in ListKey]: {
		title: string;
		entityType: string;
		one: string;
		label: (value: Omit<ListValues[K], 'id'>) => string;
	};
} = {
	achievements: {
		title: 'Achievements',
		entityType: 'achievement',
		one: 'achievement',
		label: (a) => `${a.placement} · ${a.competition} ${a.year}`
	},
	archive: {
		title: 'Archive photos',
		entityType: 'archive',
		one: 'photo',
		label: (p) => p.caption || (p.alt.length > 60 ? `${p.alt.slice(0, 57)}...` : p.alt) || 'Archive photo'
	},
	sponsors: { title: 'Sponsors', entityType: 'sponsor', one: 'sponsor', label: (sp) => sp.name },
	publications: { title: 'Publications', entityType: 'publication', one: 'paper', label: (p) => p.title }
};

export type SaveResult =
	| { ok: false; status: number; message: string; errors?: Errors }
	| {
			ok: true;
			changed: boolean;
			diff: Diff<{ id: string | null }>;
			/** One activity entry: the single row that changed, or a summary of the list. */
			activity: { entityId: string | null; label: string; action: string } | null;
	  };

/** Validate the submitted JSON for one list and write what changed, in one transaction. */
export async function saveList<K extends ListKey>(list: K, raw: unknown): Promise<SaveResult> {
	const meta = LIST_META[list];
	const rows = coerceRows(list, raw);
	if (!rows) return { ok: false, status: 400, message: 'The list could not be read. Reload the page and try again.' };

	const { values, errors, message } = VALIDATORS[list](rows);
	if (message) return { ok: false, status: 400, message, errors };
	if (Object.keys(errors).length) return { ok: false, status: 400, message: 'Check the highlighted fields.', errors };

	const { table, id } = TABLES[list];
	return db.transaction(async (tx): Promise<SaveResult> => {
		const existing = await READERS[list](tx);
		const diff = diffRows(existing, values);
		if (diff.missing.length) {
			return {
				ok: false,
				status: 409,
				message: `Someone else changed the ${meta.title.toLowerCase()} while you were editing. Reload the page to see the latest list.`
			};
		}
		if (!hasChanges(diff)) return { ok: true, changed: false, diff, activity: null };

		if (diff.deletes.length) await tx.delete(table).where(inArray(id, diff.deletes));
		for (const { id: rowId, ...set } of diff.updates) {
			await tx.update(table).set(set as never).where(eq(id, rowId));
		}
		let insertedIds: string[] = [];
		if (diff.inserts.length) {
			const inserted = (await tx.insert(table).values(diff.inserts as never).returning({ id })) as { id: string }[];
			insertedIds = inserted.map((row) => row.id);
		}

		return { ok: true, changed: true, diff, activity: describeActivity(list, diff, existing, insertedIds) };
	});
}

function describeActivity<K extends ListKey>(
	list: K,
	diff: Diff<ListValues[K]>,
	existing: (ListValues[K] & { id: string })[],
	insertedIds: string[]
): { entityId: string | null; label: string; action: string } {
	const meta = LIST_META[list];
	const single = (inserts: number, edited: number, deletes: number) =>
		diff.inserts.length === inserts && diff.edited.length === edited && diff.deletes.length === deletes && !diff.reordered;

	if (single(1, 0, 0)) return { entityId: insertedIds[0] ?? null, label: meta.label(diff.inserts[0]), action: 'created' };
	if (single(0, 0, 1)) {
		const gone = existing.find((e) => e.id === diff.deletes[0]);
		return { entityId: diff.deletes[0], label: gone ? meta.label(gone) : meta.title, action: 'deleted' };
	}
	if (single(0, 1, 0)) {
		const edited = diff.updates.find((u) => u.id === diff.edited[0]);
		if (edited) return { entityId: edited.id, label: meta.label(edited), action: 'updated' };
	}
	return { entityId: null, label: `${meta.title} · ${describeDiff(diff)}`, action: 'updated' };
}
