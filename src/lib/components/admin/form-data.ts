/**
 * Server helpers for reading what the admin building blocks submit. Plain functions with no
 * server imports, so they run in form actions (and in tests). They only parse and trim;
 * check lengths, formats and required fields in the action and report problems with
 * `fail(400, { message, errors })`.
 *
 *     const form = await request.formData();
 *     const title = readText(form, 'title');
 *     const tags = readTags(form, 'tags');              // TagsInput name="tags"
 *     const cover = readImage(form, 'cover');           // ImageField name="cover"
 *     const published = readBool(form, 'published');    // ToggleRow name="published"
 *     const systems = readJson(form, 'systems');        // ListEditor name="systems"
 */

/**
 * `value` without NUL characters. Postgres refuses U+0000 in text and jsonb, so one pasted
 * from a PDF would otherwise turn a save into a 500. Every reader here applies it.
 */
export function stripNul(value: string): string {
	return value.includes('\u0000') ? value.replace(/\u0000/g, '') : value;
}

/**
 * JSON.parse for submitted JSON: strings lose NUL characters (JSON can carry them as \u0000),
 * and object keys that contain one are dropped. Throws on malformed JSON, like JSON.parse.
 */
export function parseSubmittedJson(raw: string): unknown {
	return JSON.parse(raw, (_key, value: unknown) => {
		if (typeof value === 'string') return stripNul(value);
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			for (const key of Object.keys(value)) {
				if (key.includes('\u0000')) delete (value as Record<string, unknown>)[key];
			}
		}
		return value;
	});
}

/** A trimmed string ('' when missing). */
export function readText(form: FormData, name: string, { max = 10_000 }: { max?: number } = {}): string {
	const value = form.get(name);
	return typeof value === 'string' ? stripNul(value).trim().slice(0, max) : '';
}

/** A trimmed string, or null when empty. For nullable text columns. */
export function readOptional(form: FormData, name: string, options?: { max?: number }): string | null {
	return readText(form, name, options) || null;
}

/** An integer, null when empty, or NaN when it isn't a whole number (report that as an error). */
export function readInt(form: FormData, name: string): number | null {
	const value = readText(form, name);
	if (!value) return null;
	return /^-?\d+$/.test(value) ? Number(value) : Number.NaN;
}

/** A ToggleRow, Switch or checkbox: true when the field was sent with any value. */
export function readBool(form: FormData, name: string): boolean {
	const value = form.get(name);
	return value !== null && value !== 'false' && value !== 'off';
}

/** TagsInput: every `name` field, trimmed, without empties or duplicates (ignoring case). */
export function readTags(form: FormData, name: string, { max = 30, maxLength = 40 } = {}): string[] {
	const seen = new Set<string>();
	const tags: string[] = [];
	for (const raw of form.getAll(name)) {
		if (typeof raw !== 'string') continue;
		const tag = stripNul(raw).trim().replace(/\s+/g, ' ').slice(0, maxLength);
		if (!tag || seen.has(tag.toLowerCase())) continue;
		seen.add(tag.toLowerCase());
		tags.push(tag);
		if (tags.length >= max) break;
	}
	return tags;
}

/** Whether a URL is safe to store for an image or link: https/http, or a site path. */
export function isSafeUrl(value: string): boolean {
	if (!value) return false;
	if (value.startsWith('/') && !value.startsWith('//')) return true;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

/**
 * ImageField: `{ url, alt }` from `${name}Url` and `${name}Alt`. An unsafe URL comes back as
 * `{ url: '', alt, invalid: true }`, so the action can report it.
 */
export function readImage(form: FormData, name: string): { url: string; alt: string; invalid?: true } {
	const url = readText(form, `${name}Url`, { max: 2000 });
	const alt = readText(form, `${name}Alt`, { max: 300 });
	if (url && !isSafeUrl(url)) return { url: '', alt, invalid: true };
	return { url, alt };
}

/** ListEditor (or any hidden JSON field): the parsed value, or `fallback` when missing or malformed. */
export function readJson<T = unknown>(form: FormData, name: string, fallback: T | null = null): T | null {
	const raw = form.get(name);
	if (typeof raw !== 'string' || !raw) return fallback;
	try {
		return parseSubmittedJson(raw) as T;
	} catch {
		return fallback;
	}
}

/**
 * ListEditor rows as plain objects with only the given string keys, trimmed. Rows where every
 * key is empty are dropped. Use for systems, parts, stats and similar lists.
 *
 *     const systems = readRows(form, 'systems', ['title', 'description'], { max: 12 });
 */
export function readRows<K extends string>(
	form: FormData,
	name: string,
	keys: readonly K[],
	{ max = 100, maxLength = 2000 }: { max?: number; maxLength?: number } = {}
): Record<K, string>[] {
	const value = readJson<unknown>(form, name, []);
	if (!Array.isArray(value)) return [];
	const rows: Record<K, string>[] = [];
	for (const item of value) {
		if (!item || typeof item !== 'object') continue;
		const row = {} as Record<K, string>;
		let filled = false;
		for (const key of keys) {
			const raw = (item as Record<string, unknown>)[key];
			const text = typeof raw === 'string' || typeof raw === 'number' ? stripNul(String(raw)).trim().slice(0, maxLength) : '';
			row[key] = text;
			if (text) filled = true;
		}
		if (filled) rows.push(row);
		if (rows.length >= max) break;
	}
	return rows;
}
