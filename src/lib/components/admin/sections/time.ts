/**
 * Relative times for the admin ("10 min ago", "Yesterday", "3 days ago"). Client safe.
 * Day boundaries follow Bangkok time, like every other date on the site.
 *
 * To keep server and browser output identical during hydration, pass the same `now`
 * on both sides (e.g. `now` returned from the load), then tick it on the client.
 */
import { SITE_TIME_ZONE, formatDate } from '#lib/content/labels.ts';

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
	if (value === null || value === undefined || value === '') return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

// en-CA formats as YYYY-MM-DD.
const dayFormat = new Intl.DateTimeFormat('en-CA', {
	timeZone: SITE_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

/** Whole days since 1970 for the calendar date in Bangkok. */
function dayNumber(date: Date): number {
	const [y, m, d] = dayFormat.format(date).split('-').map(Number);
	return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

const timeFormat = new Intl.DateTimeFormat('en-GB', {
	timeZone: SITE_TIME_ZONE,
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});

/**
 * "Just now", "10 min ago", "2 h ago", "Yesterday", "3 days ago", then the date ("8 Jul 2026").
 * With `lower`, the words are lower case for use mid sentence ("edited yesterday").
 */
export function timeAgo(value: DateInput, now: DateInput = new Date(), { lower = false } = {}): string {
	const date = toDate(value);
	const current = toDate(now) ?? new Date();
	if (!date) return '';
	const minutes = Math.floor((current.getTime() - date.getTime()) / 60_000);
	let text: string;
	if (minutes < 1) text = 'Just now';
	else if (minutes < 60) text = `${minutes} min ago`;
	else {
		const hours = Math.floor(minutes / 60);
		const days = dayNumber(current) - dayNumber(date);
		if (hours < 6 || days <= 0) text = `${hours} h ago`;
		else if (days === 1) text = 'Yesterday';
		else if (days < 7) text = `${days} days ago`;
		else return formatDate(date);
	}
	return lower ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** "8 Jul 2026, 14:05" in Bangkok time, for tooltips and the inbox. */
export function formatDateTime(value: DateInput): string {
	const date = toDate(value);
	if (!date) return '';
	return `${formatDate(date)}, ${timeFormat.format(date)}`;
}

/** ISO string for `<time datetime>`. */
export function isoString(value: DateInput): string | undefined {
	return toDate(value)?.toISOString();
}
