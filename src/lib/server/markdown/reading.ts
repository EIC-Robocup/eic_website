/**
 * Word counts and reading time for post Markdown, without loading the renderer's heavy parts
 * (Shiki and its grammars, KaTeX, sanitize-html). Lists of post cards only need a reading time,
 * so #lib/server/queries/site.ts imports this module, not markdown.ts.
 *
 * The count is the renderer's own: the same lexer and syntax extensions, and markdown.ts counts
 * through `tokenWords` and `cleanSource` from here, so a card and its post page always agree.
 */
import { Marked, type Token, type Tokens } from 'marked';
import { RenderContext } from './context.ts';
import { blockExtensions } from './extensions.ts';
import { mathBlockSyntax, mathInlineSyntax } from './math-syntax.ts';
import { countWords } from './util.ts';

export const WORDS_PER_MINUTE = 220;

/** Reading time for a word count: 220 words a minute, at least one minute. */
export function minutesFor(words: number): number {
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** The source as every renderer pass sees it. */
export function cleanSource(markdown: string | null | undefined): string {
	return (
		(markdown ?? '')
			// Private-use characters are reserved for fragment placeholders (context.ts).
			.replace(/[]/g, '')
			.replace(/\r\n?/g, '\n')
			// Marked recurses once per quote level; cap the nesting so a line of ">>>>..." can't
			// overflow the stack.
			.replace(/^((?:[ \t]*>){12})(?:[ \t]*>)+/gm, '$1')
	);
}

/** Elements whose content is never read as text (as in sanitize.ts). */
const NON_TEXT = /<(script|style|textarea|option|noscript|iframe|object|embed|svg|math|template|title|select|button|canvas|video|audio|frameset|frame|noembed|noframes|xmp|head)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;

/** A start or end tag, with any `>` inside quoted attribute values (not a lone `<`). */
const TAG = /<\/?[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>?/g;
/** A character reference such as `&nbsp;`, `&#8212;` or `&#x2014;`. */
const ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/gi;

/**
 * Words in raw HTML from a post: comments, tags, non-text elements and character references
 * left out, so `&nbsp;` is a space, not a word, and a `<` in text doesn't swallow the line.
 */
function htmlWords(html: string): number {
	return countWords(
		html
			.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
			.replace(NON_TEXT, ' ')
			.replace(TAG, ' ')
			.replace(ENTITY, ' ')
	);
}

/** Leaf text of a token, for the word count. */
export function tokenWords(token: Token): number {
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
			return htmlWords(t.text ?? '');
		default:
			return 0;
	}
}

/** Words in a post (Thai counted by word, not by space). Lexes only; renders nothing. */
export function countPostWords(source: string): number {
	const clean = cleanSource(source);
	try {
		const marked = new Marked({ gfm: true, breaks: false });
		marked.use({ extensions: [mathBlockSyntax, mathInlineSyntax, ...blockExtensions(new RenderContext('text'))] });
		let words = 0;
		marked.walkTokens(marked.lexer(clean), (token) => {
			words += tokenWords(token);
		});
		return words;
	} catch {
		return countWords(clean);
	}
}

/** Reading time at 220 words a minute, at least one minute. */
export function readingMinutes(source: string): number {
	return minutesFor(countPostWords(source));
}
