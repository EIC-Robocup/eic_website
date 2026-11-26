import { clsx, cn as merge, type ClassValue } from 'cn';

/**
 * Custom utilities from layout.css that tailwind-merge would mistake for text colours
 * and drop (e.g. `text-label` next to `text-ink-muted`). They are kept as written.
 */
const KEEP = /(^|:)(text-label|text-spec)$/;

/** Merge Tailwind classes (clsx + tailwind-merge), keeping the EIC custom utilities. */
export function cn(...inputs: ClassValue[]): string {
	const tokens = clsx(...inputs)
		.split(/\s+/)
		.filter(Boolean);
	const keep = tokens.filter((t) => KEEP.test(t));
	if (keep.length === 0) return merge(...inputs);
	const rest = tokens.filter((t) => !KEEP.test(t)).join(' ');
	return [merge(rest), ...new Set(keep)].filter(Boolean).join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
