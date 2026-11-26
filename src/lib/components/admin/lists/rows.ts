/**
 * The About page lists (achievements, archive photos, sponsors) and the Projects page
 * publications, as the admin Lists editor holds them: every field a string, so inputs can bind
 * to them. Client safe: the same checks run in the browser before saving and in the actions.
 *
 *     const { values, errors } = validateAchievements(rows);   // errors: { 'achievements.2.year': '...' }
 *     const diff = diffRows(existing, values);                 // inserts, updates, deletes
 */
import { isSafeUrl } from '../form-data.ts';

export type Errors = Record<string, string>;

export const LIST_KEYS = ['achievements', 'archive', 'sponsors', 'publications'] as const;
export type ListKey = (typeof LIST_KEYS)[number];

/** Most rows each list keeps. */
export const LIST_MAX: Record<ListKey, number> = {
	achievements: 200,
	archive: 40,
	sponsors: 60,
	publications: 200
};

/** Longest values each field keeps. */
export const MAX = {
	placement: 40,
	competition: 200,
	shortName: 40,
	location: 120,
	alt: 300,
	caption: 80,
	name: 120,
	title: 400,
	venue: 200,
	authors: 600,
	url: 2000
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID.test(value);
}

/* ------------------------------------------------------------------------------------------ */
/* Rows as the editor holds them                                                              */
/* ------------------------------------------------------------------------------------------ */

/** `id` is '' for a row that is not saved yet. */
export type AchievementRow = {
	id: string;
	year: string;
	placement: string;
	entrants: string;
	competition: string;
	shortName: string;
	location: string;
};

export type ArchiveRow = { id: string; imageUrl: string; alt: string; caption: string };

export type SponsorRow = { id: string; name: string; logoUrl: string; url: string };

export type PublicationRow = {
	id: string;
	year: string;
	title: string;
	venue: string;
	authors: string;
	url: string;
};

export type ListRows = {
	achievements: AchievementRow;
	archive: ArchiveRow;
	sponsors: SponsorRow;
	publications: PublicationRow;
};

const FIELDS = {
	achievements: ['id', 'year', 'placement', 'entrants', 'competition', 'shortName', 'location'],
	archive: ['id', 'imageUrl', 'alt', 'caption'],
	sponsors: ['id', 'name', 'logoUrl', 'url'],
	publications: ['id', 'year', 'title', 'venue', 'authors', 'url']
} as const satisfies { [K in ListKey]: readonly (keyof ListRows[K])[] };

/** A new, empty row. */
export function emptyRow<K extends ListKey>(list: K): ListRows[K] {
	return Object.fromEntries(FIELDS[list].map((key) => [key, ''])) as ListRows[K];
}

/**
 * Rows from submitted JSON (or the editor's state) with only the list's keys, as strings.
 * Returns null when the value is not an array of objects.
 */
export function coerceRows<K extends ListKey>(list: K, raw: unknown): ListRows[K][] | null {
	if (!Array.isArray(raw)) return null;
	const rows: ListRows[K][] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
		const row: Record<string, string> = {};
		for (const key of FIELDS[list]) {
			const value = (item as Record<string, unknown>)[key];
			row[key] = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
		}
		rows.push(row as ListRows[K]);
	}
	return rows;
}

/** The rows with every value trimmed: what "unsaved changes" compares. */
export function normalizeRows<K extends ListKey>(list: K, rows: readonly ListRows[K][]): string {
	return JSON.stringify(
		rows.map((row) => FIELDS[list].map((key) => String((row as Record<string, unknown>)[key] ?? '').trim()))
	);
}

/* ------------------------------------------------------------------------------------------ */
/* Validation                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/** Values ready for the database, in the order they are shown. `id` is null for new rows. */
export type AchievementValues = {
	id: string | null;
	year: number;
	placement: string;
	entrants: number | null;
	competition: string;
	shortName: string | null;
	location: string | null;
	sortOrder: number;
};

export type ArchiveValues = { id: string | null; imageUrl: string; alt: string; caption: string | null; sortOrder: number };

export type SponsorValues = { id: string | null; name: string; logoUrl: string | null; url: string | null; sortOrder: number };

export type PublicationValues = {
	id: string | null;
	year: number;
	title: string;
	venue: string | null;
	authors: string | null;
	url: string | null;
	sortOrder: number;
};

export type ListValues = {
	achievements: AchievementValues;
	archive: ArchiveValues;
	sponsors: SponsorValues;
	publications: PublicationValues;
};

export type Validated<V> = { values: V[]; errors: Errors; message?: string };

const tooLong = (max: number) => `Keep this under ${max} characters.`;
const LINK_ERROR = 'Use a link that starts with https://, or a site path such as /papers/...';
const IMAGE_ERROR = 'Use an https:// link or a site path such as /images/..., or upload the image.';

/** The latest year anything can be dated: next year (for announced competitions). */
export function latestYear(now = new Date()): number {
	return now.getFullYear() + 1;
}

function checkYear(value: string, path: string, errors: Errors): number {
	if (!value) {
		errors[path] = 'Add the year.';
		return 0;
	}
	const year = /^\d{4}$/.test(value) ? Number(value) : Number.NaN;
	if (!Number.isInteger(year) || year < 1950 || year > latestYear()) {
		errors[path] = `Use a year from 1950 to ${latestYear()}.`;
		return 0;
	}
	return year;
}

function checkText(value: string, max: number, path: string, errors: Errors, required?: string): string {
	if (!value && required) errors[path] = required;
	else if (value.length > max) errors[path] = tooLong(max);
	return value;
}

function checkUrl(value: string, path: string, errors: Errors, message = LINK_ERROR): string | null {
	if (!value) return null;
	if (value.length > MAX.url) errors[path] = tooLong(MAX.url);
	else if (!isSafeUrl(value) || /\s/.test(value)) errors[path] = message;
	return value;
}

function checkId(value: string, path: string, errors: Errors, seen: Set<string>): string | null {
	if (!value) return null;
	if (!isUuid(value) || seen.has(value)) {
		errors[path] = 'Reload the page and try again.';
		return null;
	}
	seen.add(value);
	return value;
}

function checkCount(list: ListKey, count: number): string | undefined {
	return count > LIST_MAX[list] ? `Keep the list to ${LIST_MAX[list]} entries or fewer.` : undefined;
}

const t = (value: string) => value.trim();

/**
 * Newest year first; rows of the same year keep the order the editor gave them. The public
 * pages sort by year too, so `sortOrder` only decides the order within a year.
 */
function newestFirst<V extends { year: number; sortOrder: number }>(values: V[]): V[] {
	return values
		.map((value, index) => ({ value, index }))
		.sort((a, b) => b.value.year - a.value.year || a.index - b.index)
		.map(({ value }, index) => ({ ...value, sortOrder: index }));
}

export function validateAchievements(rows: readonly AchievementRow[]): Validated<AchievementValues> {
	const errors: Errors = {};
	const seen = new Set<string>();
	const values = rows.map((row, i): AchievementValues => {
		const p = (key: string) => `achievements.${i}.${key}`;
		const entrantsText = t(row.entrants);
		let entrants: number | null = null;
		if (entrantsText) {
			entrants = /^\d{1,5}$/.test(entrantsText) ? Number(entrantsText) : Number.NaN;
			if (!Number.isInteger(entrants) || entrants < 1) errors[p('entrants')] = 'Use the number of teams, such as 24.';
		}
		return {
			id: checkId(t(row.id), p('id'), errors, seen),
			year: checkYear(t(row.year), p('year'), errors),
			placement: checkText(t(row.placement), MAX.placement, p('placement'), errors, 'Add the place, such as 6th.'),
			entrants,
			competition: checkText(t(row.competition), MAX.competition, p('competition'), errors, 'Add the competition.'),
			shortName: checkText(t(row.shortName), MAX.shortName, p('shortName'), errors) || null,
			location: checkText(t(row.location), MAX.location, p('location'), errors) || null,
			sortOrder: 0
		};
	});
	return { values: newestFirst(values), errors, message: checkCount('achievements', rows.length) };
}

export function validateArchive(rows: readonly ArchiveRow[]): Validated<ArchiveValues> {
	const errors: Errors = {};
	const seen = new Set<string>();
	const values = rows.map((row, i): ArchiveValues => {
		const p = (key: string) => `archive.${i}.${key}`;
		const imageUrl = t(row.imageUrl);
		if (!imageUrl) errors[p('imageUrl')] = 'Upload the photo or paste a link.';
		else checkUrl(imageUrl, p('imageUrl'), errors, IMAGE_ERROR);
		return {
			id: checkId(t(row.id), p('id'), errors, seen),
			imageUrl,
			alt: checkText(t(row.alt), MAX.alt, p('alt'), errors, 'Describe the photo for people who can’t see it.'),
			caption: checkText(t(row.caption), MAX.caption, p('caption'), errors) || null,
			sortOrder: i
		};
	});
	return { values, errors, message: checkCount('archive', rows.length) };
}

export function validateSponsors(rows: readonly SponsorRow[]): Validated<SponsorValues> {
	const errors: Errors = {};
	const seen = new Set<string>();
	const values = rows.map((row, i): SponsorValues => {
		const p = (key: string) => `sponsors.${i}.${key}`;
		return {
			id: checkId(t(row.id), p('id'), errors, seen),
			name: checkText(t(row.name), MAX.name, p('name'), errors, 'Add the sponsor’s name.'),
			logoUrl: checkUrl(t(row.logoUrl), p('logoUrl'), errors, IMAGE_ERROR),
			url: checkUrl(t(row.url), p('url'), errors),
			sortOrder: i
		};
	});
	return { values, errors, message: checkCount('sponsors', rows.length) };
}

export function validatePublications(rows: readonly PublicationRow[]): Validated<PublicationValues> {
	const errors: Errors = {};
	const seen = new Set<string>();
	const values = rows.map((row, i): PublicationValues => {
		const p = (key: string) => `publications.${i}.${key}`;
		return {
			id: checkId(t(row.id), p('id'), errors, seen),
			year: checkYear(t(row.year), p('year'), errors),
			title: checkText(t(row.title).replace(/\s+/g, ' '), MAX.title, p('title'), errors, 'Add the title.'),
			venue: checkText(t(row.venue), MAX.venue, p('venue'), errors) || null,
			authors: checkText(t(row.authors), MAX.authors, p('authors'), errors) || null,
			url: checkUrl(t(row.url), p('url'), errors),
			sortOrder: 0
		};
	});
	return { values: newestFirst(values), errors, message: checkCount('publications', rows.length) };
}

export const VALIDATORS: { [K in ListKey]: (rows: readonly ListRows[K][]) => Validated<ListValues[K]> } = {
	achievements: validateAchievements,
	archive: validateArchive,
	sponsors: validateSponsors,
	publications: validatePublications
};

/* ------------------------------------------------------------------------------------------ */
/* Saving: what changed                                                                       */
/* ------------------------------------------------------------------------------------------ */

export type Diff<V extends { id: string | null }> = {
	inserts: Omit<V, 'id'>[];
	updates: (Omit<V, 'id'> & { id: string })[];
	deletes: string[];
	/** Submitted ids that are not in the database any more (someone else removed them). */
	missing: string[];
	/** Ids of the updates that change more than the position. */
	edited: string[];
	/** The rows that stay are in a different order (not just shifted by an insert or delete). */
	reordered: boolean;
};

function comparable(value: Record<string, unknown>, skip: readonly string[] = ['id']): string {
	return JSON.stringify(
		Object.keys(value)
			.filter((key) => !skip.includes(key))
			.sort()
			.map((key) => [key, value[key] ?? null])
	);
}

/**
 * Compare the submitted list with the rows in the database: rows without an id are inserted,
 * rows whose values changed are updated, and rows that are gone from the list are deleted.
 * `existing` holds the current rows with the same keys as the values.
 */
export function diffRows<V extends { id: string | null }>(existing: readonly (V & { id: string })[], next: readonly V[]): Diff<V> {
	const byId = new Map(existing.map((row) => [row.id, row]));
	const kept = new Set<string>();
	const diff: Diff<V> = { inserts: [], updates: [], deletes: [], missing: [], edited: [], reordered: false };
	const keptOrder: string[] = [];
	for (const row of next) {
		const { id, ...rest } = row;
		if (!id) {
			diff.inserts.push(rest);
			continue;
		}
		const current = byId.get(id);
		if (!current) {
			diff.missing.push(id);
			continue;
		}
		kept.add(id);
		keptOrder.push(id);
		if (comparable(rest) !== comparable(current)) {
			diff.updates.push({ ...rest, id });
			if (comparable(rest, ['id', 'sortOrder']) !== comparable(current, ['id', 'sortOrder'])) diff.edited.push(id);
		}
	}
	for (const row of existing) if (!kept.has(row.id)) diff.deletes.push(row.id);
	const before = existing.filter((row) => kept.has(row.id)).map((row) => row.id);
	diff.reordered = before.some((id, i) => keptOrder[i] !== id);
	return diff;
}

export function hasChanges(diff: Diff<{ id: string | null }>): boolean {
	return diff.inserts.length + diff.updates.length + diff.deletes.length > 0;
}

/** "2 added, 1 changed, 1 removed, reordered" (only the parts that happened). */
export function describeDiff(diff: Diff<{ id: string | null }>): string {
	return [
		diff.inserts.length && `${diff.inserts.length} added`,
		diff.edited.length && `${diff.edited.length} changed`,
		diff.deletes.length && `${diff.deletes.length} removed`,
		diff.reordered && 'reordered'
	]
		.filter(Boolean)
		.join(', ');
}
