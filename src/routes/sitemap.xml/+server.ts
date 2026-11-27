import { and, eq, isNotNull, lte, max, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { people, posts, projects, siteSections } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

/**
 * sitemap.xml: the public pages, every published project and every live post
 * (published, and not scheduled for later), with the date each last changed.
 */

type Entry = { path: string; lastmod?: Date | null };

const STATIC_PAGES: { path: string; sections: string[] }[] = [
	{ path: '/', sections: ['home', 'site'] },
	{ path: '/projects', sections: ['projects'] },
	{ path: '/people', sections: ['people'] },
	{ path: '/blog', sections: ['blog'] },
	{ path: '/about', sections: ['about'] }
];

const latest = (...dates: (Date | null | undefined)[]): Date | null =>
	dates.reduce<Date | null>((a, d) => (d && (!a || d > a) ? d : a), null);

const xml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: RequestHandler = async ({ url }) => {
	const [projectRows, postRows, sectionRows, [peopleRow]] = await Promise.all([
		db
			.select({ slug: projects.slug, updatedAt: projects.updatedAt })
			.from(projects)
			.where(eq(projects.published, true))
			.orderBy(projects.sortOrder),
		db
			.select({ slug: posts.slug, updatedAt: posts.updatedAt, publishedAt: posts.publishedAt })
			.from(posts)
			.where(
				and(
					eq(posts.status, 'published'),
					isNotNull(posts.publishedAt),
					lte(posts.publishedAt, sql`now()`)
				)
			)
			.orderBy(sql`${posts.publishedAt} desc`),
		db
			.select({ page: siteSections.page, updatedAt: max(siteSections.updatedAt) })
			.from(siteSections)
			.groupBy(siteSections.page),
		db.select({ updatedAt: max(people.updatedAt) }).from(people).where(eq(people.visible, true))
	]);

	const sectionDate = new Map(sectionRows.map((r) => [r.page, r.updatedAt]));
	// A post scheduled earlier and published later has changed at its publish time.
	const postDates = postRows.map((p) => latest(p.updatedAt, p.publishedAt));
	const newestPost = latest(...postDates);
	const newestProject = latest(...projectRows.map((p) => p.updatedAt));

	// Pages that list things change when those things do.
	const listDate: Record<string, Date | null> = {
		'/': latest(newestPost, newestProject),
		'/projects': newestProject,
		'/people': peopleRow?.updatedAt ?? null,
		'/blog': newestPost
	};

	const entries: Entry[] = [
		...STATIC_PAGES.map(({ path, sections }) => ({
			path,
			lastmod: latest(listDate[path], ...sections.map((s) => sectionDate.get(s)))
		})),
		...projectRows.map((p) => ({
			path: `/projects/${encodeURIComponent(p.slug)}`,
			lastmod: p.updatedAt
		})),
		...postRows.map((p, i) => ({
			path: `/blog/${encodeURIComponent(p.slug)}`,
			lastmod: postDates[i]
		}))
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(e) =>
			`  <url>\n    <loc>${xml(url.origin + e.path)}</loc>${
				e.lastmod ? `\n    <lastmod>${e.lastmod.toISOString()}</lastmod>` : ''
			}\n  </url>`
	)
	.join('\n')}
</urlset>
`;

	// Cached on Vercel's CDN like the public pages (publicCache in src/hooks.server.ts).
	return new Response(body, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
