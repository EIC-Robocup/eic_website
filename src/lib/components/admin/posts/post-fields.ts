/**
 * Limits, slugs, Bangkok dates and post states for the post editor. Client safe: the
 * server action (src/routes/admin/(app)/posts/posts.server.ts) imports the same rules, so the
 * browser and the server always agree.
 */
import { SITE_TIME_ZONE, formatDate } from '#lib/content/labels.ts';

export const LIMITS = {
	title: 200,
	slug: 80,
	excerpt: 300,
	/** About what search engines show; the counter turns muted red past it. */
	excerptIdeal: 160,
	author: 120,
	caption: 300,
	/** Markdown body, in bytes (the preview endpoint refuses more). */
	bodyBytes: 200 * 1024
} as const;

/** Lower case letters and digits in groups joined by single hyphens: `how-walkie-picks-up-a-can`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A URL slug from a title. Empty when the title has no Latin letters or digits (e.g. Thai only). */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/['’]/g, '')
		.replace(/&/g, ' and ')
		.replace(/@/g, ' ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, LIMITS.slug)
		.replace(/-+$/g, '');
}

/** Bytes of a string in UTF-8 (Thai is 3 bytes a character). */
export function byteLength(text: string): number {
	return new TextEncoder().encode(text).length;
}

/* ------------------------------------------------------------------------------------------ */
/* Bangkok dates                                                                               */
/* ------------------------------------------------------------------------------------------ */

/** Bangkok has no daylight saving time: always UTC+7. */
const BANGKOK_OFFSET = '+07:00';

const partsFormat = new Intl.DateTimeFormat('en-CA', {
	timeZone: SITE_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** `{ date: '2026-09-14', time: '09:00' }` as the moment was in Bangkok, for date and time inputs. */
export function bangkokParts(value: Date | string | null | undefined): { date: string; time: string } {
	if (!value) return { date: '', time: '' };
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return { date: '', time: '' };
	const p = Object.fromEntries(partsFormat.formatToParts(d).map((x) => [x.type, x.value]));
	return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_INPUT = /^(\d{2}):(\d{2})(?::\d{2})?$/;

/**
 * The moment for a Bangkok date and time from the inputs. `null` when the date is empty,
 * `'invalid'` when either part can't be read. A missing time means 09:00.
 */
export function parseBangkok(date: string, time: string): Date | null | 'invalid' {
	const d = date.trim();
	const t = time.trim() || '09:00';
	if (!d) return null;
	const dm = DATE_INPUT.exec(d);
	const tm = TIME_INPUT.exec(t);
	if (!dm || !tm) return 'invalid';
	const [year, month, day] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
	const [hour, minute] = [Number(tm[1]), Number(tm[2])];
	if (year < 1990 || year > 2200 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return 'invalid';
	// Reject 31 Feb and the like: the calendar date must survive the round trip.
	const probe = new Date(Date.UTC(year, month - 1, day));
	if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return 'invalid';
	const result = new Date(`${dm[0]}T${tm[1]}:${tm[2]}:00${BANGKOK_OFFSET}`);
	return Number.isNaN(result.getTime()) ? 'invalid' : result;
}

const timeFormat = new Intl.DateTimeFormat('en-GB', {
	timeZone: SITE_TIME_ZONE,
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** "14 Sep 2026, 09:00" in Bangkok time. */
export function formatWhen(value: Date | string | null | undefined): string {
	if (!value) return '';
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return '';
	return `${formatDate(d)}, ${timeFormat.format(d)}`;
}

/** "in 3 days", "in 5 h", "in 20 min" for a future moment ('' when it has passed). */
export function timeUntil(value: Date | string | null | undefined, now: Date): string {
	if (!value) return '';
	const d = value instanceof Date ? value : new Date(value);
	const minutes = Math.round((d.getTime() - now.getTime()) / 60_000);
	if (minutes <= 0) return '';
	if (minutes < 60) return `in ${minutes} min`;
	const hours = Math.round(minutes / 60);
	if (hours < 36) return `in ${hours} h`;
	const days = Math.round(hours / 24);
	return `in ${days} days`;
}

/* ------------------------------------------------------------------------------------------ */
/* States                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** What readers see: a draft, a published post waiting for its date, or a live post. */
export type PostState = 'draft' | 'scheduled' | 'published';

export function postState(
	status: string,
	publishedAt: Date | string | null | undefined,
	now: Date = new Date()
): PostState {
	if (status !== 'published') return 'draft';
	if (!publishedAt) return 'published';
	const d = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
	return d.getTime() > now.getTime() ? 'scheduled' : 'published';
}

export const STATE_LABELS: Record<PostState, string> = {
	draft: 'Draft',
	scheduled: 'Scheduled',
	published: 'Published'
};

/* ------------------------------------------------------------------------------------------ */
/* Words                                                                                       */
/* ------------------------------------------------------------------------------------------ */

let segmenter: Intl.Segmenter | null | undefined;

/**
 * Words in a Markdown body, close to the renderer's count: URLs, markup and code fences'
 * info strings are left out. Uses Intl.Segmenter so Thai is counted properly.
 */
export function countMarkdownWords(markdown: string): number {
	if (!markdown.trim()) return 0;
	const text = markdown
		.replace(/^```.*$/gm, ' ')
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/https?:\/\/\S+/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, ' ')
		.replace(/[#>*_~=`|$-]+/g, ' ');
	if (segmenter === undefined) {
		try {
			segmenter = new Intl.Segmenter(['th', 'en'], { granularity: 'word' });
		} catch {
			segmenter = null;
		}
	}
	if (!segmenter) return text.split(/\s+/).filter(Boolean).length;
	let words = 0;
	for (const part of segmenter.segment(text)) if (part.isWordLike) words += 1;
	return words;
}

/** Same rule as the renderer: 220 words a minute, at least 1. */
export function readingMinutes(words: number): number {
	return Math.max(1, Math.round(words / 220));
}
