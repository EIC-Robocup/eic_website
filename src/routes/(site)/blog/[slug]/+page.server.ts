import { error } from '@sveltejs/kit';
import { SLUG_PATTERN } from '#lib/components/admin/posts/post-fields.ts';
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
	// Every saved slug matches the pattern, so anything else (a NUL byte, which Postgres
	// refuses with a 500) can be a 404 without asking the database.
	if (!SLUG_PATTERN.test(params.slug)) error(404, 'Post not found');
	// Only published posts whose publish time has passed; drafts and scheduled posts 404.
	const post = await getLivePost(params.slug);
	if (!post) error(404, 'Post not found');

	const coverUrl = post.coverUrl?.trim() || null;
	// The cover slot is always Fig. 01 (an image slot until a photo is set), so figures in the
	// body start at 02.
	const rendered = renderPost(post.body, { figureStart: 2 });

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
