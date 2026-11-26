/**
 * Live previews under list rows in the Pages editor. A list field opts in with
 * `preview: 'stat'` in src/lib/content/sections.ts; the page editor provides the previewers
 * (they may need data from its load, such as the site counts) through context.
 */
import { getContext, setContext } from 'svelte';
import type { Field } from '#lib/content/sections.ts';
import { resolveStat, statSource, type SiteCounts } from '#lib/content/stats.ts';

type Row = Record<string, unknown>;

export type PreviewKind = NonNullable<Extract<Field, { type: 'list' }>['preview']>;

/** What one row will show. `value` empty: the row is left out of the page, `note` says why. */
export type RowPreview = { value: string; label: string; highlight?: boolean; note?: string };

export type RowPreviewer = (item: Row, index: number, items: readonly Row[]) => RowPreview;

export type RowPreviewers = Partial<Record<PreviewKind, RowPreviewer>>;

const KEY = Symbol('section-row-previews');

export function setRowPreviewers(previewers: RowPreviewers): void {
	setContext(KEY, previewers);
}

export function getRowPreviewers(): RowPreviewers {
	return getContext<RowPreviewers | undefined>(KEY) ?? {};
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const asStat = (item: Row) => ({ source: text(item.source), value: text(item.value), label: text(item.label) });

/**
 * The home page numbers, resolved with the same code as the page. `counts` is null when the
 * editor's load could not read them. The first number that shows is the red one.
 */
export function previewStat(counts: SiteCounts | null, item: Row, index: number, items: readonly Row[]): RowPreview {
	const stat = resolveStat(asStat(item), counts);
	if (!stat.value) {
		const source = statSource(item);
		const note =
			source === 'text'
				? 'Not shown until it has a value.'
				: source === 'latestResult' && counts
					? 'Not shown: Achievements has no entries yet.'
					: 'Not shown: the numbers could not be read.';
		return { value: '', label: '', note };
	}
	const firstShown = items.findIndex((other) => resolveStat(asStat(other), counts).value !== '');
	return {
		...stat,
		highlight: firstShown === index,
		note: counts ? undefined : 'The numbers could not be read, so this is the fallback.'
	};
}
