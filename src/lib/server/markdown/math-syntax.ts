/**
 * The math syntax alone: tokenizers for `$inline$`, `$$display$$` and `$$...$$` blocks, with no
 * renderer and no KaTeX. math.ts adds the renderers; reading.ts lexes with these so a reading
 * time never loads KaTeX. See math.ts for the dollar rules.
 */
import type { TokenizerExtension } from 'marked';
import { findLineStart } from './extensions.ts';

export const mathBlockSyntax: TokenizerExtension = {
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
	}
};

export const mathInlineSyntax: TokenizerExtension = {
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
	}
};
