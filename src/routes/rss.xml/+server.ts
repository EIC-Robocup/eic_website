import { listPublishedPosts } from '#lib/server/queries/site.ts';
import { categoryLabel } from '#lib/components/site/format.ts';
import type { RequestHandler } from './$types';

/** The blog's RSS 2.0 feed: the 20 newest published posts. */

const FEED_SIZE = 20;
const TITLE = 'EIC Chula blog';
const DESCRIPTION =
	'Race reports, build logs and research notes from EIC Chula, the robotics team of Chulalongkorn University.';

function xml(text: string): string {
	return (
		text
			// Characters XML 1.0 does not allow at all.
			.replace(/[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu, '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;')
	);
}

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;
	const posts = await listPublishedPosts({ limit: FEED_SIZE });
	const lastBuild = posts[0]?.publishedAt ?? new Date();

	const items = posts
		.map((post) => {
			const link = `${origin}/blog/${encodeURIComponent(post.slug)}`;
			const lines = [
				`<title>${xml(post.title)}</title>`,
				`<link>${xml(link)}</link>`,
				`<guid isPermaLink="true">${xml(link)}</guid>`,
				`<pubDate>${post.publishedAt.toUTCString()}</pubDate>`,
				post.excerpt?.trim() ? `<description>${xml(post.excerpt.trim())}</description>` : '',
				`<category>${xml(categoryLabel(post.category))}</category>`,
				post.authorName?.trim() ? `<dc:creator>${xml(post.authorName.trim())}</dc:creator>` : ''
			].filter(Boolean);
			return `<item>\n      ${lines.join('\n      ')}\n    </item>`;
		})
		.join('\n    ');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xml(TITLE)}</title>
    <link>${xml(`${origin}/blog`)}</link>
    <description>${xml(DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${xml(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>
`;

	// Cached on Vercel's CDN like the public pages (publicCache in src/hooks.server.ts).
	return new Response(body, {
		headers: { 'content-type': 'application/rss+xml; charset=utf-8' }
	});
};
