import { isHttpError } from '@sveltejs/kit';
import { requireEditor } from '#lib/server/auth.ts';
import { renderPost } from '#lib/server/markdown.ts';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

/** Posts longer than this are refused (a long post is about 60 KB of Markdown). */
const MAX_BYTES = 200 * 1024;

function problem(status: number, message: string): Response {
	return Response.json({ message }, { status, headers: NO_STORE });
}

/**
 * Live preview for the post editor: JSON `{ markdown, figureStart? }` →
 * `{ html, headings, readingMinutes, words, features }`, rendered by exactly the renderer the
 * public post page uses. Show `html` with <PostBody html={...} />.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		requireEditor(locals);
	} catch (err) {
		if (isHttpError(err)) return problem(err.status, err.body.message);
		throw err;
	}

	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_BYTES + 1024) return problem(413, 'The post is too long to preview (200 KB at most).');

	let body: unknown;
	try {
		const text = await request.text();
		if (new TextEncoder().encode(text).length > MAX_BYTES + 1024) {
			return problem(413, 'The post is too long to preview (200 KB at most).');
		}
		body = JSON.parse(text);
	} catch {
		return problem(400, 'Send JSON like { "markdown": "..." }.');
	}

	const markdown = (body as { markdown?: unknown } | null)?.markdown;
	if (typeof markdown !== 'string') return problem(400, 'Send JSON like { "markdown": "..." }.');
	if (new TextEncoder().encode(markdown).length > MAX_BYTES) {
		return problem(413, 'The post is too long to preview (200 KB at most).');
	}
	const rawStart = (body as { figureStart?: unknown }).figureStart;
	const figureStart = typeof rawStart === 'number' && Number.isInteger(rawStart) && rawStart >= 1 && rawStart <= 99 ? rawStart : 1;

	try {
		const { html, headings, readingMinutes, words, features } = renderPost(markdown, { figureStart });
		return Response.json({ html, headings, readingMinutes, words, features }, { headers: NO_STORE });
	} catch (err) {
		console.error('Preview failed', err);
		return problem(500, 'Could not render the preview.');
	}
};
