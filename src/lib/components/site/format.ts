/**
 * Client-safe formatting helpers for the public site components.
 * Nothing here touches the server, so pages and components can import it anywhere.
 */
import type { PostCategory, ProjectCategory, ProjectStatus } from '#lib/server/db/schema.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const bangkokParts = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Asia/Bangkok',
	day: 'numeric',
	month: 'numeric',
	year: 'numeric'
});

function toDate(d: Date | string | number | null | undefined): Date | null {
	if (d === null || d === undefined || d === '') return null;
	const date = d instanceof Date ? d : new Date(d);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "8 Jul 2026", in Bangkok time. Month names are fixed (not ICU's "Sept"), so the
 * server and the browser always render the same string. Empty string for no date.
 */
export function formatDate(d: Date | string | number | null | undefined): string {
	const date = toDate(d);
	if (!date) return '';
	const parts = bangkokParts.formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((p) => p.type === type)?.value ?? 0);
	return `${get('day')} ${MONTHS[get('month') - 1]} ${get('year')}`;
}

/** ISO string for a `<time datetime>` attribute, or undefined for no date. */
export function isoDate(d: Date | string | number | null | undefined): string | undefined {
	return toDate(d)?.toISOString();
}

/** The current year in Bangkok, for the footer's copyright line. */
export function currentYear(): number {
	const parts = bangkokParts.formatToParts(new Date());
	return Number(parts.find((p) => p.type === 'year')?.value ?? new Date().getFullYear());
}

const TITLES = /^((assoc\.|asst\.)\s*prof\.|prof\.|dr\.|mr\.|ms\.|mrs\.)\s*/i;

/**
 * Initials for an avatar fallback: "Taratorn Assawadejmetakul" -> "TA",
 * "Assoc. Prof. Ronnapee Chaichaowarat, Ph.D." -> "RC". A short acronym as the
 * first word is kept whole: "AI Team" -> "AI".
 */
export function initials(name: string): string {
	let rest = name.trim();
	while (TITLES.test(rest)) rest = rest.replace(TITLES, '');
	rest = rest.replace(/,.*$/, '').trim();
	const words = rest.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
	if (words.length === 0) return '';
	if (/^[A-Z0-9]{2,3}$/.test(words[0])) return words[0];
	return words
		.slice(0, 2)
		.map((w) => Array.from(w)[0] ?? '')
		.join('')
		.toUpperCase();
}

const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
	competition: 'Competition',
	engineering: 'Engineering',
	research: 'Research',
	'club-life': 'Club life'
};

/** "club-life" -> "Club life". Unknown values are returned with the first letter capitalised. */
export function categoryLabel(category: PostCategory | string | null | undefined): string {
	if (!category) return '';
	if (Object.hasOwn(POST_CATEGORY_LABELS, category)) {
		return POST_CATEGORY_LABELS[category as PostCategory];
	}
	const words = category.replace(/[-_]+/g, ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
	robot: 'Robot',
	software: 'Software',
	research: 'Research'
};

export function projectCategoryLabel(category: ProjectCategory | string | null | undefined): string {
	if (!category) return '';
	return Object.hasOwn(PROJECT_CATEGORY_LABELS, category)
		? PROJECT_CATEGORY_LABELS[category as ProjectCategory]
		: categoryLabel(category);
}

/** "Robot · 2026 · Bordeaux". Missing parts are left out. */
export function projectMeta(p: {
	category?: ProjectCategory | string | null;
	year?: number | string | null;
	place?: string | null;
}): string {
	return [projectCategoryLabel(p.category), p.year ? String(p.year) : '', p.place?.trim() ?? '']
		.filter(Boolean)
		.join(' · ');
}

export type StatusTone = 'success' | 'muted';

const STATUS: Record<ProjectStatus | 'recruiting', { label: string; tone: StatusTone }> = {
	ongoing: { label: 'Ongoing', tone: 'success' },
	active: { label: 'Active', tone: 'success' },
	recruiting: { label: 'Recruiting', tone: 'success' },
	archived: { label: 'Archived', tone: 'muted' }
};

/** "ongoing" -> { label: "Ongoing", tone: "success" }. */
export function statusInfo(status: string | null | undefined): { label: string; tone: StatusTone } {
	if (status && Object.hasOwn(STATUS, status)) return STATUS[status as keyof typeof STATUS];
	return { label: categoryLabel(status ?? ''), tone: 'muted' };
}

/** "7 min read", or an empty string when unknown. */
export function readingTime(minutes: number | null | undefined): string {
	if (!minutes || minutes < 1) return '';
	return `${Math.round(minutes)} min read`;
}

/** Off-site http(s) link (these get rel="noopener" and open in a new tab). */
export function isExternal(href: string | null | undefined): boolean {
	return typeof href === 'string' && /^https?:\/\//i.test(href.trim());
}

/** Zero-padded figure or section number: 1 -> "01". Strings pass through. */
export function pad2(n: number | string): string {
	return typeof n === 'number' ? String(n).padStart(2, '0') : n;
}
