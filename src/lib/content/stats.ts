/**
 * The home page numbers strip (pages.home.sections.stats): turns the saved items into the
 * numbers the page shows. Each item has a `source`: `text` shows the typed value; the others
 * are counted from the database by getSiteCounts() in #lib/server/queries/site.ts.
 *
 * Pure and client safe: the home load uses it, and the Pages editor uses the same code for
 * its live preview.
 */
import { STAT_SOURCES, fill, type StatSource } from './sections.ts';

/** The newest achievement (by year, then sort order). */
export type LatestResult = {
	/** "6th", "Finalist"... */
	placement: string;
	/** Teams taking part, when known. */
	entrants: number | null;
	competition: string;
	year: number;
};

/** What the counted sources read from the database. */
export type SiteCounts = {
	/** Visible members and advisors (alumni not counted). */
	people: number;
	/** Teams with visible members, leaving out NON_TEAM_SLUGS (the People page's "teams"). */
	teams: number;
	/** Visible advisors. */
	advisors: number;
	/** Published projects. */
	projects: number;
	latestResult: LatestResult | null;
};

/** One saved item. Items saved before sources existed have no `source` and read as text. */
export type StatItem = { source?: string; value: string; label: string };

/** What one cell of the strip shows. An empty `value` means the cell is left out. */
export type ResolvedStat = { value: string; label: string };

type CountSource = Exclude<StatSource, 'text' | 'latestResult'>;

const NOUNS: Record<CountSource, [one: string, many: string]> = {
	people: ['person', 'people'],
	teams: ['team', 'teams'],
	advisors: ['advisor', 'advisors'],
	projects: ['project', 'projects']
};

/** Placeholders that need the database. */
const DB_PLACEHOLDER = /\{(people|teams|advisors|projects|placement|entrants|competition|year)\}/;

export function statSource(item: { source?: unknown }): StatSource {
	const value = item.source;
	return STAT_SOURCES.some((s) => s.value === value) ? (value as StatSource) : 'text';
}

/** "of 24 · RoboCup@Home 2026", or "RoboCup@Home 2026" when the number of teams is unknown. */
export function latestResultLabel(result: LatestResult): string {
	const event = `${result.competition.trim()} ${result.year}`.trim();
	return result.entrants && result.entrants > 0 ? `of ${result.entrants} · ${event}` : event;
}

/** Resolve one item. `counts` is null when the database could not be read. */
export function resolveStat(item: StatItem, counts: SiteCounts | null): ResolvedStat {
	const source = statSource(item);
	const typedValue = item.value.trim();
	const typedLabel = item.label.trim();

	if (counts) {
		const shared = {
			people: counts.people,
			teams: counts.teams,
			advisors: counts.advisors,
			projects: counts.projects
		};
		if (source === 'text') {
			return { value: typedValue, label: fill(typedLabel, { ...shared, count: typedValue }) };
		}
		if (source === 'latestResult') {
			const result = counts.latestResult;
			// No achievements yet: leave the cell out rather than show a made-up result.
			if (!result) return { value: '', label: '' };
			const value = result.placement.trim();
			const label = typedLabel
				? fill(typedLabel, {
						...shared,
						count: value,
						placement: value,
						entrants: result.entrants ?? '',
						competition: result.competition,
						year: result.year
					})
				: latestResultLabel(result);
			return { value, label };
		}
		const n = counts[source];
		const value = String(n);
		const label = typedLabel ? fill(typedLabel, { ...shared, count: n }) : NOUNS[source][n === 1 ? 0 : 1];
		return { value, label };
	}

	// The database could not be read: show what was typed (the defaults carry the designed
	// numbers as fallbacks). Labels that need the database fall back to a plain noun.
	const label = fill(typedLabel, { count: typedValue });
	if (!DB_PLACEHOLDER.test(label)) return { value: typedValue, label };
	return { value: typedValue, label: source in NOUNS ? NOUNS[source as CountSource][1] : '' };
}

/** The cells of the strip, in order, leaving out the ones with nothing to show. */
export function resolveStats(items: readonly StatItem[], counts: SiteCounts | null): ResolvedStat[] {
	return items.map((item) => resolveStat(item, counts)).filter((stat) => stat.value !== '');
}
