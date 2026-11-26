import { getPageSections } from '#lib/server/content.ts';
import { listPublishedPosts } from '#lib/server/queries/site.ts';
import { findPosts, parseCategory, type BlogFilters } from './posts.server.ts';
import type { PageServerLoad } from './$types';

/** Posts per "page"; ?page=N shows the first N pages, so "Load older posts" appends. */
const PAGE_SIZE = 9;
const MAX_PAGE = 40;

const param = (url: URL, key: string, max: number) =>
	url.searchParams.get(key)?.trim().slice(0, max) || null;

export const load: PageServerLoad = async ({ url }) => {
	const filters: BlogFilters = {
		category: parseCategory(url.searchParams.get('category')),
		tag: param(url, 'tag', 60),
		q: param(url, 'q', 100)
	};
	const requested = Number.parseInt(url.searchParams.get('page') ?? '', 10);
	const pageNo = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_PAGE) : 1;

	const [sections, [featuredPick], [newest]] = await Promise.all([
		getPageSections('blog'),
		listPublishedPosts({ featured: true, limit: 1 }),
		listPublishedPosts({ limit: 1 })
	]);

	// The big card: the newest post marked featured, else the newest post. It stays at
	// the top while the grid is filtered (no layout jump), except on a tag's listing.
	const featuredSource = featuredPick ?? newest ?? null;
	const featured =
		featuredSource && !filters.tag
			? {
					id: featuredSource.id,
					slug: featuredSource.slug,
					title: featuredSource.title,
					excerpt: featuredSource.excerpt,
					category: featuredSource.category,
					authorName: featuredSource.authorName,
					publishedAt: featuredSource.publishedAt,
					coverUrl: featuredSource.coverUrl,
					coverAlt: featuredSource.coverAlt,
					readingMinutes: featuredSource.readingMinutes
				}
			: null;

	// The grid leaves out the featured post, except in search results, which list every match.
	const { posts, total } = await findPosts(filters, {
		limit: pageNo * PAGE_SIZE,
		excludeId: featured && !filters.q ? featured.id : null
	});

	// Show the tag as it is written on the posts ("Walkie 4"), not as typed in the URL.
	const tagLabel = filters.tag
		? (posts.flatMap((p) => p.tags).find((t) => t.toLowerCase() === filters.tag!.toLowerCase()) ??
			filters.tag)
		: null;

	return {
		sections,
		filters,
		tagLabel,
		featured,
		posts: posts.map(({ tags: _tags, ...card }) => card),
		total,
		pageNo,
		pageSize: PAGE_SIZE,
		hasMore: total > posts.length && pageNo < MAX_PAGE,
		/** Any published post at all (for the empty state). */
		hasPosts: Boolean(newest)
	};
};
