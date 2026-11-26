/**
 * Display helpers shared by the Home, Projects and project pages.
 * Client safe: no server imports.
 */
import { projectCategoryLabel } from '#lib/components/site/format.ts';

type MetaInput = {
	category: string;
	year?: number | null;
	yearEnd?: number | null;
	place?: string | null;
	linkUrl?: string | null;
	tags?: string[] | null;
};

/** "2026", or "2006 to 2008" for a project that ran several years. Empty without a year. */
export function yearRange(year?: number | null, yearEnd?: number | null): string {
	const start = year ?? yearEnd ?? null;
	if (!start) return '';
	return yearEnd && yearEnd !== start ? `${start} to ${yearEnd}` : String(start);
}

/** The city only: "Incheon, Korea" gives "Incheon". */
export function shortPlace(place?: string | null): string {
	return place?.split(',')[0]?.trim() ?? '';
}

export function isGitHub(url?: string | null): boolean {
	return /^https?:\/\/(www\.)?github\.com\//i.test(url?.trim() ?? '');
}

/**
 * The mono meta line on project cards:
 * "Robot · 2023 · Bordeaux", "Robot · 2006 to 2008", "Software · 2026".
 * Without a year: "Open source · Python" for a card that links to GitHub, else the category.
 */
export function cardMeta(p: MetaInput): string {
	const years = yearRange(p.year, p.yearEnd);
	if (!years) {
		if (isGitHub(p.linkUrl)) {
			return ['Open source', p.tags?.[0]?.trim() ?? ''].filter(Boolean).join(' · ');
		}
		return projectCategoryLabel(p.category);
	}
	return [projectCategoryLabel(p.category), years, shortPlace(p.place)].filter(Boolean).join(' · ');
}

const WORDS = [
	'zero',
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'eleven',
	'twelve',
	'thirteen',
	'fourteen',
	'fifteen',
	'sixteen',
	'seventeen',
	'eighteen',
	'nineteen',
	'twenty'
];

/** 6 gives "six"; numbers above twenty stay as digits. */
export function spell(n: number): string {
	return Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

export function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Splits a trailing arrow off link text, so screen readers don't read "right arrow". */
export function splitArrow(text: string): { text: string; arrow: string } {
	const match = /^(.*?)\s*([→↗])\s*$/u.exec(text);
	return match ? { text: match[1], arrow: match[2] } : { text, arrow: '' };
}
