import { resolveStats } from '#lib/content/stats.ts';
import { getPageSections } from '#lib/server/content.ts';
import {
	getFeaturedProject,
	getSiteCounts,
	listFeaturedPeople,
	listProjects,
	listPublishedPosts
} from '#lib/server/queries/site.ts';
import { cardMeta } from './projects/project-meta.ts';
import type { PageServerLoad } from './$types';

/**
 * The home page should still render (hero, numbers, join band) if a list fails to
 * load, so each query falls back to "no data" and the section hides itself.
 */
async function orEmpty<T>(what: string, query: Promise<T>, fallback: T): Promise<T> {
	try {
		return await query;
	} catch (err) {
		console.error(`Home page: could not load ${what}`, err);
		return fallback;
	}
}

export const load: PageServerLoad = async () => {
	const [sections, featuredRow, projects, posts, people, counts] = await Promise.all([
		getPageSections('home'),
		orEmpty('the featured project', getFeaturedProject(), null),
		orEmpty('projects', listProjects(), []),
		orEmpty('posts', listPublishedPosts({ limit: 3 }), []),
		orEmpty('people', listFeaturedPeople(), []),
		// null: the numbers strip falls back to the typed values.
		orEmpty('the site numbers', getSiteCounts(), null)
	]);

	// No project marked featured: the first one in the Projects order takes the big card.
	const featuredSource = featuredRow ?? projects[0] ?? null;
	const featured = featuredSource && {
		id: featuredSource.id,
		slug: featuredSource.slug,
		title: featuredSource.title,
		category: featuredSource.category,
		status: featuredSource.status,
		tagline: featuredSource.tagline?.trim() || featuredSource.summary?.trim() || '',
		coverUrl: featuredSource.coverUrl,
		coverAlt: featuredSource.coverAlt,
		href: featuredSource.href,
		external: featuredSource.external,
		meta: cardMeta(featuredSource)
	};

	// Earlier builds: not featured and not ongoing, in the Projects order.
	const older = sections.olderRobots.enabled
		? projects
				.filter((p) => p.id !== featured?.id && !p.featured && p.status !== 'ongoing')
				.slice(0, 3)
				.map((p) => ({
					slug: p.slug,
					title: p.title,
					category: p.category,
					status: p.status,
					coverUrl: p.coverUrl,
					coverAlt: p.coverAlt,
					linkUrl: p.linkUrl,
					meta: cardMeta(p)
				}))
		: [];

	return {
		sections,
		stats: resolveStats(sections.stats.data.items, counts),
		featured,
		older,
		posts: sections.stories.enabled ? posts : [],
		people: sections.people.enabled ? people : [],
		peopleCount: counts?.people ?? 0
	};
};
