/**
 * Helpers for the generic section editor (the admin Pages editor). Client safe: the same
 * validation runs in the browser before publishing and in the `publish` action.
 */
import { safeHref, type Field, type ScalarField, type SectionDef } from '#lib/content/sections.ts';

/** One section as the editor holds it, and as it is submitted (JSON in a hidden field). */
export type SectionDraft = { enabled: boolean; data: Record<string, unknown> };

export type ListField = Extract<Field, { type: 'list' }>;

/** Longest values `cleanSectionInput` keeps; longer input is reported instead of cut. */
export const LIMITS = {
	text: 500,
	textarea: 5000,
	url: 2000,
	linkLabel: 200,
	alt: 500,
	tags: 20,
	tag: 60,
	list: 50
} as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (isRecord(value)) {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
		return out;
	}
	return value;
}

/**
 * JSON with object keys sorted. Postgres jsonb reorders keys, so plain JSON.stringify can't
 * tell whether a saved section equals what the editor holds.
 */
export function stableStringify(value: unknown): string {
	return JSON.stringify(sortKeys(value)) ?? '';
}

/** Fields that take the full width of the two column form grid. */
export function isWideField(field: Field): boolean {
	if (['textarea', 'image', 'tags', 'list', 'toggle'].includes(field.type)) return true;
	return ['headline', 'heading', 'subline'].includes(field.key);
}

/** A new, empty row for a list field. */
export function emptyItem(field: ListField): Record<string, unknown> {
	return Object.fromEntries(field.fields.map((sub) => [sub.key, sub.type === 'toggle' ? false : '']));
}

export const LINK_ERROR = 'Use a link that starts with https://, a / for a page on this site, or # for a section.';
const IMAGE_ERROR = 'Use an https:// link or a site path such as /images/..., or upload the image.';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const tooLong = (max: number) => `Keep this under ${max} characters.`;

function isImageUrl(value: string): boolean {
	if (value.startsWith('/') && !value.startsWith('//')) return true;
	return /^https?:\/\/[^\s]+$/i.test(value);
}

function checkScalar(field: ScalarField, value: unknown, path: string, errors: Record<string, string>) {
	const text = str(value);
	switch (field.type) {
		case 'text':
			if (text.length > LIMITS.text) errors[path] = tooLong(LIMITS.text);
			break;
		case 'textarea':
			if (text.length > LIMITS.textarea) errors[path] = tooLong(LIMITS.textarea);
			break;
		case 'url':
			if (text.length > LIMITS.url) errors[path] = tooLong(LIMITS.url);
			else if (text.trim() && !safeHref(text)) errors[path] = LINK_ERROR;
			break;
		case 'toggle':
			break;
	}
}

/**
 * Check an editor's submission for one section. Returns messages keyed by field path:
 * `headline`, `primaryCta.href`, `items.2.value`. Empty when everything is fine.
 * `cleanSectionInput` still coerces whatever passes, so this only adds friendly messages.
 */
export function validateSection(def: SectionDef, input: unknown): Record<string, string> {
	const raw = isRecord(input) ? input : {};
	const errors: Record<string, string> = {};
	for (const field of def.fields) {
		const value = raw[field.key];
		const path = field.key;
		switch (field.type) {
			case 'link': {
				const link = isRecord(value) ? value : {};
				const label = str(link.label);
				const href = str(link.href);
				if (label.length > LIMITS.linkLabel) errors[`${path}.label`] = tooLong(LIMITS.linkLabel);
				if (href.length > LIMITS.url) errors[`${path}.href`] = tooLong(LIMITS.url);
				else if (href.trim() && !safeHref(href)) errors[`${path}.href`] = LINK_ERROR;
				else if (label.trim() && !href.trim()) errors[`${path}.href`] = 'Add where the button goes.';
				if (href.trim() && !label.trim()) errors[`${path}.label`] = 'Add the button text.';
				break;
			}
			case 'image': {
				const image = isRecord(value) ? value : {};
				const url = str(image.url).trim();
				const alt = str(image.alt);
				if (url && !isImageUrl(url)) errors[path] = IMAGE_ERROR;
				else if (url && !alt.trim()) errors[path] = 'Add alt text: describe the photo for people who can’t see it.';
				else if (alt.length > LIMITS.alt) errors[path] = `Keep the alt text under ${LIMITS.alt} characters.`;
				break;
			}
			case 'tags': {
				const tags = Array.isArray(value) ? value : [];
				if (tags.length > LIMITS.tags) errors[path] = `Up to ${LIMITS.tags} tags.`;
				break;
			}
			case 'list': {
				const items = Array.isArray(value) ? value : [];
				const max = field.max ?? LIMITS.list;
				if (items.length > max) errors[path] = `Up to ${max} ${field.itemLabel}s.`;
				items.forEach((item, index) => {
					const row = isRecord(item) ? item : {};
					for (const sub of field.fields) checkScalar(sub, row[sub.key], `${path}.${index}.${sub.key}`, errors);
				});
				break;
			}
			default:
				checkScalar(field, value, path, errors);
		}
	}
	return errors;
}

/** The errors for one section out of the page's errors (`hero.headline` -> `headline`). */
export function sectionErrors(errors: Record<string, string>, sectionKey: string): Record<string, string> {
	const prefix = `${sectionKey}.`;
	const out: Record<string, string> = {};
	for (const [key, message] of Object.entries(errors)) {
		if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message;
	}
	return out;
}
