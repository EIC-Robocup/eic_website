import { error } from '@sveltejs/kit';
import { renderPost } from '#lib/server/markdown.ts';
import { getLivePost, type BlogCard } from '../posts.server.ts';
import type { PageServerLoad } from './$types';

const card = (p: BlogCard) => ({
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
	const post = await getLivePost(params.slug);
	if (!post) error(404, 'Post not found');

	const coverUrl = post.coverUrl?.trim() || null;
	// The cover is Fig. 01, so figures in the body start at 02 when there is one.
	const rendered = renderPost(post.body, { figureStart: coverUrl ? 2 : 1 });

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
		related: post.related.map(card)
	};
};
