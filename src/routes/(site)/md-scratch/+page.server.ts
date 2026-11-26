// TEMPORARY test page for PostBody (rich-markdown engineer). Delete after testing.
import { readFileSync } from 'node:fs';
import { renderPost } from '#lib/server/markdown.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const file = url.searchParams.get('f') ?? 'post-sample.md';
	if (!/^[\w.-]+\.md$/.test(file)) return { html: '', headings: [], readingMinutes: 0, words: 0 };
	const md = readFileSync(`/tmp/claude-0/-home-user-eic-website/81980587-00ab-5ed5-9613-93cba3332713/scratchpad/tmp-md/${file}`, 'utf8');
	const { html, headings, readingMinutes, words, features } = renderPost(md, { figureStart: 2 });
	return { html, headings, readingMinutes, words, features };
};
