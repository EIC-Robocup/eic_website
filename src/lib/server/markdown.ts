import { Marked, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Markdown for blog posts. Posts are written by invited editors and stored in the
 * database; they are rendered here on the server and sanitised before they reach
 * the page, so a post can never inject scripts or styles.
 *
 * Extras over plain Markdown:
 * - an image with a title becomes a numbered figure: ![alt](url "Caption")
 * - headings get ids so they can be linked to
 * - external links open in a new tab with rel="noopener noreferrer"
 */

function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/<[^>]+>/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function createMarked() {
	let figure = 0;
	const usedIds = new Map<string, number>();

	const marked = new Marked({
		gfm: true,
		breaks: false,
		renderer: {
			paragraph(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Paragraph) {
				const inline = this.parser.parseInline(token.tokens);
				// A paragraph holding only a captioned image becomes a bare <figure>, not <p><figure>.
				const only = token.tokens.filter((t) => !(t.type === 'text' && !t.raw.trim()));
				if (only.length === 1 && only[0].type === 'image' && (only[0] as Tokens.Image).title) {
					return inline + '\n';
				}
				return `<p>${inline}</p>\n`;
			},
			heading(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Heading) {
				const html = this.parser.parseInline(token.tokens);
				const base = slugify(html) || 'section';
				const seen = usedIds.get(base) ?? 0;
				usedIds.set(base, seen + 1);
				const id = seen ? `${base}-${seen}` : base;
				return `<h${token.depth} id="${id}">${html}</h${token.depth}>\n`;
			},
			image(token: Tokens.Image) {
				const src = escapeAttr(token.href ?? '');
				const alt = escapeAttr(token.text ?? '');
				const img = `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
				if (!token.title) return img;
				figure += 1;
				const label = `Fig. ${String(figure).padStart(2, '0')}`;
				return `<figure>${img}<figcaption><span class="fig-label">${label}</span> ${escapeAttr(token.title)}</figcaption></figure>`;
			},
			link(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Link) {
				const text = this.parser.parseInline(token.tokens);
				const href = escapeAttr(token.href ?? '');
				const title = token.title ? ` title="${escapeAttr(token.title)}"` : '';
				const external = /^https?:\/\//i.test(token.href ?? '');
				const target = external ? ' target="_blank" rel="noopener noreferrer"' : '';
				return `<a href="${href}"${title}${target}>${text}</a>`;
			}
		}
	});

	return marked;
}

const SANITIZE: sanitizeHtml.IOptions = {
	allowedTags: [
		'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
		'ul', 'ol', 'li', 'strong', 'em', 'del', 's', 'a', 'img', 'figure', 'figcaption',
		'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub', 'kbd', 'input'
	],
	allowedAttributes: {
		a: ['href', 'title', 'target', 'rel'],
		img: ['src', 'alt', 'loading', 'decoding', 'width', 'height'],
		h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
		span: ['class'],
		code: ['class'],
		th: ['align'], td: ['align'],
		ol: ['start'],
		// GFM task list checkboxes
		input: ['type', 'checked', 'disabled']
	},
	allowedClasses: {
		span: ['fig-label'],
		code: [/^language-[\w-]+$/]
	},
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedSchemesByTag: { img: ['http', 'https'] },
	allowProtocolRelative: false,
	transformTags: {
		// Posts start below the page's h1, so a "# Heading" becomes an h2.
		h1: 'h2',
		input: (tagName, attribs) =>
			attribs.type === 'checkbox'
				? { tagName, attribs: { type: 'checkbox', disabled: 'disabled', ...(attribs.checked !== undefined ? { checked: 'checked' } : {}) } }
				: { tagName: 'span', attribs: {} }
	}
};

/** Render post Markdown to safe HTML. */
export function renderMarkdown(source: string): string {
	const html = createMarked().parse(source ?? '', { async: false }) as string;
	return sanitizeHtml(html, SANITIZE);
}

/** Plain-text version of Markdown, for excerpts and meta descriptions. */
export function markdownToText(source: string): string {
	const html = createMarked().parse(source ?? '', { async: false }) as string;
	return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
		.replace(/\s+/g, ' ')
		.trim();
}

/** Reading time at 220 words a minute, at least one minute. */
export function readingMinutes(source: string): number {
	const words = markdownToText(source).split(' ').filter(Boolean).length;
	return Math.max(1, Math.round(words / 220));
}

/** Headings (h2 and h3) for a table of contents. */
export function extractHeadings(source: string): { id: string; text: string; depth: number }[] {
	const html = renderMarkdown(source);
	const out: { id: string; text: string; depth: number }[] = [];
	for (const m of html.matchAll(/<h([23]) id="([^"]+)">(.*?)<\/h\1>/g)) {
		out.push({
			depth: Number(m[1]),
			id: m[2],
			text: sanitizeHtml(m[3], { allowedTags: [], allowedAttributes: {} })
		});
	}
	return out;
}
