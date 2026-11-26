import { error } from '@sveltejs/kit';
import { getPublishedPostBySlug, type PostCard } from '#lib/server/queries/site.ts';
import * as markdown from '#lib/server/markdown.ts';

// TEMP until renderPost lands in markdown.ts (another engineer is adding it).
type Rendered = {
	html: string;
	headings: { id: string; text: string; depth: number }[];
	readingMinutes: number;
	words: number;
	features?: { math?: boolean };
};
const renderPost = (markdown as unknown as Record<string, unknown>).renderPost as
	| ((source: string, opts: { figureStart: number }) => Rendered)
	| undefined;
import type { PageServerLoad } from './$types';

const card = (p: PostCard) => ({
	id: p.id,
	slug: p.slug,
	title: p.title,
	category: p.category,
	publishedAt: p.publishedAt,
	coverUrl: p.coverUrl,
	coverAlt: p.coverAlt
});

export const load: PageServerLoad = async ({ params }) => {
	// Only published posts whose publish time has passed; drafts and scheduled posts 404.
	const post = await getPublishedPostBySlug(params.slug);
	if (!post) error(404, 'Post not found');

	const coverUrl = post.coverUrl?.trim() || null;
	// The cover is Fig. 01, so figures in the body start at 02 when there is one.
	const rendered: Rendered = renderPost
		? renderPost(post.body, { figureStart: coverUrl ? 2 : 1 })
		: { html: post.html, headings: post.headings, readingMinutes: post.readingMinutes, words: 0 };

	return {
		post: {
			slug: post.slug,
			title: post.title,
			excerpt: post.excerpt?.trim() || null,
			category: post.category,
			authorName: post.authorName?.trim() || null,
			publishedAt: post.publishedAt,
			updatedAt: post.updatedAt,
			coverUrl,
			coverAlt: post.coverAlt?.trim() || '',
			coverCaption: post.coverCaption?.trim() || null,
			tags: post.tags.map((t) => t.trim()).filter(Boolean),
			project: post.project
		},
		html: rendered.html,
		headings: rendered.headings,
		readingMinutes: rendered.readingMinutes,
		words: rendered.words,
		math: Boolean(rendered.features?.math),
		related: post.related.map(card)
	};
};
