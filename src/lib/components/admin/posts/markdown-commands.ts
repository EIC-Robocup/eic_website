/**
 * Text commands for the Markdown editor, as pure functions: each takes the textarea's value and
 * selection and returns one `Edit` (replace `from..to` with `insert`, then select `select`), or
 * null when it does not apply. MarkdownEditor applies edits with `execCommand('insertText')`
 * so the browser's undo history keeps working. No DOM here, so it can be tested in Node.
 */

export type Range = { start: number; end: number };

export type Edit = {
	from: number;
	to: number;
	insert: string;
	/** Selection after the edit, in the new text. */
	select: Range;
};

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Start and end of the lines the selection touches (a selection ending at a line start skips that line). */
export function lineBounds(value: string, sel: Range): Range {
	const start = value.lastIndexOf('\n', sel.start - 1) + 1;
	let endAt = sel.end;
	if (sel.end > sel.start && value[sel.end - 1] === '\n') endAt = sel.end - 1;
	const nl = value.indexOf('\n', endAt);
	return { start, end: nl === -1 ? value.length : nl };
}

/** The selection with surrounding whitespace moved outside it ("  bold " → "bold"). */
function trimSelection(value: string, sel: Range): Range {
	let { start, end } = sel;
	while (start < end && /\s/.test(value[start])) start++;
	while (end > start && /\s/.test(value[end - 1])) end--;
	return { start, end };
}

/** Lines before `index` that open a ``` fence, odd = inside a code block. */
export function insideFence(value: string, index: number): boolean {
	const before = value.slice(0, value.lastIndexOf('\n', index - 1) + 1);
	const fences = before.match(/^\s{0,3}(```|~~~)/gm);
	return (fences?.length ?? 0) % 2 === 1;
}

/**
 * Replace the selection with a block on its own paragraph: blank lines are added before and
 * after when the neighbouring text needs them. `caret` is where to put the selection, as
 * offsets inside `block` (default: after it).
 */
export function insertBlock(value: string, sel: Range, block: string, caret?: Range): Edit {
	const before = value.slice(0, sel.start);
	const after = value.slice(sel.end);
	let lead = '';
	if (before.length && !before.endsWith('\n\n')) lead = before.endsWith('\n') ? '\n' : '\n\n';
	let trail = '';
	if (after.length && !after.startsWith('\n\n')) trail = after.startsWith('\n') ? '\n' : '\n\n';
	// At the end of the post: a fresh paragraph after the block, so typing on doesn't join it
	// (a line right under a table or an embed link would become part of it).
	else if (!after.length) trail = caret ? '\n' : '\n\n';
	const insert = lead + block + trail;
	const base = sel.start + lead.length;
	const end = !after.length ? base + insert.length - lead.length : base + block.length;
	const select = caret ? { start: base + caret.start, end: base + caret.end } : { start: end, end };
	return { from: sel.start, to: sel.end, insert, select };
}

/* ------------------------------------------------------------------------------------------ */
/* Inline wrapping                                                                             */
/* ------------------------------------------------------------------------------------------ */

/**
 * Bold, italic, inline code, strikethrough, highlight and inline math: wrap the selection in
 * `marker`, or unwrap it when it is already wrapped. With nothing selected, insert
 * `placeholder` wrapped and select it, or step over a closing marker right after the caret.
 */
export function toggleInline(value: string, sel: Range, marker: string, placeholder: string): Edit {
	const len = marker.length;
	if (sel.start === sel.end) {
		if (value.slice(sel.start, sel.start + len) === marker && value.slice(0, sel.start).includes(marker)) {
			const at = sel.start + len;
			return { from: sel.start, to: sel.start, insert: '', select: { start: at, end: at } };
		}
		const insert = marker + placeholder + marker;
		return {
			from: sel.start,
			to: sel.end,
			insert,
			select: { start: sel.start + len, end: sel.start + len + placeholder.length }
		};
	}

	// Already wrapped just outside the selection: **[bold]**
	if (
		sel.start >= len &&
		value.slice(sel.start - len, sel.start) === marker &&
		value.slice(sel.end, sel.end + len) === marker &&
		// "**" around "*x*" selected for italic would match the bold markers: skip that.
		!(len === 1 && value[sel.start - 2] === marker && value[sel.end + 1] === marker)
	) {
		const inner = value.slice(sel.start, sel.end);
		return {
			from: sel.start - len,
			to: sel.end + len,
			insert: inner,
			select: { start: sel.start - len, end: sel.end - len }
		};
	}

	const trimmed = trimSelection(value, sel);
	const text = value.slice(trimmed.start, trimmed.end);
	// Markers inside the selection: [**bold**]
	if (text.length >= len * 2 + 1 && text.startsWith(marker) && text.endsWith(marker)) {
		const inner = text.slice(len, -len);
		return {
			from: trimmed.start,
			to: trimmed.end,
			insert: inner,
			select: { start: trimmed.start, end: trimmed.start + inner.length }
		};
	}
	if (!text) {
		const insert = marker + placeholder + marker;
		return {
			from: sel.start,
			to: sel.end,
			insert,
			select: { start: sel.start + len, end: sel.start + len + placeholder.length }
		};
	}
	// Wrap each line separately so a multi line selection stays valid Markdown.
	const wrapped = text
		.split('\n')
		.map((line) => (line.trim() ? line.replace(/^(\s*)(.*?)(\s*)$/, `$1${marker}$2${marker}$3`) : line))
		.join('\n');
	return {
		from: trimmed.start,
		to: trimmed.end,
		insert: wrapped,
		select: { start: trimmed.start + len, end: trimmed.start + wrapped.length - len }
	};
}

/* ------------------------------------------------------------------------------------------ */
/* Links                                                                                       */
/* ------------------------------------------------------------------------------------------ */

const URL_ONLY = /^(?:https?:\/\/|mailto:)[^\s<>]+$/i;

/** Whether a string is one bare http(s) or mailto URL. */
export function isUrl(text: string): boolean {
	return URL_ONLY.test(text.trim());
}

/** [selection](https://) with the URL selected; a selected URL becomes [link text](url). */
export function insertLink(value: string, sel: Range): Edit {
	const trimmed = trimSelection(value, sel);
	const text = value.slice(trimmed.start, trimmed.end);
	if (text && isUrl(text) && !text.includes('\n')) {
		const insert = `[link text](${text})`;
		return { from: trimmed.start, to: trimmed.end, insert, select: { start: trimmed.start + 1, end: trimmed.start + 10 } };
	}
	if (!text || text.includes('\n')) {
		const insert = '[link text](https://)';
		return { from: sel.start, to: sel.end, insert, select: { start: sel.start + 1, end: sel.start + 10 } };
	}
	const insert = `[${text}](https://)`;
	const urlStart = trimmed.start + text.length + 3;
	return { from: trimmed.start, to: trimmed.end, insert, select: { start: urlStart, end: urlStart + 8 } };
}

/** Pasting a URL over selected text: [text](url). Null when it doesn't apply. */
export function linkSelection(value: string, sel: Range, url: string): Edit | null {
	if (sel.start === sel.end || !isUrl(url)) return null;
	const trimmed = trimSelection(value, sel);
	const text = value.slice(trimmed.start, trimmed.end);
	if (!text || text.includes('\n') || isUrl(text) || /^\[.*\]\(.*\)$/.test(text)) return null;
	const insert = `[${text}](${url.trim()})`;
	const at = trimmed.start + insert.length;
	return { from: trimmed.start, to: trimmed.end, insert, select: { start: at, end: at } };
}

/* ------------------------------------------------------------------------------------------ */
/* Line prefixes: headings, quotes, lists                                                      */
/* ------------------------------------------------------------------------------------------ */

const LIST_MARKER = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[[ xX]\]\s+)?/;
const QUOTE = /^(\s*)>\s?/;
const HEADING = /^(#{1,6})\s+/;

export type LineKind = 'bullet' | 'ordered' | 'task' | 'quote';

/** The line without any list, task or quote marker (keeps indentation). */
function stripMarker(line: string, kind: LineKind): string {
	if (kind === 'quote') return line.replace(QUOTE, '$1');
	return line.replace(LIST_MARKER, '$1');
}

/** Length of the indentation and list, task or quote marker at the start of a line. */
function prefixLength(line: string): number {
	const list = LIST_MARKER.exec(line);
	if (list) return list[0].length;
	const quote = /^(\s*>\s?)+/.exec(line);
	return quote ? quote[0].length : (/^\s*/.exec(line)?.[0].length ?? 0);
}

function hasKind(line: string, kind: LineKind): boolean {
	if (kind === 'quote') return QUOTE.test(line);
	const m = LIST_MARKER.exec(line);
	if (!m) return false;
	if (kind === 'task') return Boolean(m[4]);
	if (kind === 'ordered') return /\d/.test(m[2]) && !m[4];
	return !/\d/.test(m[2]) && !m[4];
}

/**
 * Turn the selected lines into a bulleted, numbered or task list or a quote, or back into plain
 * lines when they already are one. Other list markers are replaced (bullets → numbers).
 */
export function toggleLinePrefix(value: string, sel: Range, kind: LineKind): Edit {
	const bounds = lineBounds(value, sel);
	const block = value.slice(bounds.start, bounds.end);
	const lines = block.split('\n');
	const filled = lines.filter((l) => l.trim());
	const remove = filled.length > 0 && filled.every((l) => hasKind(l, kind));
	let n = 0;
	const next = lines.map((line) => {
		if (!line.trim() && lines.length > 1) return line;
		if (remove) return stripMarker(line, kind);
		const indent = /^\s*/.exec(line)?.[0] ?? '';
		const bare = stripMarker(stripMarker(line, 'quote'), 'bullet').slice(indent.length);
		n += 1;
		const prefix = kind === 'bullet' ? '- ' : kind === 'task' ? '- [ ] ' : kind === 'ordered' ? `${n}. ` : '> ';
		return indent + prefix + bare;
	});
	const insert = next.join('\n');
	if (sel.start === sel.end && lines.length === 1) {
		// Keep the caret where it was in the text, shifted by the marker change.
		const offset = sel.start - bounds.start;
		const oldPrefix = prefixLength(block);
		const newPrefix = prefixLength(insert);
		const caret = bounds.start + Math.max(newPrefix, offset - oldPrefix + newPrefix);
		return { from: bounds.start, to: bounds.end, insert, select: { start: caret, end: caret } };
	}
	return { from: bounds.start, to: bounds.end, insert, select: { start: bounds.start, end: bounds.start + insert.length } };
}

/** Heading button: plain → ## section → ### subsection → plain, on the selected lines. */
export function cycleHeading(value: string, sel: Range): Edit {
	const bounds = lineBounds(value, sel);
	const block = value.slice(bounds.start, bounds.end);
	const lines = block.split('\n');
	const first = HEADING.exec(lines.find((l) => l.trim()) ?? '');
	const level = first ? first[1].length : 0;
	const nextLevel = level === 0 ? 2 : level === 1 ? 2 : level === 2 ? 3 : 0;
	const next = lines.map((line) => {
		if (!line.trim() && lines.length > 1) return line;
		const bare = line.replace(HEADING, '');
		return nextLevel ? `${'#'.repeat(nextLevel)} ${bare}` : bare;
	});
	const insert = next.join('\n');
	const caret = bounds.start + insert.length;
	return {
		from: bounds.start,
		to: bounds.end,
		insert,
		select: sel.start === sel.end ? { start: caret, end: caret } : { start: bounds.start, end: caret }
	};
}

/** Callouts: > [!NOTE] around the selected lines (or an empty callout on an empty line). */
export const CALLOUT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

export function insertCallout(value: string, sel: Range, type: CalloutType): Edit {
	const bounds = lineBounds(value, sel);
	const block = value.slice(bounds.start, bounds.end);
	if (!block.trim()) {
		const text = `> [!${type}]\n> `;
		return insertBlock(value, bounds, text, { start: text.length, end: text.length });
	}
	const body = block
		.split('\n')
		.map((line) => (line.trim() ? `> ${line.replace(QUOTE, '')}` : '>'))
		.join('\n');
	const text = `> [!${type}]\n${body}`;
	return insertBlock(value, bounds, text, { start: text.length, end: text.length });
}

/* ------------------------------------------------------------------------------------------ */
/* Blocks                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** ``` around the selected lines, with the caret after the opening fence for the language. */
export function insertCodeBlock(value: string, sel: Range): Edit {
	const text = value.slice(sel.start, sel.end).replace(/\n+$/, '');
	if (!text) {
		const block = '```\n\n```';
		return insertBlock(value, sel, block, { start: 3, end: 3 });
	}
	const block = '```\n' + text + '\n```';
	return insertBlock(value, sel, block, { start: 3, end: 3 });
}

/** Inline code for a short selection, a code block for several lines. */
export function toggleCode(value: string, sel: Range): Edit {
	const text = value.slice(sel.start, sel.end);
	if (text.includes('\n')) return insertCodeBlock(value, sel);
	return toggleInline(value, sel, '`', 'code');
}

/** $inline$ math, or a $$ block on an empty line or for several lines. */
export function insertMath(value: string, sel: Range): Edit {
	const text = value.slice(sel.start, sel.end);
	const bounds = lineBounds(value, sel);
	const lineEmpty = !value.slice(bounds.start, bounds.end).trim();
	if (text.includes('\n') || (!text && lineEmpty)) {
		const inner = text.trim() || 'E = mc^2';
		const block = `$$\n${inner}\n$$`;
		return insertBlock(value, sel, block, { start: 3, end: 3 + inner.length });
	}
	return toggleInline(value, sel, '$', 'x^2');
}

export function insertDivider(value: string, sel: Range): Edit {
	return insertBlock(value, { start: sel.end, end: sel.end }, '---');
}

/** A 3 by 2 table with the first header cell selected. */
export function insertTable(value: string, sel: Range): Edit {
	const block = '| Column | Column | Column |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |';
	return insertBlock(value, { start: sel.end, end: sel.end }, block, { start: 2, end: 8 });
}

/** An embed URL (YouTube, Vimeo, GitHub) alone on its own paragraph. */
export function insertEmbed(value: string, sel: Range, url: string): Edit {
	return insertBlock(value, sel, url.trim());
}

/* ------------------------------------------------------------------------------------------ */
/* Spreadsheets                                                                                */
/* ------------------------------------------------------------------------------------------ */

function cell(text: string): string {
	return text.trim().replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ') || ' ';
}

/**
 * Tab separated rows (what Google Sheets, Excel and Numbers put on the clipboard) as a Markdown
 * table, the first row as the header. Null unless there are 2+ rows of 2+ matching columns.
 */
export function tsvToTable(text: string): string | null {
	const rows = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
	if (rows.length < 2) return null;
	const cells = rows.map((r) => r.split('\t'));
	const width = cells[0].length;
	if (width < 2 || width > 30 || cells.some((r) => r.length !== width)) return null;
	const line = (r: string[]) => `| ${r.map(cell).join(' | ')} |`;
	const [head, ...body] = cells;
	return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...body.map(line)].join('\n');
}

/* ------------------------------------------------------------------------------------------ */
/* Enter and Tab                                                                               */
/* ------------------------------------------------------------------------------------------ */

/**
 * Enter at the end of a list item, task or quote line starts the next one ("2. ", "- [ ] ",
 * "> "); on an empty item it ends the list. In a code block it keeps the indentation.
 * Null means "let the browser insert a plain newline".
 */
export function continueBlock(value: string, sel: Range): Edit | null {
	if (sel.start !== sel.end) return null;
	const caret = sel.start;
	const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
	const nl = value.indexOf('\n', caret);
	const lineEnd = nl === -1 ? value.length : nl;
	const line = value.slice(lineStart, lineEnd);
	const head = value.slice(lineStart, caret);

	if (insideFence(value, caret)) {
		const indent = /^[ \t]*/.exec(head)?.[0] ?? '';
		if (!indent) return null;
		const insert = '\n' + indent;
		return { from: caret, to: caret, insert, select: { start: caret + insert.length, end: caret + insert.length } };
	}

	const list = LIST_MARKER.exec(line);
	if (list && head.length >= list[0].length) {
		const [marker, indent, bullet, space, task] = list;
		const rest = line.slice(marker.length);
		if (!rest.trim() && caret === lineEnd) {
			// Empty item: end the list (an indented item steps out one level instead).
			if (indent.length) {
				const out = indent.slice(0, Math.max(0, indent.length - (/\d/.test(bullet) ? 3 : 2)));
				const insert = out + bullet + space + (task ? '[ ] ' : '');
				return { from: lineStart, to: lineEnd, insert, select: { start: lineStart + insert.length, end: lineStart + insert.length } };
			}
			// A blank line, so the next paragraph doesn't continue the last item.
			const blank = lineStart >= 2 && value[lineStart - 2] === '\n' ? '' : '\n';
			return { from: lineStart, to: lineEnd, insert: blank, select: { start: lineStart + blank.length, end: lineStart + blank.length } };
		}
		const num = /^(\d+)([.)])$/.exec(bullet);
		const nextBullet = num ? `${Number(num[1]) + 1}${num[2]}` : bullet;
		const insert = '\n' + indent + nextBullet + space + (task ? '[ ] ' : '');
		return { from: caret, to: caret, insert, select: { start: caret + insert.length, end: caret + insert.length } };
	}

	const quote = /^(\s*>\s?)+/.exec(line);
	if (quote && head.length >= quote[0].length) {
		const rest = line.slice(quote[0].length);
		if (!rest.trim() && caret === lineEnd) {
			const blank = lineStart >= 2 && value[lineStart - 2] === '\n' ? '' : '\n';
			return { from: lineStart, to: lineEnd, insert: blank, select: { start: lineStart + blank.length, end: lineStart + blank.length } };
		}
		const prefix = quote[0].endsWith(' ') ? quote[0] : quote[0] + ' ';
		const insert = '\n' + prefix;
		return { from: caret, to: caret, insert, select: { start: caret + insert.length, end: caret + insert.length } };
	}
	return null;
}

/**
 * Tab / Shift+Tab on list items: nest them under the item above, or move them out a level.
 * Null when the selection is not on list items (Tab then moves focus as usual).
 */
export function indentList(value: string, sel: Range, outdent: boolean): Edit | null {
	const bounds = lineBounds(value, sel);
	const block = value.slice(bounds.start, bounds.end);
	const lines = block.split('\n');
	if (!lines.some((l) => LIST_MARKER.test(l))) return null;
	if (lines.some((l) => l.trim() && !LIST_MARKER.test(l))) return null;

	// The marker width of the item above decides how far a nested item must be indented.
	const above = value.slice(0, Math.max(0, bounds.start - 1)).split('\n').reverse();
	let firstShift = 0;
	const next = lines.map((line, i) => {
		const m = LIST_MARKER.exec(line);
		if (!m) return line;
		const indent = m[1].length;
		if (outdent) {
			const parent = above.map((l) => LIST_MARKER.exec(l)).find((p) => p && p[1].length < indent);
			const target = parent ? parent[1].length : Math.max(0, indent - (/\d/.test(m[2]) ? 3 : 2));
			const result = ' '.repeat(target) + line.slice(indent);
			if (i === 0) firstShift = result.length - line.length;
			return result;
		}
		const sibling = above.map((l) => LIST_MARKER.exec(l)).find((p) => p && p[1].length <= indent);
		const width = sibling && sibling[1].length === indent ? sibling[2].length + sibling[3].length : 2;
		const nested = /\d/.test(m[2]) ? line.slice(indent).replace(/^\d{1,9}/, '1') : line.slice(indent);
		const result = ' '.repeat(indent + width) + nested;
		if (i === 0) firstShift = result.length - line.length;
		return result;
	});
	const insert = next.join('\n');
	if (insert === block) return { from: sel.start, to: sel.start, insert: '', select: sel };
	if (sel.start === sel.end) {
		const caret = Math.max(bounds.start, sel.start + firstShift);
		return { from: bounds.start, to: bounds.end, insert, select: { start: caret, end: caret } };
	}
	return { from: bounds.start, to: bounds.end, insert, select: { start: bounds.start, end: bounds.start + insert.length } };
}

/* ------------------------------------------------------------------------------------------ */
/* Uploads                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** "IMG_2034 final-v2.JPG" → "IMG 2034 final v2". */
export function humanizeFilename(name: string): string {
	const base = name.replace(/\.[a-z0-9]{1,5}$/i, '');
	const words = base
		.replace(/[_\-.+]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!words || /^(image|img|photo|screenshot|untitled|clipboard)$/i.test(words)) {
		return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : 'Image';
	}
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Text that is safe inside ![...] or [...]. */
export function escapeLinkText(text: string): string {
	return text.replace(/[[\]\\]/g, '').replace(/\s+/g, ' ').trim();
}

export type MediaKind = 'image' | 'video' | 'model' | 'pdf';

/** Markdown for an uploaded file: an image, video or model figure, or a link to a PDF. */
export function mediaMarkdown(kind: MediaKind, url: string, alt: string): string {
	const text = escapeLinkText(alt) || 'File';
	const href = url.replace(/\s/g, '%20').replace(/\)/g, '%29');
	if (kind === 'pdf') return `[${text} (PDF)](${href})`;
	return `![${text}](${href})`;
}

/* ------------------------------------------------------------------------------------------ */
/* Embeds                                                                                      */
/* ------------------------------------------------------------------------------------------ */

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/**
 * Which player a URL becomes when it is alone on a line (the same rules as the renderer in
 * src/lib/server/markdown/embeds.ts), or null.
 */
export function videoEmbed(raw: string): { kind: 'youtube' | 'vimeo'; id: string } | null {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	const host = url.hostname.toLowerCase();
	const parts = url.pathname.split('/').filter(Boolean);
	if (YOUTUBE_HOSTS.has(host) || host === 'youtu.be') {
		let id: string | null = null;
		if (host === 'youtu.be') id = parts[0] ?? null;
		else if (parts[0] === 'watch') id = url.searchParams.get('v');
		else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1] ?? null;
		return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { kind: 'youtube', id } : null;
	}
	if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
		const id = parts.find((p) => /^\d{1,12}$/.test(p));
		return id ? { kind: 'vimeo', id } : null;
	}
	return null;
}

/** A GitHub repository URL (github.com/owner/repo) that becomes a repository card. */
export function isGithubRepo(raw: string): boolean {
	try {
		const url = new URL(raw.trim());
		const parts = url.pathname.split('/').filter(Boolean);
		return (url.hostname === 'github.com' || url.hostname === 'www.github.com') && parts.length === 2 && !url.search && !url.hash;
	} catch {
		return false;
	}
}
