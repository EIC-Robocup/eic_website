/**
 * The project editor's form: the draft the browser holds, the slug helper and one validator
 * that both the editor (live field errors, before sending) and the save/create actions (the
 * real check) run. Client safe: only type imports from the server schema.
 *
 *     const { values, errors } = validateProject(input);   // input: a ProjectDraft or what the form sent
 *
 * Error keys are the field names the editor uses: `title`, `slug`, `cover`, `paperUrl`, and
 * `systems.2.title`, `parts.0.part`, `gallery.3.alt` for rows (indexes as sent).
 */
import { isSafeUrl } from '#lib/components/admin/form-data.ts';
import { PROJECT_CATEGORY_LABELS, PROJECT_STATUS_LABELS } from '#lib/content/labels.ts';
import type {
	GalleryImage,
	ProjectCategory,
	ProjectPart,
	ProjectStatus,
	ProjectSystem
} from '#lib/server/db/schema.ts';

/** Longest values kept. Longer input is reported, never cut. */
export const LIMITS = {
	title: 120,
	slug: 80,
	tagline: 140,
	summary: 400,
	event: 120,
	place: 120,
	result: 120,
	highlightValue: 24,
	highlightLabel: 80,
	highlightNote: 60,
	alt: 300,
	caption: 200,
	url: 2000,
	tags: 12,
	tag: 40,
	software: 30,
	systems: 12,
	systemTitle: 80,
	systemDescription: 300,
	parts: 40,
	partQty: 12,
	partName: 120,
	partNote: 160,
	gallery: 24,
	teamSize: 999
} as const;

export const YEAR_MIN = 1950;
export const YEAR_MAX = 2100;

/** Lower case letters and digits in groups joined by single hyphens: `walkie-4`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A URL slug from a title. Empty when the title has no Latin letters or digits (e.g. Thai only). */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/['’]/g, '')
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, LIMITS.slug)
		.replace(/-+$/g, '');
}

/** What the editor holds while you type. Numbers stay strings until they are validated. */
export type ProjectDraft = {
	title: string;
	slug: string;
	category: string;
	status: string;
	year: string;
	yearEnd: string;
	tagline: string;
	summary: string;
	event: string;
	place: string;
	result: string;
	teamSize: string;
	highlightValue: string;
	highlightLabel: string;
	highlightNote: string;
	coverUrl: string;
	coverAlt: string;
	coverCaption: string;
	tags: string[];
	software: string[];
	systems: ProjectSystem[];
	parts: ProjectPart[];
	gallery: GalleryImage[];
	linkUrl: string;
	repoUrl: string;
	paperUrl: string;
	published: boolean;
	featured: boolean;
	showGallery: boolean;
};

/** What the action reads from the form. The lists are parsed JSON and checked row by row. */
export type ProjectInput = Omit<ProjectDraft, 'systems' | 'parts' | 'gallery'> & {
	systems: unknown;
	parts: unknown;
	gallery: unknown;
};

/** Clean values, ready for the projects table. */
export type ProjectValues = {
	title: string;
	slug: string;
	category: ProjectCategory;
	status: ProjectStatus;
	year: number | null;
	yearEnd: number | null;
	tagline: string | null;
	summary: string | null;
	event: string | null;
	place: string | null;
	result: string | null;
	teamSize: number | null;
	highlightValue: string | null;
	highlightLabel: string | null;
	highlightNote: string | null;
	coverUrl: string | null;
	coverAlt: string | null;
	coverCaption: string | null;
	tags: string[];
	software: string[];
	systems: ProjectSystem[];
	parts: ProjectPart[];
	gallery: GalleryImage[];
	linkUrl: string | null;
	repoUrl: string | null;
	paperUrl: string | null;
	published: boolean;
	featured: boolean;
	showGallery: boolean;
};

/** The columns the editor reads from a projects row. */
export type ProjectRow = {
	title: string;
	slug: string;
	category: string;
	status: string;
	year: number | null;
	yearEnd: number | null;
	tagline: string | null;
	summary: string | null;
	event: string | null;
	place: string | null;
	result: string | null;
	teamSize: number | null;
	highlightValue: string | null;
	highlightLabel: string | null;
	highlightNote: string | null;
	coverUrl: string | null;
	coverAlt: string | null;
	coverCaption: string | null;
	tags: string[];
	software: string[];
	systems: ProjectSystem[];
	parts: ProjectPart[];
	gallery: GalleryImage[];
	linkUrl: string | null;
	repoUrl: string | null;
	paperUrl: string | null;
	published: boolean;
	featured: boolean;
	showGallery: boolean;
};

const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

/** A draft from a stored project (or from defaults for a new one). */
export function draftFrom(row: ProjectRow): ProjectDraft {
	return {
		title: row.title,
		slug: row.slug,
		category: row.category,
		status: row.status,
		year: n(row.year),
		yearEnd: n(row.yearEnd),
		tagline: s(row.tagline),
		summary: s(row.summary),
		event: s(row.event),
		place: s(row.place),
		result: s(row.result),
		teamSize: n(row.teamSize),
		highlightValue: s(row.highlightValue),
		highlightLabel: s(row.highlightLabel),
		highlightNote: s(row.highlightNote),
		coverUrl: s(row.coverUrl),
		coverAlt: s(row.coverAlt),
		coverCaption: s(row.coverCaption),
		tags: [...(row.tags ?? [])],
		software: [...(row.software ?? [])],
		systems: (row.systems ?? []).map((x) => ({ title: s(x?.title), description: s(x?.description) })),
		parts: (row.parts ?? []).map((x) => ({ qty: s(x?.qty), part: s(x?.part), note: s(x?.note) })),
		gallery: (row.gallery ?? []).map((x) => ({ url: s(x?.url), alt: s(x?.alt), caption: s(x?.caption) })),
		linkUrl: s(row.linkUrl),
		repoUrl: s(row.repoUrl),
		paperUrl: s(row.paperUrl),
		published: row.published,
		featured: row.featured,
		showGallery: row.showGallery
	};
}

/** A blank project for /admin/projects/new: hidden until someone switches it on. */
export function blankDraft(year: number): ProjectDraft {
	return draftFrom({
		title: '',
		slug: '',
		category: 'robot',
		status: 'ongoing',
		year,
		yearEnd: null,
		tagline: null,
		summary: null,
		event: null,
		place: null,
		result: null,
		teamSize: null,
		highlightValue: null,
		highlightLabel: null,
		highlightNote: null,
		coverUrl: null,
		coverAlt: null,
		coverCaption: null,
		tags: [],
		software: [],
		systems: [],
		parts: [],
		gallery: [],
		linkUrl: null,
		repoUrl: null,
		paperUrl: null,
		published: false,
		featured: false,
		showGallery: true
	});
}

export const URL_ERROR = 'Use a link that starts with https://, or a site path such as /images/...';
const WEB_URL_ERROR = 'Use a link that starts with https://.';
const tooLong = (max: number) => `Keep this under ${max} characters.`;
const LIST_ERROR = 'This list could not be read. Reload the page and try again.';

/** One line of text: trimmed, line breaks turned into spaces. */
function line(value: unknown): string {
	return s(value).replace(/[\r\n]+/g, ' ').trim();
}

function isWebUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every key a string (or missing); anything else marks the row as unreadable. */
function stringFields<K extends string>(row: unknown, keys: readonly K[]): Record<K, string> | null {
	if (!isRecord(row)) return null;
	const out = {} as Record<K, string>;
	for (const key of keys) {
		const value = row[key];
		if (value !== undefined && value !== null && typeof value !== 'string') return null;
		out[key] = line(value);
	}
	return out;
}

/**
 * Check a project. Returns the clean values and the field errors (empty when it is fine).
 * Uniqueness of the slug is checked by the action (and live in the editor from `takenSlugs`).
 */
export function validateProject(input: ProjectInput): { values: ProjectValues; errors: Record<string, string> } {
	const errors: Record<string, string> = {};
	const text = (key: keyof typeof LIMITS & keyof ProjectInput, value: unknown, multiline = false) => {
		const clean = multiline ? s(value).trim() : line(value);
		if (clean.length > LIMITS[key]) errors[key] = tooLong(LIMITS[key]);
		return clean || null;
	};

	// Basics
	const title = line(input.title);
	if (!title) errors.title = 'Add a title.';
	else if (title.length > LIMITS.title) errors.title = tooLong(LIMITS.title);

	const slug = line(input.slug).toLowerCase();
	if (!slug) errors.slug = 'Add the page address, e.g. walkie-4.';
	else if (slug.length > LIMITS.slug) errors.slug = tooLong(LIMITS.slug);
	else if (!SLUG_PATTERN.test(slug)) errors.slug = 'Use lower case letters, numbers and single dashes, e.g. walkie-4.';

	const category = (Object.hasOwn(PROJECT_CATEGORY_LABELS, input.category) ? input.category : '') as ProjectCategory;
	if (!category) errors.category = 'Pick a category.';
	const status = (Object.hasOwn(PROJECT_STATUS_LABELS, input.status) ? input.status : '') as ProjectStatus;
	if (!status) errors.status = 'Pick a status.';

	const readYear = (key: 'year' | 'yearEnd'): number | null => {
		const raw = line(input[key]);
		if (!raw) return null;
		if (!/^\d{4}$/.test(raw) || Number(raw) < YEAR_MIN || Number(raw) > YEAR_MAX) {
			errors[key] = `Use a year such as 2026.`;
			return null;
		}
		return Number(raw);
	};
	const year = readYear('year');
	const yearEnd = readYear('yearEnd');
	if (yearEnd !== null && !errors.yearEnd) {
		if (year === null && !errors.year) errors.yearEnd = 'Add the first year too.';
		else if (year !== null && yearEnd < year) errors.yearEnd = 'The last year comes after the first.';
	}

	const tagline = text('tagline', input.tagline);
	const summary = text('summary', input.summary, true);

	// Result
	const event = text('event', input.event);
	const place = text('place', input.place);
	const result = text('result', input.result);
	let teamSize: number | null = null;
	const teamRaw = line(input.teamSize);
	if (teamRaw) {
		if (!/^\d+$/.test(teamRaw) || Number(teamRaw) < 1 || Number(teamRaw) > LIMITS.teamSize) {
			errors.teamSize = 'Use a whole number of people, e.g. 12.';
		} else teamSize = Number(teamRaw);
	}
	const highlightValue = text('highlightValue', input.highlightValue);
	const highlightLabel = text('highlightLabel', input.highlightLabel);
	const highlightNote = text('highlightNote', input.highlightNote);
	if (!highlightValue && (highlightLabel || highlightNote) && !errors.highlightValue) {
		errors.highlightValue = 'Add the number or word to show, e.g. 6th.';
	}

	// Cover
	const coverUrl = line(input.coverUrl);
	const coverAlt = line(input.coverAlt);
	const coverCaption = line(input.coverCaption);
	if (coverUrl && (coverUrl.length > LIMITS.url || !isSafeUrl(coverUrl))) errors.cover = URL_ERROR;
	else if (coverUrl && !coverAlt) errors.cover = 'Add alt text: describe the photo for people who can not see it.';
	else if (coverAlt.length > LIMITS.alt) errors.cover = `Keep the alt text under ${LIMITS.alt} characters.`;
	if (coverCaption.length > LIMITS.caption) errors.coverCaption = tooLong(LIMITS.caption);

	// Tags and software
	const readTagList = (key: 'tags' | 'software', max: number): string[] => {
		const raw = Array.isArray(input[key]) ? (input[key] as unknown[]) : [];
		const seen = new Set<string>();
		const out: string[] = [];
		for (const item of raw) {
			const tag = line(item).replace(/\s+/g, ' ');
			if (!tag || seen.has(tag.toLowerCase())) continue;
			if (tag.length > LIMITS.tag) {
				errors[key] = `Keep each one under ${LIMITS.tag} characters.`;
				continue;
			}
			seen.add(tag.toLowerCase());
			out.push(tag);
		}
		if (out.length > max) errors[key] = `Up to ${max}, please.`;
		return out.slice(0, max);
	};
	const tags = readTagList('tags', LIMITS.tags);
	const software = readTagList('software', LIMITS.software);

	// How it works
	const systems: ProjectSystem[] = [];
	if (!Array.isArray(input.systems)) errors.systems = LIST_ERROR;
	else {
		if (input.systems.length > LIMITS.systems) errors.systems = `Up to ${LIMITS.systems} systems.`;
		input.systems.slice(0, LIMITS.systems).forEach((raw, i) => {
			const row = stringFields(raw, ['title', 'description'] as const);
			if (!row) {
				errors[`systems.${i}`] = LIST_ERROR;
				return;
			}
			if (!row.title && !row.description) return;
			if (!row.title) errors[`systems.${i}.title`] = 'Name this system.';
			else if (row.title.length > LIMITS.systemTitle) errors[`systems.${i}.title`] = tooLong(LIMITS.systemTitle);
			if (row.description.length > LIMITS.systemDescription) {
				errors[`systems.${i}.description`] = tooLong(LIMITS.systemDescription);
			}
			systems.push({ title: row.title, description: row.description });
		});
	}

	// Parts list
	const parts: ProjectPart[] = [];
	if (!Array.isArray(input.parts)) errors.parts = LIST_ERROR;
	else {
		if (input.parts.length > LIMITS.parts) errors.parts = `Up to ${LIMITS.parts} parts.`;
		input.parts.slice(0, LIMITS.parts).forEach((raw, i) => {
			const row = stringFields(raw, ['qty', 'part', 'note'] as const);
			if (!row) {
				errors[`parts.${i}`] = LIST_ERROR;
				return;
			}
			if (!row.qty && !row.part && !row.note) return;
			if (row.qty.length > LIMITS.partQty) errors[`parts.${i}.qty`] = tooLong(LIMITS.partQty);
			if (!row.part) errors[`parts.${i}.part`] = 'Name the part.';
			else if (row.part.length > LIMITS.partName) errors[`parts.${i}.part`] = tooLong(LIMITS.partName);
			if (row.note.length > LIMITS.partNote) errors[`parts.${i}.note`] = tooLong(LIMITS.partNote);
			parts.push({ qty: row.qty, part: row.part, note: row.note });
		});
	}

	// Gallery: photos, and captioned empty slots (the site shows a crop marked placeholder).
	const gallery: GalleryImage[] = [];
	if (!Array.isArray(input.gallery)) errors.gallery = LIST_ERROR;
	else {
		if (input.gallery.length > LIMITS.gallery) errors.gallery = `Up to ${LIMITS.gallery} photos.`;
		input.gallery.slice(0, LIMITS.gallery).forEach((raw, i) => {
			const row = stringFields(raw, ['url', 'alt', 'caption'] as const);
			if (!row) {
				errors[`gallery.${i}`] = LIST_ERROR;
				return;
			}
			if (!row.url && !row.alt && !row.caption) return;
			if (row.url && (row.url.length > LIMITS.url || !isSafeUrl(row.url))) errors[`gallery.${i}.url`] = URL_ERROR;
			else if (row.url && !row.alt) errors[`gallery.${i}.alt`] = 'Describe the photo.';
			if (row.alt.length > LIMITS.alt) errors[`gallery.${i}.alt`] = tooLong(LIMITS.alt);
			if (row.caption.length > LIMITS.caption) errors[`gallery.${i}.caption`] = tooLong(LIMITS.caption);
			if (!row.url && !row.caption && !errors[`gallery.${i}.alt`]) {
				errors[`gallery.${i}.caption`] = 'Add a photo or a caption for the empty slot.';
			}
			gallery.push({ url: row.url, alt: row.alt, caption: row.caption });
		});
	}

	// Links
	const linkUrl = line(input.linkUrl);
	if (linkUrl && (linkUrl.length > LIMITS.url || !isSafeUrl(linkUrl))) {
		errors.linkUrl = 'Use a link that starts with https://, or a page on this site such as /about.';
	}
	const repoUrl = line(input.repoUrl);
	if (repoUrl && (repoUrl.length > LIMITS.url || !isWebUrl(repoUrl))) errors.repoUrl = WEB_URL_ERROR;
	const paperUrl = line(input.paperUrl);
	if (paperUrl && (paperUrl.length > LIMITS.url || !isSafeUrl(paperUrl))) {
		errors.paperUrl = 'Use a link that starts with https://, a site path, or upload the PDF.';
	}

	return {
		values: {
			title,
			slug,
			category: category || 'robot',
			status: status || 'ongoing',
			year,
			yearEnd,
			tagline,
			summary,
			event,
			place,
			result,
			teamSize,
			highlightValue,
			highlightLabel,
			highlightNote,
			coverUrl: coverUrl || null,
			coverAlt: coverUrl ? coverAlt : null,
			coverCaption: coverCaption || null,
			tags,
			software,
			systems,
			parts,
			gallery,
			linkUrl: linkUrl || null,
			repoUrl: repoUrl || null,
			paperUrl: paperUrl || null,
			published: input.published === true,
			featured: input.featured === true,
			showGallery: input.showGallery === true
		},
		errors
	};
}

/** "2026", "2006 to 2008", or "" without a year, for the admin list. */
export function yearLabel(year: number | null, yearEnd: number | null): string {
	if (!year) return yearEnd ? String(yearEnd) : '';
	return yearEnd && yearEnd !== year ? `${year} to ${yearEnd}` : String(year);
}
