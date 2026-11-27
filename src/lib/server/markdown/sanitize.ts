/**
 * Allowlists for post HTML. Everything a post renders passes through sanitize-html:
 *
 * - MAIN: what the Markdown (and any raw HTML in it) becomes. No style, no data-* and no event
 *   attributes, no iframes, scripts, SVG or MathML. Links and images are limited to http(s),
 *   mailto (links) and site paths. Classes and ids are limited to the ones the renderer makes.
 * - CODE, MATH and EMBED: narrow allowlists for the fragments we generate ourselves (Shiki
 *   tokens, KaTeX output, embed and media placeholders). Only these allow `style` (a hex colour
 *   on code spans; KaTeX's lengths and colours on spans) or data-* attributes (embeds).
 */
import sanitizeHtml from 'sanitize-html';
import type { FragmentKind } from './context.ts';

/** Text nodes inside these are dropped together with the tag. */
const DROP_WITH_CONTENT = [
	'script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed', 'svg',
	'math', 'template', 'title', 'select', 'button', 'canvas', 'video', 'audio', 'frameset',
	'frame', 'noembed', 'noframes', 'xmp', 'head'
];

/** Ids we produce: heading slugs and footnote ids (letters, digits, hyphens). */
const SAFE_ID = /^[\p{L}\p{N}][\p{L}\p{N}-]{0,99}$/u;

function keepSafeId(tagName: string, attribs: sanitizeHtml.Attributes) {
	if (attribs.id !== undefined && !SAFE_ID.test(attribs.id)) {
		const { id: _drop, ...rest } = attribs;
		return { tagName, attribs: rest };
	}
	return { tagName, attribs };
}

const HEADING_ATTRS = ['id'];

const MAIN: sanitizeHtml.IOptions = {
	allowedTags: [
		'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code', 'ul', 'ol',
		'li', 'strong', 'b', 'em', 'i', 'del', 's', 'ins', 'mark', 'small', 'abbr', 'a', 'img',
		'figure', 'figcaption', 'span', 'div', 'section', 'table', 'thead', 'tbody', 'tr', 'th',
		'td', 'sup', 'sub', 'kbd', 'samp', 'var', 'input', 'details', 'summary', 'dl', 'dt', 'dd'
	],
	allowedAttributes: {
		a: [
			'href', 'title', 'id', 'class', 'aria-label', 'aria-describedby',
			{ name: 'target', multiple: false, values: ['_blank'] },
			{ name: 'rel', multiple: true, values: ['noopener', 'noreferrer', 'nofollow'] }
		],
		img: ['src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height', { name: 'loading', multiple: false, values: ['lazy', 'eager'] }, { name: 'decoding', multiple: false, values: ['async'] }],
		h2: HEADING_ATTRS, h3: HEADING_ATTRS, h4: HEADING_ATTRS, h5: HEADING_ATTRS, h6: HEADING_ATTRS,
		span: ['class', 'aria-hidden'],
		div: ['class', 'tabindex', 'aria-label', { name: 'role', multiple: false, values: ['note', 'region', 'group'] }],
		figure: ['class'],
		ul: ['class'],
		li: ['id', 'class'],
		ol: ['start'],
		section: ['class', 'aria-labelledby'],
		sup: ['class', 'id'],
		abbr: ['title'],
		th: [{ name: 'align', multiple: false, values: ['left', 'center', 'right'] }],
		td: [{ name: 'align', multiple: false, values: ['left', 'center', 'right'] }],
		input: [{ name: 'type', multiple: false, values: ['checkbox'] }, 'checked', 'disabled'],
		details: ['open']
	},
	allowedClasses: {
		a: ['fn-ref-link', 'fn-back'],
		span: ['fig-label', 'fig-text', 'sr-only', 'gallery-key', 'callout-icon', 'callout-label', 'callout-heading'],
		div: [
			'figure-frame', 'table-wrap', 'callout', 'callout-note', 'callout-tip', 'callout-important',
			'callout-warning', 'callout-caution', 'callout-body', 'callout-title'
		],
		figure: ['figure', 'figure-plain', 'gallery', 'gallery-2', 'gallery-3'],
		ul: ['gallery-grid', 'task-list'],
		li: ['task', 'gallery-item'],
		section: ['footnotes'],
		sup: ['fn-ref']
	},
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedSchemesByTag: { img: ['http', 'https'] },
	allowProtocolRelative: false,
	nonTextTags: DROP_WITH_CONTENT,
	transformTags: {
		// Posts start below the page's h1, so "# Heading" becomes an h2.
		h1: 'h2',
		a: keepSafeId,
		li: keepSafeId,
		sup: keepSafeId,
		h2: keepSafeId,
		h3: keepSafeId,
		h4: keepSafeId,
		h5: keepSafeId,
		h6: keepSafeId,
		input: (tagName, attribs) =>
			attribs.type === 'checkbox'
				? {
						tagName,
						attribs: { type: 'checkbox', disabled: '', ...(attribs.checked !== undefined ? { checked: '' } : {}) }
					}
				: { tagName: 'span', attribs: {} }
	}
};

/** Shiki output: spans with one hex colour (and italic) inside our code block frame. */
const CODE: sanitizeHtml.IOptions = {
	allowedTags: ['div', 'pre', 'code', 'span'],
	allowedAttributes: {
		div: ['class'],
		pre: ['class', 'tabindex'],
		code: ['class'],
		span: ['class', 'style']
	},
	allowedClasses: {
		div: ['code-block', 'code-head', 'mermaid-block', 'has-numbers', 'has-title'],
		pre: ['code', 'mermaid-source'],
		code: [/^language-[a-z0-9+#-]{1,20}$/],
		span: ['line', 'hl', 'add', 'del', 'code-title', 'code-lang']
	},
	allowedStyles: {
		span: {
			color: [/^#[0-9a-f]{3,8}$/i],
			'font-style': [/^italic$/]
		}
	},
	nonTextTags: DROP_WITH_CONTENT
};

const LENGTH = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|ex|px|pt|mu|%)?$/;
const LENGTHS = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|ex|px|pt|mu|%)?(?: -?(?:\d+(?:\.\d+)?|\.\d+)(?:em|ex|px|pt|mu|%)?){0,3}$/;
const COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(?:,\s*[\d.]+\s*)?\))$/i;

const KATEX_STYLES: Record<string, RegExp[]> = {
	height: [LENGTH], width: [LENGTH], 'min-width': [LENGTH], 'max-width': [LENGTH],
	top: [LENGTH], bottom: [LENGTH], left: [LENGTH], right: [LENGTH],
	'vertical-align': [LENGTH, /^(?:top|middle|bottom|baseline)$/],
	margin: [LENGTHS], 'margin-left': [LENGTH], 'margin-right': [LENGTH], 'margin-top': [LENGTH], 'margin-bottom': [LENGTH],
	padding: [LENGTHS], 'padding-left': [LENGTH], 'padding-right': [LENGTH], 'padding-top': [LENGTH], 'padding-bottom': [LENGTH],
	'border-width': [LENGTHS], 'border-top-width': [LENGTH], 'border-bottom-width': [LENGTH],
	'border-right-width': [LENGTH], 'border-left-width': [LENGTH],
	'border-style': [/^(?:solid|dashed|dotted)$/], 'border-right-style': [/^(?:solid|dashed|dotted)$/],
	'border-color': [COLOR],
	position: [/^(?:relative|absolute)$/],
	color: [COLOR], 'background-color': [COLOR],
	'text-shadow': [/^(?:-?[\d.]+(?:em|px)?\s+){1,2}-?[\d.]+(?:em|px)?$/],
	'font-size': [LENGTH]
};

const MATHML_TAGS = [
	'math', 'semantics', 'annotation', 'mrow', 'mi', 'mn', 'mo', 'ms', 'mtext', 'mspace', 'msup',
	'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mover', 'munder', 'munderover', 'mtable',
	'mtr', 'mtd', 'mlabeledtr', 'mpadded', 'mphantom', 'mstyle', 'menclose', 'merror'
];

/** KaTeX output: spans with classes and inline lengths, MathML, and the SVG it draws with. */
const MATH: sanitizeHtml.IOptions = {
	allowedTags: ['div', 'span', ...MATHML_TAGS, 'svg', 'path', 'line'],
	allowedAttributes: {
		div: ['class', 'tabindex', 'aria-label', { name: 'role', multiple: false, values: ['group'] }],
		span: ['class', 'style', 'aria-hidden', 'title'],
		math: [{ name: 'xmlns', multiple: false, values: ['http://www.w3.org/1998/Math/MathML'] }, 'display'],
		annotation: [{ name: 'encoding', multiple: false, values: ['application/x-tex'] }],
		mi: ['mathvariant'],
		mn: ['mathvariant'],
		mtext: ['mathvariant'],
		mo: ['fence', 'stretchy', 'minsize', 'maxsize', 'mathvariant', 'separator', 'lspace', 'rspace', 'accent', 'movablelimits', 'form', 'largeop', 'symmetric'],
		mtable: ['rowspacing', 'columnalign', 'columnspacing', 'columnlines', 'rowlines', 'width', 'frame', 'framespacing', 'displaystyle', 'side'],
		mtr: ['columnalign', 'rowalign'],
		mtd: ['width', 'columnalign', 'rowalign', 'style'],
		mstyle: ['scriptlevel', 'displaystyle', 'mathcolor', 'mathsize', 'mathbackground', 'style'],
		mover: ['accent'],
		munder: ['accentunder'],
		munderover: ['accent', 'accentunder'],
		menclose: ['notation', 'mathbackground'],
		mpadded: ['width', 'lspace', 'height', 'depth', 'voffset', 'mathbackground'],
		mspace: ['width', 'height', 'depth', 'mathbackground'],
		mfrac: ['linethickness'],
		// Attribute names are lower-cased by the parser; browsers restore viewBox and
		// preserveAspectRatio when they parse SVG inside HTML.
		svg: [{ name: 'xmlns', multiple: false, values: ['http://www.w3.org/2000/svg'] }, 'width', 'height', 'viewbox', 'preserveaspectratio', 'style'],
		path: ['d'],
		line: ['x1', 'y1', 'x2', 'y2', 'stroke-width']
	},
	allowedClasses: {
		div: ['math-display'],
		span: [/^katex(?:-[a-z]+)*$/, /^(?:math-inline|math-display|math-display-inline)$/, /^[a-z][a-z0-9-]{0,40}$/]
	},
	allowedStyles: { span: KATEX_STYLES, svg: KATEX_STYLES, mstyle: { color: [COLOR] }, mtd: { width: [LENGTH] } },
	nonTextTags: ['script', 'style', 'textarea', 'iframe', 'object', 'embed', 'template', 'foreignobject']
};

/** Embed and media placeholders: posters, links, <video>, data-* for the client players. */
const EMBED: sanitizeHtml.IOptions = {
	allowedTags: ['figure', 'figcaption', 'div', 'span', 'a', 'img', 'video'],
	allowedAttributes: {
		figure: [
			'class', 'data-src', 'data-alt', 'data-id', 'data-start', 'data-hash', 'data-title',
			{ name: 'data-provider', multiple: false, values: ['youtube', 'vimeo'] }
		],
		div: ['class'],
		span: ['class', 'aria-hidden'],
		a: [
			'href', 'class', 'download',
			{ name: 'target', multiple: false, values: ['_blank'] },
			{ name: 'rel', multiple: true, values: ['noopener', 'noreferrer'] }
		],
		img: ['src', 'alt', 'class', 'width', 'height', { name: 'loading', multiple: false, values: ['lazy'] }, { name: 'decoding', multiple: false, values: ['async'] }],
		video: ['src', 'controls', 'playsinline', 'aria-label', { name: 'preload', multiple: false, values: ['metadata', 'none'] }]
	},
	allowedClasses: {
		figure: ['embed', 'embed-video', 'embed-youtube', 'embed-vimeo', 'media', 'media-video', 'media-model'],
		div: ['embed', 'embed-repo', 'model-stage', 'model-poster'],
		span: [
			'embed-play', 'embed-meta', 'embed-provider', 'embed-title', 'sr-only', 'fig-label', 'fig-text',
			'repo-icon', 'repo-text', 'repo-label', 'repo-name', 'repo-cta', 'repo-arrow', 'model-icon', 'model-label'
		],
		a: ['embed-poster', 'repo-card', 'model-link'],
		img: ['embed-thumb']
	},
	allowedSchemes: ['http', 'https'],
	allowedSchemesAppliedToAttributes: ['href', 'src', 'data-src'],
	allowProtocolRelative: false,
	nonTextTags: DROP_WITH_CONTENT.filter((t) => t !== 'video')
};

const FRAGMENT_OPTIONS: Record<FragmentKind, sanitizeHtml.IOptions> = { code: CODE, math: MATH, embed: EMBED };

export function sanitizeMain(html: string): string {
	return sanitizeHtml(html, MAIN);
}

export function sanitizeFragment(kind: FragmentKind, html: string): string {
	return sanitizeHtml(html, FRAGMENT_OPTIONS[kind]);
}

/** Plain text of some HTML (entities decoded is not needed: callers treat it as text). */
export function stripTags(html: string): string {
	return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {}, nonTextTags: DROP_WITH_CONTENT });
}
