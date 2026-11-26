import { Marked, Renderer, type Token, type Tokens } from 'marked';
import { isOptimizable, optimizedSrc, srcset } from '#lib/image.ts';
import { PH_END, PH_START, RenderContext, type Heading, type PostFeatures } from './markdown/context.ts';
import { embedHtml, figcaption, mediaKind, modelHtml, parseEmbedUrl, videoHtml, type Embed } from './markdown/embeds.ts';
import { blockExtensions, renderFootnotes } from './markdown/extensions.ts';
import { highlightLines, resolveLanguage } from './markdown/highlight.ts';
import { mathExtensions, renderMathFence } from './markdown/math.ts';
import { sanitizeFragment, sanitizeMain, stripTags } from './markdown/sanitize.ts';
import { countWords, escapeHtml, isExternalUrl, isSafeUrl, pad2, sizeFromUrl, slugify } from './markdown/util.ts';

/**
 * Markdown for blog posts. Posts are written by invited editors and stored as Markdown; they
 * are rendered here on the server (the public post page and the admin preview use the same
 * renderer) and sanitised, so a post can never inject scripts, styles or frames.
 *
 * On top of GitHub Flavoured Markdown (tables, task lists, strikethrough, autolinks):
 * - code fences highlighted with Shiki: ```ts title="grasp.ts" {1,3-5} showLineNumbers, ```diff
 * - ```mermaid diagrams (drawn in the browser), $math$ and $$math$$ with KaTeX
 * - callouts: > [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION]
 * - footnotes[^1], ==highlight==
 * - images: ![alt](url "Caption") is a numbered figure, several images in one paragraph make a
 *   gallery, .mp4/.webm give a video, .glb/.gltf a 3D model
 * - a paragraph that is only a YouTube, Vimeo or GitHub repository link becomes an embed
 * - heading ids, external links in a new tab, scrollable tables
 *
 * Smart quotes are off: quotes stay as typed. Supabase media images get a srcset through
 * Vercel Image Optimization (#lib/image.ts).
 */

export type { Heading, PostFeatures } from './markdown/context.ts';

export type RenderedPost = {
	/** Sanitised HTML for PostBody. */
	html: string;
	/** h2 and h3 headings, for a table of contents. */
	headings: Heading[];
	readingMinutes: number;
	words: number;
	/** Which optional features the post uses (PostBody loads code only for these). */
	features: PostFeatures;
};

export type RenderOptions = {
	/**
	 * Number of the first in-body figure. The post page passes 2 when the post has a cover,
	 * because the cover is Fig. 01.
	 */
	figureStart?: number;
};

const WORDS_PER_MINUTE = 220;

/** In-body images are at most the 720px text column wide. */
const BODY_SIZES = '(min-width: 784px) 720px, calc(100vw - 32px)';
const GALLERY_SIZES: Record<2 | 3, string> = {
	2: '(min-width: 784px) 360px, 50vw',
	3: '(min-width: 784px) 240px, 50vw'
};


/** Plain text of inline tokens (for heading ids, the table of contents and alt text). */
function plainText(tokens: Token[] | undefined): string {
	let out = '';
	for (const token of tokens ?? []) {
		const t = token as Tokens.Generic;
		if (t.type === 'footnoteRef') continue;
		if (t.type === 'br') out += ' ';
		else if (t.type === 'mathInline') out += t.text;
		else if (t.type === 'html' || t.type === 'tag') out += stripTags(t.text ?? '');
		else if (t.type === 'image') out += t.text ?? '';
		else if (Array.isArray(t.tokens) && t.tokens.length) out += plainText(t.tokens);
		else if (typeof t.text === 'string') out += t.text;
	}
	return out;
}

/** Same clean-up as marked's own links: encode spaces and the like, refuse broken URLs. */
function cleanUrl(href: string | null | undefined): string | null {
	if (!href) return null;
	try {
		return encodeURI(href.trim()).replace(/%25/g, '%');
	} catch {
		return null;
	}
}

/** An <img> for a post, with srcset/sizes for media bucket photos. */
function imgTag(src: string, alt: string, sizes = BODY_SIZES): string {
	const set = srcset(src);
	const size = isOptimizable(src) ? sizeFromUrl(src) : null;
	return (
		`<img src="${escapeHtml(optimizedSrc(src, 1280))}"` +
		(set ? ` srcset="${escapeHtml(set)}" sizes="${sizes}"` : '') +
		` alt="${escapeHtml(alt)}"` +
		(size ? ` width="${size.width}" height="${size.height}"` : '') +
		` loading="lazy" decoding="async">`
	);
}

type FenceMeta = { lang: string; title: string | null; lines: Set<number>; numbers: boolean };

/** ```ts title="grasp.ts" {1,3-5} showLineNumbers */
function parseFence(info: string | undefined): FenceMeta {
	const value = (info ?? '').trim();
	let lang = '';
	let rest = value;
	const first = /^([^\s{]+)/.exec(value);
	if (first && !first[1].includes('=')) {
		lang = first[1];
		rest = value.slice(first[0].length);
	}
	const titleMatch = /(?:^|\s)(?:title|filename|file)=(?:"([^"]*)"|'([^']*)'|(\S+))/i.exec(rest);
	const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? titleMatch?.[3] ?? '').trim().slice(0, 120) || null;
	const lines = new Set<number>();
	for (const group of rest.matchAll(/\{([\d,\s-]+)\}/g)) {
		for (const part of group[1].split(',')) {
			const range = /^\s*(\d{1,5})\s*(?:-\s*(\d{1,5}))?\s*$/.exec(part);
			if (!range) continue;
			const a = Number(range[1]);
			const b = range[2] ? Number(range[2]) : a;
			for (let n = Math.min(a, b); n <= Math.max(a, b) && n - Math.min(a, b) < 5000; n++) lines.add(n);
		}
	}
	const numbers = /(?:^|\s)(?:showLineNumbers|lineNumbers|numbers|linenos)(?=\s|$)/i.test(rest);
	return { lang, title, lines, numbers };
}

function codeBlock(ctx: RenderContext, text: string, info: string | undefined): string {
	const meta = parseFence(info);
	const typed = meta.lang.toLowerCase();

	if (typed === 'mermaid') {
		ctx.features.mermaid = true;
		if (ctx.mode === 'text') return '';
		const html = `<div class="mermaid-block"><pre class="mermaid-source">${escapeHtml(text)}</pre></div>`;
		return ctx.fragment('code', html, true);
	}
	if (typed === 'math' || typed === 'latex' || typed === 'tex' || typed === 'katex') {
		return renderMathFence(ctx, text);
	}
	if (ctx.mode === 'text') return '';

	const { id, label } = resolveLanguage(typed);
	const lines = highlightLines(text, id);
	const isDiff = id === 'diff';
	const body = lines
		.map((line, i) => {
			const classes = ['line'];
			if (meta.lines.has(i + 1)) classes.push('hl');
			if (isDiff) {
				const raw = text.split('\n')[i] ?? '';
				if (raw.startsWith('+') && !raw.startsWith('+++')) classes.push('add');
				else if (raw.startsWith('-') && !raw.startsWith('---')) classes.push('del');
			}
			return `<span class="${classes.join(' ')}">${line}</span>`;
		})
		.join('\n');
	const head =
		`<div class="code-head">` +
		(meta.title ? `<span class="code-title">${escapeHtml(meta.title)}</span>` : '') +
		(label ? `<span class="code-lang">${escapeHtml(label)}</span>` : '') +
		`</div>`;
	const blockClass = ['code-block', meta.title ? 'has-title' : '', meta.numbers ? 'has-numbers' : '']
		.filter(Boolean)
		.join(' ');
	const codeClass = id ? ` class="language-${id}"` : '';
	const html = `<div class="${blockClass}">${head}<pre class="code" tabindex="0"><code${codeClass}>${body}</code></pre></div>`;
	return ctx.fragment('code', html, true);
}

/** An embed as a block (fragment). */
function embedBlock(ctx: RenderContext, embed: Embed, title?: string, caption?: string | null): string {
	ctx.features.embed = true;
	if (ctx.mode === 'text') return '';
	const figure = caption ? ctx.nextFigure() : null;
	return ctx.fragment('embed', embedHtml(embed, { title, caption, figure }), true);
}

/** One image-syntax item standing alone in a paragraph: figure, video, model or embed. */
function blockMedia(ctx: RenderContext, image: Tokens.Image): string {
	const href = cleanUrl(image.href);
	const alt = plainText(image.tokens) || image.text || '';
	const caption = image.title?.trim() || null;
	if (!href || !isSafeUrl(href)) return ctx.mode === 'text' ? '' : `<p>${escapeHtml(alt)}</p>\n`;

	const embed = isExternalUrl(href) ? parseEmbedUrl(href) : null;
	if (embed) return embedBlock(ctx, embed, alt, caption);

	const kind = mediaKind(href);
	if (ctx.mode === 'text') return '';
	if (kind === 'video') {
		ctx.features.video = true;
		const figure = caption ? ctx.nextFigure() : null;
		return ctx.fragment('embed', videoHtml(href, alt, caption, figure), true);
	}
	if (kind === 'model') {
		ctx.features.model = true;
		const figure = caption ? ctx.nextFigure() : null;
		return ctx.fragment('embed', modelHtml(href, alt, caption, figure), true);
	}
	const figure = caption ? ctx.nextFigure() : null;
	return (
		`<figure class="${caption ? 'figure' : 'figure figure-plain'}">` +
		`<div class="figure-frame">${imgTag(href, alt)}</div>${figcaption(caption, figure)}</figure>\n`
	);
}

/** Several plain images in one paragraph: a 2 or 3 column gallery. */
function gallery(ctx: RenderContext, images: Tokens.Image[]): string {
	if (ctx.mode === 'text') return '';
	const columns: 2 | 3 = images.length === 2 || images.length === 4 ? 2 : 3;
	const captioned = images.some((img) => img.title?.trim());
	const items = images
		.map((img, i) => {
			const href = cleanUrl(img.href);
			const alt = plainText(img.tokens) || img.text || '';
			if (!href || !isSafeUrl(href)) return '';
			const key = captioned ? `<span class="gallery-key" aria-hidden="true">${String.fromCharCode(97 + (i % 26))}</span>` : '';
			return `<li class="gallery-item">${imgTag(href, alt, GALLERY_SIZES[columns])}${key}</li>`;
		})
		.join('');
	let caption = '';
	if (captioned) {
		const figure = ctx.nextFigure();
		const parts = images
			.map((img, i) => (img.title?.trim() ? `<b>(${String.fromCharCode(97 + (i % 26))})</b> ${escapeHtml(img.title.trim())}` : ''))
			.filter(Boolean)
			.join(' ');
		caption = `<figcaption><span class="fig-label">Fig. ${pad2(figure)}</span><span class="fig-text">${parts}</span></figcaption>`;
	}
	return `<figure class="gallery gallery-${columns}"><ul class="gallery-grid">${items}</ul>${caption}</figure>\n`;
}

function isPlainImage(image: Tokens.Image): boolean {
	const href = cleanUrl(image.href) ?? '';
	return !mediaKind(href) && !(isExternalUrl(href) && parseEmbedUrl(href));
}

function createMarked(ctx: RenderContext): Marked {
	const marked = new Marked({ gfm: true, breaks: false });
	marked.use({
		extensions: [...mathExtensions(ctx), ...blockExtensions(ctx)],
		renderer: {
			code(token) {
				return codeBlock(ctx, token.text, token.lang);
			},
			heading(token) {
				const text = plainText(token.tokens).replace(/\s+/g, ' ').trim();
				const depth = Math.min(6, Math.max(2, token.depth));
				const id = ctx.uniqueId(slugify(text));
				if (depth <= 3) ctx.headings.push({ id, text, depth });
				return `<h${depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${depth}>\n`;
			},
			paragraph(token) {
				const items = token.tokens.filter((t) => !(t.type === 'text' && !t.raw.trim()) && t.type !== 'br');
				// A paragraph that is only a link to YouTube, Vimeo or a GitHub repo.
				if (items.length === 1 && items[0].type === 'link') {
					const link = items[0] as Tokens.Link;
					const bare = link.autolink || link.text === link.href || link.raw.trim() === link.href;
					const embed = bare && isExternalUrl(link.href ?? '') ? parseEmbedUrl(link.href) : null;
					if (embed) return embedBlock(ctx, embed);
				}
				// A paragraph of only images (and videos, models, embeds in image syntax).
				if (items.length && items.every((t) => t.type === 'image')) {
					const images = (items as Tokens.Image[]).filter((image) => {
						const href = cleanUrl(image.href);
						return href && isSafeUrl(href);
					});
					if (!images.length) {
						const alts = (items as Tokens.Image[]).map((image) => plainText(image.tokens) || image.text).filter(Boolean);
						return ctx.mode === 'text' || !alts.length ? '' : `<p>${escapeHtml(alts.join(' '))}</p>\n`;
					}
					if (images.length >= 2 && images.every(isPlainImage)) return gallery(ctx, images);
					return images.map((image) => blockMedia(ctx, image)).join('');
				}
				return `<p>${this.parser.parseInline(token.tokens)}</p>\n`;
			},
			image(token) {
				// An image inside running text.
				const href = cleanUrl(token.href);
				const alt = plainText(token.tokens) || token.text || '';
				if (ctx.mode === 'text') return '';
				if (!href || !isSafeUrl(href)) return escapeHtml(alt);
				if (!isPlainImage(token)) {
					// Videos, models and embeds can't sit inside a sentence: link to them instead.
					const ext = isExternalUrl(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
					return `<a href="${escapeHtml(href)}"${ext}>${escapeHtml(alt || href)}</a>`;
				}
				return imgTag(href, alt);
			},
			link(token) {
				const inner = this.parser.parseInline(token.tokens);
				const href = cleanUrl(token.href);
				if (!href || !isSafeUrl(href, { allowMailto: true, allowAnchor: true })) return inner;
				if (ctx.mode === 'text') return inner;
				const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
				if (!isExternalUrl(href)) return `<a href="${escapeHtml(href)}"${title}>${inner}</a>`;
				return (
					`<a href="${escapeHtml(href)}"${title} target="_blank" rel="noopener noreferrer">` +
					`${inner}<span class="sr-only"> (opens in a new tab)</span></a>`
				);
			},
			table(token) {
				const html = Renderer.prototype.table.call(this, token);
				if (ctx.mode === 'text') return html;
				return `<div class="table-wrap" tabindex="0" role="region" aria-label="Table">${html}</div>\n`;
			},
			list(token) {
				const html = Renderer.prototype.list.call(this, token);
				return token.items.some((item) => item.task) ? html.replace(/^<ul>/, '<ul class="task-list">') : html;
			},
			listitem(item) {
				const inner = this.parser.parse(item.tokens);
				return item.task ? `<li class="task">${inner}</li>\n` : `<li>${inner}</li>\n`;
			},
			checkbox({ checked }) {
				return `<input type="checkbox" disabled${checked ? ' checked' : ''}> `;
			}
		}
	});
	return marked;
}

/** Leaf text of a token, for the word count. */
function tokenWords(token: Token): number {
	const t = token as Tokens.Generic;
	switch (t.type) {
		case 'text':
		case 'escape':
		case 'codespan':
			return Array.isArray(t.tokens) && t.tokens.length ? 0 : countWords(t.text ?? '');
		case 'code':
			return countWords(t.text ?? '');
		case 'mathInline':
		case 'mathBlock':
			return 1;
		case 'html':
			return countWords(stripTags(t.text ?? ''));
		default:
			return 0;
	}
}

function lex(marked: Marked, source: string): Token[] {
	return marked.lexer(source);
}

/** Replace fragment placeholders (in text only, never inside a tag) with their sanitised HTML. */
function spliceFragments(ctx: RenderContext, html: string): string {
	const fragments = ctx.fragments.map((f) => sanitizeFragment(f.kind, f.html));
	const placeholder = new RegExp(`${PH_START}${ctx.nonce}:(\\d+)${PH_END}`, 'g');
	const stray = new RegExp(`[${PH_START}${PH_END}]`, 'g');
	return html
		.replace(/(<[^>]*>)|([^<]+)/g, (_match, tag: string | undefined, text: string | undefined) =>
			tag !== undefined ? tag.replace(stray, '') : (text ?? '').replace(placeholder, (_m, i: string) => fragments[Number(i)] ?? '')
		)
		.replace(stray, '');
}

function cleanSource(markdown: string | null | undefined): string {
	return (markdown ?? '').replace(/[]/g, '').replace(/\r\n?/g, '\n');
}

const CACHE_LIMIT = 64;
const cache = new Map<string, RenderedPost>();

function copy(post: RenderedPost): RenderedPost {
	return { ...post, headings: post.headings.map((h) => ({ ...h })), features: { ...post.features } };
}

/** Render a post's Markdown to safe HTML, with its headings, reading time and features. */
export function renderPost(markdown: string, opts: RenderOptions = {}): RenderedPost {
	const source = cleanSource(markdown);
	const figureStart = Math.max(1, Math.floor(opts.figureStart ?? 1));
	const key = `${figureStart}\u0000${source}`;
	const hit = cache.get(key);
	if (hit) {
		cache.delete(key);
		cache.set(key, hit);
		return copy(hit);
	}

	const ctx = new RenderContext('html', figureStart);
	const marked = createMarked(ctx);
	const tokens = lex(marked, source);
	let words = 0;
	marked.walkTokens(tokens, (token) => {
		words += tokenWords(token);
	});

	let html = marked.parser(tokens);
	html += renderFootnotes(ctx, (blocks) => marked.parser(blocks));
	html = spliceFragments(ctx, sanitizeMain(html));

	const result: RenderedPost = {
		html,
		headings: ctx.headings,
		readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
		words,
		features: ctx.features
	};
	cache.set(key, result);
	if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
	return copy(result);
}

/** Render post Markdown to safe HTML (same as `renderPost(source).html`). */
export function renderMarkdown(source: string, opts: RenderOptions = {}): string {
	return renderPost(source, opts).html;
}

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (_m, code: string) => {
		const c = code.toLowerCase();
		if (c === 'amp') return '&';
		if (c === 'lt') return '<';
		if (c === 'gt') return '>';
		if (c === 'quot') return '"';
		if (c === 'apos' || c === '#39') return "'";
		if (c === 'nbsp') return ' ';
		const n = c.startsWith('#x') ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
		return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
	});
}

/**
 * Plain text of a post, for excerpts and meta descriptions: prose only (no code blocks,
 * diagrams, embeds or image alt text), math as its TeX source.
 */
export function markdownToText(source: string): string {
	const ctx = new RenderContext('text');
	const marked = createMarked(ctx);
	const tokens = lex(marked, cleanSource(source));
	let html = marked.parser(tokens);
	html += renderFootnotes(ctx, (blocks) => marked.parser(blocks));
	return decodeEntities(stripTags(html.replace(/<\/(p|h[1-6]|li|td|th|div|blockquote)>/gi, ' $&')))
		.replace(/\s+/g, ' ')
		.trim();
}

/** Words in a post (Thai counted by word, not by space). */
export function countPostWords(source: string): number {
	const ctx = new RenderContext('text');
	const marked = createMarked(ctx);
	let words = 0;
	marked.walkTokens(lex(marked, cleanSource(source)), (token) => {
		words += tokenWords(token);
	});
	return words;
}

/** Reading time at 220 words a minute, at least one minute. Cheap: lexes, no rendering. */
export function readingMinutes(source: string): number {
	return Math.max(1, Math.round(countPostWords(source) / WORDS_PER_MINUTE));
}

/** Headings (h2 and h3) for a table of contents. */
export function extractHeadings(source: string): Heading[] {
	return renderPost(source).headings;
}
