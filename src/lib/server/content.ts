import { eq } from 'drizzle-orm';
import {
	pages,
	resolveSection,
	type PageKey,
	type ResolvedPage,
	type SectionDef
} from '#lib/content/sections.js';
import { db } from './db';
import { siteSections } from './db/schema';

/**
 * Load a page's sections: saved values from the database merged over the defaults.
 * If the database is unreachable the defaults are used, so the page still renders.
 */
export async function getPageSections<P extends PageKey>(page: P): Promise<ResolvedPage<P>> {
	let rows: { key: string; data: unknown; enabled: boolean }[] = [];
	try {
		rows = await db
			.select({ key: siteSections.key, data: siteSections.data, enabled: siteSections.enabled })
			.from(siteSections)
			.where(eq(siteSections.page, page));
	} catch (err) {
		console.error(`Could not load sections for "${page}", using defaults`, err);
	}
	const saved = new Map(rows.map((r) => [r.key, r]));
	const defs = pages[page].sections as Record<string, SectionDef>;
	const out: Record<string, unknown> = {};
	for (const [key, def] of Object.entries(defs)) {
		out[key] = resolveSection(def, saved.get(key));
	}
	return out as ResolvedPage<P>;
}
