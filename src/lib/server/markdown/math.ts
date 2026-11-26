/**
 * Math with KaTeX, rendered on the server: `$inline$`, `$$display$$` (inline or on their own
 * lines) and ```math fences. Output is MathML plus KaTeX's HTML; the page loads the KaTeX
 * stylesheet only for posts that have math (PostBody does it).
 *
 * Dollar rules, so prices are not math: "$5 and $10" stays text. An inline formula needs no
 * space after the opening `$`, no space before the closing `$`, and no digit right after it.
 * Write `\$` for a literal dollar sign.
 */
import katex from 'katex';
import type { TokenizerAndRendererExtension, Tokens } from 'marked';
import type { RenderContext } from './context.ts';
import { findLineStart } from './extensions.ts';
import { escapeHtml } from './util.ts';

/** Longest formula we render (KaTeX also caps macro expansion). */
const MAX_TEX = 4000;

/** Render TeX to KaTeX HTML+MathML. Never throws: errors come back in KaTeX's error style. */
export function renderTex(tex: string, display: boolean): string {
	const source = tex.length > MAX_TEX ? tex.slice(0, MAX_TEX) : tex;
	try {
		return katex.renderToString(source, {
			displayMode: display,
			output: 'htmlAndMathml',
			throwOnError: false,
			errorColor: '#FF6A6E',
			// trust: false keeps \href, \url, \includegraphics and \html* switched off.
			trust: false,
			strict: 'ignore',
			maxSize: 20,
			maxExpand: 500
		});
	} catch {
		return `<span class="katex-error">${escapeHtml(source)}</span>`;
	}
}

/** Display math wrapper: scrolls sideways on phones instead of overflowing the page. */
function displayBlock(ctx: RenderContext, tex: string): string {
	ctx.features.math = true;
	// Display formulas are left out of plain text (excerpts, meta descriptions).
	if (ctx.mode === 'text') return '';
	const html = `<div class="math-display" tabindex="0" role="group" aria-label="Equation">${renderTex(tex, true)}</div>`;
	return ctx.fragment('math', html, true);
}

export function mathExtensions(ctx: RenderContext): TokenizerAndRendererExtension[] {
	return [
		{
			name: 'mathBlock',
			level: 'block',
			start(src) {
				return findLineStart(src, '$$', /^ {0,3}\$\$/);
			},
			tokenizer(src) {
				const match = /^ {0,3}\$\$((?:\\[\s\S]|[^\\$])+?)\$\$[ \t]*(?:\n+|$)/.exec(src);
				if (!match) return undefined;
				const text = match[1].trim();
				if (!text) return undefined;
				return { type: 'mathBlock', raw: match[0], text };
			},
			renderer(token) {
				return displayBlock(ctx, (token as Tokens.Generic).text as string);
			}
		},
		{
			name: 'mathInline',
			level: 'inline',
			start(src) {
				const index = src.indexOf('$');
				return index < 0 ? undefined : index;
			},
			tokenizer(src) {
				if (src[0] !== '$') return undefined;
				// $$...$$ inside a line: display style.
				let match = /^\$\$(?!\$)((?:\\[\s\S]|[^\\$])+?)\$\$(?!\$)/.exec(src);
				if (match && match[1].trim() && !/\n[ \t]*\n/.test(match[1])) {
					return { type: 'mathInline', raw: match[0], text: match[1].trim(), display: true };
				}
				match = /^\$(?![\s$])((?:\\[\s\S]|[^\\$])+?)(?<![\s\\])\$(?![\d$])/.exec(src);
				if (match && !/\n[ \t]*\n/.test(match[1])) {
					return { type: 'mathInline', raw: match[0], text: match[1], display: false };
				}
				return undefined;
			},
			renderer(token) {
				const { text, display } = token as Tokens.Generic & { text: string; display: boolean };
				ctx.features.math = true;
				if (ctx.mode === 'text') return escapeHtml(text);
				const html = display
					? `<span class="math-display math-display-inline">${renderTex(text, true)}</span>`
					: `<span class="math-inline">${renderTex(text, false)}</span>`;
				return ctx.fragment('math', html, false);
			}
		}
	];
}

/** For ```math fences (called by the code renderer). */
export function renderMathFence(ctx: RenderContext, tex: string): string {
	return displayBlock(ctx, tex.trim());
}
