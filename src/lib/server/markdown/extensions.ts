/**
 * Marked extensions for block and inline syntax beyond GFM:
 *
 * - Callouts (GitHub alerts): `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`,
 *   with an optional title on the same line: `> [!TIP] Calibrate first`.
 * - Footnotes: `text[^1]` and `[^1]: The note.` (indent following lines to continue it). Notes
 *   are numbered by first reference and listed at the end under "Notes", with back links.
 * - Highlight: `==marked text==`.
 */
import type { Token, TokenizerAndRendererExtension, Tokens } from 'marked';
import type { RenderContext } from './context.ts';
import { escapeHtml } from './util.ts';

export const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

const CALLOUT_LABELS: Record<CalloutType, string> = {
	note: 'Note',
	tip: 'Tip',
	important: 'Important',
	warning: 'Warning',
	caution: 'Caution'
};

const CALLOUT_HEAD = /^ {0,3}> ?\[!(note|tip|important|warning|caution)\][ \t]*([^\n]*)(?:\n|$)/i;

function calloutExtension(ctx: RenderContext): TokenizerAndRendererExtension {
	return {
		name: 'callout',
		level: 'block',
		start(src) {
			const match = /^ {0,3}> ?\[!(?:note|tip|important|warning|caution)\]/im.exec(src);
			return match ? match.index : undefined;
		},
		tokenizer(src) {
			const head = CALLOUT_HEAD.exec(src);
			if (!head) return undefined;
			// The rest of the quote: following lines that start with ">".
			const rest = /^(?: {0,3}>[^\n]*(?:\n|$))*/.exec(src.slice(head[0].length))?.[0] ?? '';
			const raw = head[0] + rest;
			const body = rest
				.split('\n')
				.map((line) => line.replace(/^ {0,3}> ?/, ''))
				.join('\n');
			const type = head[1].toLowerCase() as CalloutType;
			const title = head[2].trim();
			const token: Tokens.Generic = { type: 'callout', raw, calloutType: type, title, titleTokens: [], tokens: [] };
			if (title) this.lexer.inline(title, token.titleTokens as Token[]);
			this.lexer.blockTokens(body, token.tokens as Token[]);
			return token;
		},
		renderer(token) {
			const type = token.calloutType as CalloutType;
			if (ctx.mode === 'text') {
				const title = token.title ? `<p>${this.parser.parseInline(token.titleTokens as Token[])}</p>` : '';
				return `${title}${this.parser.parse(token.tokens as Token[])}`;
			}
			const heading = token.title
				? `<span class="callout-heading">${this.parser.parseInline(token.titleTokens as Token[])}</span>`
				: '';
			return (
				`<div class="callout callout-${type}" role="note">` +
				`<div class="callout-title"><span class="callout-icon" aria-hidden="true"></span>` +
				`<span class="callout-label">${CALLOUT_LABELS[type]}</span>${heading}</div>` +
				`<div class="callout-body">${this.parser.parse(token.tokens as Token[])}</div></div>\n`
			);
		},
		childTokens: ['titleTokens', 'tokens']
	};
}

const FOOTNOTE_DEF = /^ {0,3}\[\^([^\]\s]{1,40})\]:[ \t]?/;
/** Lines that start a new block and so end a lazy footnote continuation. */
const BLOCK_START = /^ {0,3}(?:#{1,6}(?:\s|$)|>|[-*+]\s|\d{1,9}[.)]\s|```|~~~|\$\$|\||<\w)/;

export function footnoteId(n: number): string {
	return `fn--${n}`;
}
export function footnoteRefId(n: number, occurrence: number): string {
	return occurrence > 1 ? `fnref--${n}--${occurrence}` : `fnref--${n}`;
}

function footnoteDefExtension(ctx: RenderContext): TokenizerAndRendererExtension {
	return {
		name: 'footnoteDef',
		level: 'block',
		start(src) {
			const match = /^ {0,3}\[\^[^\]\s]{1,40}\]:/m.exec(src);
			return match ? match.index : undefined;
		},
		tokenizer(src) {
			const head = FOOTNOTE_DEF.exec(src);
			if (!head) return undefined;
			const lines = src.slice(head[0].length).split('\n');
			const body = [lines[0]];
			let i = 1;
			for (; i < lines.length; i++) {
				const line = lines[i];
				if (FOOTNOTE_DEF.test(line)) break;
				if (line.trim() === '') {
					// A blank line continues the note only when indented lines follow it.
					let j = i;
					while (j < lines.length && lines[j].trim() === '') j++;
					if (j < lines.length && /^(?: {2,}|\t)/.test(lines[j])) {
						body.push(...lines.slice(i, j).map(() => ''));
						i = j - 1;
						continue;
					}
					break;
				}
				if (/^(?: {2,}|\t)/.test(line)) {
					body.push(line.replace(/^(?: {1,4}|\t)/, ''));
					continue;
				}
				// Lazy continuation of the note's last paragraph.
				if (body[body.length - 1].trim() !== '' && !BLOCK_START.test(line)) {
					body.push(line);
					continue;
				}
				break;
			}
			const consumed = lines.slice(0, i).join('\n');
			const raw = src.slice(0, head[0].length + consumed.length + (i < lines.length ? 1 : 0));
			const label = head[1].toLowerCase();
			const tokens: Token[] = [];
			this.lexer.blockTokens(body.join('\n'), tokens);
			if (!ctx.footnotes.has(label)) ctx.footnotes.set(label, { label, tokens });
			return { type: 'footnoteDef', raw, label, tokens };
		},
		renderer() {
			// Notes are rendered together at the end of the post (renderFootnotes).
			return '';
		}
	};
}

function footnoteRefExtension(ctx: RenderContext): TokenizerAndRendererExtension {
	return {
		name: 'footnoteRef',
		level: 'inline',
		start(src) {
			const index = src.indexOf('[^');
			return index < 0 ? undefined : index;
		},
		tokenizer(src) {
			const match = /^\[\^([^\]\s]{1,40})\]/.exec(src);
			if (!match) return undefined;
			const label = match[1].toLowerCase();
			if (!ctx.footnotes.has(label)) return undefined;
			return { type: 'footnoteRef', raw: match[0], label };
		},
		renderer(token) {
			const label = token.label as string;
			let n = ctx.footnoteOrder.get(label);
			if (!n) {
				n = ctx.footnoteOrder.size + 1;
				ctx.footnoteOrder.set(label, n);
			}
			const occurrence = (ctx.footnoteRefs.get(label) ?? 0) + 1;
			ctx.footnoteRefs.set(label, occurrence);
			if (ctx.mode === 'text') return '';
			return (
				`<sup class="fn-ref" id="${footnoteRefId(n, occurrence)}">` +
				`<a class="fn-ref-link" href="#${footnoteId(n)}" aria-describedby="footnotes--label">${n}</a></sup>`
			);
		}
	};
}

function markExtension(): TokenizerAndRendererExtension {
	return {
		name: 'mark',
		level: 'inline',
		start(src) {
			const index = src.indexOf('==');
			return index < 0 ? undefined : index;
		},
		tokenizer(src) {
			const match = /^==(?=[^\s=])([^\n]*?[^\s=])==(?!=)/.exec(src);
			if (!match) return undefined;
			return { type: 'mark', raw: match[0], text: match[1], tokens: this.lexer.inlineTokens(match[1]) };
		},
		renderer(token) {
			return `<mark>${this.parser.parseInline(token.tokens as Token[])}</mark>`;
		}
	};
}

export function blockExtensions(ctx: RenderContext): TokenizerAndRendererExtension[] {
	return [calloutExtension(ctx), footnoteDefExtension(ctx), footnoteRefExtension(ctx), markExtension()];
}

/**
 * The "Notes" section: every referenced footnote in order, each with links back to where it
 * was referenced. `renderBlocks` renders a note's block tokens.
 */
export function renderFootnotes(ctx: RenderContext, renderBlocks: (tokens: Token[]) => string): string {
	if (!ctx.footnoteOrder.size) return '';
	const items: string[] = [];
	for (const [label, n] of ctx.footnoteOrder) {
		const def = ctx.footnotes.get(label);
		if (!def) continue;
		let content = renderBlocks(def.tokens).trim();
		if (ctx.mode === 'text') {
			items.push(content);
			continue;
		}
		const count = ctx.footnoteRefs.get(label) ?? 1;
		const backs = Array.from({ length: count }, (_, i) => {
			const suffix = count > 1 ? ` (${i + 1})` : '';
			return `<a class="fn-back" href="#${footnoteRefId(n, i + 1)}" aria-label="Back to reference ${n}${suffix}">↩</a>`;
		}).join(' ');
		// Put the back links at the end of the note's last paragraph.
		if (content.endsWith('</p>')) content = `${content.slice(0, -4)} ${backs}</p>`;
		else content = `${content}<p>${backs}</p>`;
		items.push(`<li id="${footnoteId(n)}">${content}</li>`);
	}
	if (ctx.mode === 'text') return items.map((item) => `<p>${item}</p>`).join('\n');
	return (
		`<section class="footnotes" aria-labelledby="footnotes--label">` +
		`<h2 id="footnotes--label">Notes</h2><ol>${items.join('')}</ol></section>\n`
	);
}


