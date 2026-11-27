/**
 * Syntax highlighting for fenced code blocks, with Shiki on the server.
 *
 * - The JavaScript regex engine (no WASM), so it bundles and runs on Vercel as plain JS.
 * - A fine-grained, synchronous highlighter with only the languages below, created once per
 *   server instance on first use and then reused (rendering a post stays synchronous).
 * - The "EIC dark" theme: GitHub Dark's scopes on the EIC tokens (every colour keeps at least
 *   4.5:1 on the #0B0B0B code background, also on highlighted lines).
 *
 * The output is our own markup built from Shiki's tokens (escaped text in spans with a single
 * `color` style), so the sanitizer can allow exactly that and nothing else.
 */
import { createHighlighterCoreSync, type HighlighterCore, type ThemeRegistration } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubDark from 'shiki/themes/github-dark.mjs';
import langBash from 'shiki/langs/shellscript.mjs';
import langC from 'shiki/langs/c.mjs';
import langCmake from 'shiki/langs/cmake.mjs';
import langCpp from 'shiki/langs/cpp.mjs';
import langCss from 'shiki/langs/css.mjs';
import langDiff from 'shiki/langs/diff.mjs';
import langDocker from 'shiki/langs/dockerfile.mjs';
import langGo from 'shiki/langs/go.mjs';
import langHtml from 'shiki/langs/html.mjs';
import langJava from 'shiki/langs/java.mjs';
import langJs from 'shiki/langs/javascript.mjs';
import langJson from 'shiki/langs/json.mjs';
import langJsonc from 'shiki/langs/jsonc.mjs';
import langJsx from 'shiki/langs/jsx.mjs';
import langLua from 'shiki/langs/lua.mjs';
import langMarkdown from 'shiki/langs/markdown.mjs';
import langMatlab from 'shiki/langs/matlab.mjs';
import langPython from 'shiki/langs/python.mjs';
import langRust from 'shiki/langs/rust.mjs';
import langSql from 'shiki/langs/sql.mjs';
import langSvelte from 'shiki/langs/svelte.mjs';
import langToml from 'shiki/langs/toml.mjs';
import langTs from 'shiki/langs/typescript.mjs';
import langTsx from 'shiki/langs/tsx.mjs';
import langXml from 'shiki/langs/xml.mjs';
import langYaml from 'shiki/langs/yaml.mjs';
import { escapeHtml } from './util.ts';

const THEME_NAME = 'eic-dark';

/** Code background and text (surface-000 and ink). */
export const CODE_BG = '#0B0B0B';
export const CODE_FG = '#F3F2EE';

/**
 * GitHub Dark's palette mapped onto the EIC tokens. Contrast on #0B0B0B: muted 7.4:1,
 * red 6.5:1, pink 5.6:1, green 9.6:1, amber 10.9:1, sky 10.6:1, peach 9.2:1.
 */
const PALETTE: Record<string, string> = {
	'#e1e4e8': CODE_FG, // plain text, parameters
	'#6a737d': '#A3A09A', // comments (ink-muted)
	'#f97583': '#FF6A6E', // keywords, storage (brand-text)
	'#9ecbff': '#55C98F', // strings (success)
	'#dbedff': '#9BDDB8', // regular expressions
	'#79b8ff': '#E5679A', // constants, numbers, `this` (chula-pink)
	'#b392f0': '#E8BD72', // functions, attribute names (amber)
	'#ffab70': '#F2B48C', // variables (peach)
	'#85e89d': '#FF8F8B', // tag names
	'#fdaeb7': '#FF6A6E', // invalid, deleted
	'#d1d5da': '#D6D3CC',
	'#2f363d': '#A3A09A',
	'#24292e': CODE_BG
};

function scopesOf(entry: { scope?: string | string[] }): string[] {
	return entry.scope === undefined ? [] : Array.isArray(entry.scope) ? entry.scope : [entry.scope];
}

function buildTheme(): ThemeRegistration {
	const base = githubDark as unknown as ThemeRegistration;
	const tokenColors = (base.tokenColors ?? []).map((entry) => {
		const settings = { ...entry.settings };
		const scopes = scopesOf(entry);
		if (typeof settings.foreground === 'string') {
			settings.foreground = PALETTE[settings.foreground.toLowerCase()] ?? settings.foreground;
		}
		// Diff lines get their background from CSS classes (.line.add / .line.del), not the theme.
		delete settings.background;
		if (scopes.some((s) => s.startsWith('markup.inserted') || s === 'meta.diff.header.to-file')) {
			settings.foreground = '#55C98F';
		}
		if (scopes.some((s) => s.startsWith('markup.deleted') || s === 'meta.diff.header.from-file')) {
			settings.foreground = '#FF8F8B';
		}
		if (scopes.includes('comment')) settings.fontStyle = 'italic';
		return { ...entry, settings };
	});
	return {
		...base,
		name: THEME_NAME,
		displayName: 'EIC dark',
		type: 'dark',
		colors: { ...base.colors, 'editor.background': CODE_BG, 'editor.foreground': CODE_FG },
		fg: CODE_FG,
		bg: CODE_BG,
		tokenColors
	} as ThemeRegistration;
}

/** Canonical Shiki ids for what people type after the fence. */
const LANG_ALIASES: Record<string, string> = {
	ts: 'typescript',
	mts: 'typescript',
	cts: 'typescript',
	typescript: 'typescript',
	js: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	javascript: 'javascript',
	node: 'javascript',
	tsx: 'tsx',
	jsx: 'jsx',
	json: 'json',
	json5: 'jsonc',
	jsonc: 'jsonc',
	py: 'python',
	python: 'python',
	python3: 'python',
	cpp: 'cpp',
	'c++': 'cpp',
	cc: 'cpp',
	cxx: 'cpp',
	hpp: 'cpp',
	hh: 'cpp',
	ino: 'cpp',
	arduino: 'cpp',
	c: 'c',
	h: 'c',
	rust: 'rust',
	rs: 'rust',
	go: 'go',
	golang: 'go',
	bash: 'shellscript',
	sh: 'shellscript',
	shell: 'shellscript',
	zsh: 'shellscript',
	console: 'shellscript',
	shellscript: 'shellscript',
	terminal: 'shellscript',
	yaml: 'yaml',
	yml: 'yaml',
	toml: 'toml',
	xml: 'xml',
	urdf: 'xml',
	xacro: 'xml',
	sdf: 'xml',
	launch: 'xml',
	svg: 'xml',
	html: 'html',
	htm: 'html',
	css: 'css',
	svelte: 'svelte',
	markdown: 'markdown',
	md: 'markdown',
	diff: 'diff',
	patch: 'diff',
	dockerfile: 'docker',
	docker: 'docker',
	sql: 'sql',
	postgres: 'sql',
	postgresql: 'sql',
	cmake: 'cmake',
	lua: 'lua',
	java: 'java',
	matlab: 'matlab',
	m: 'matlab',
	octave: 'matlab'
};

/** Labels shown in the code block header. */
const LANG_LABELS: Record<string, string> = {
	typescript: 'TypeScript',
	javascript: 'JavaScript',
	tsx: 'TSX',
	jsx: 'JSX',
	json: 'JSON',
	jsonc: 'JSONC',
	python: 'Python',
	cpp: 'C++',
	c: 'C',
	rust: 'Rust',
	go: 'Go',
	shellscript: 'Shell',
	yaml: 'YAML',
	toml: 'TOML',
	xml: 'XML',
	html: 'HTML',
	css: 'CSS',
	svelte: 'Svelte',
	markdown: 'Markdown',
	diff: 'Diff',
	docker: 'Dockerfile',
	sql: 'SQL',
	cmake: 'CMake',
	lua: 'Lua',
	java: 'Java',
	matlab: 'MATLAB'
};

/** Fences that mean "no language": shown as plain text without a label. */
const PLAIN = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'none', 'output', 'log']);

/** Typed language ids we know but show with a nicer label (`arduino` → "Arduino"). */
const ALIAS_LABELS: Record<string, string> = {
	arduino: 'Arduino',
	ino: 'Arduino',
	urdf: 'URDF',
	xacro: 'Xacro',
	sdf: 'SDF',
	launch: 'ROS launch',
	console: 'Shell',
	terminal: 'Shell',
	postgres: 'SQL',
	postgresql: 'SQL',
	octave: 'Octave'
};

let highlighter: HighlighterCore | null = null;

function getHighlighter(): HighlighterCore {
	if (highlighter) return highlighter;
	highlighter = createHighlighterCoreSync({
		themes: [buildTheme()],
		langs: [
			langTs,
			langJs,
			langTsx,
			langJsx,
			langJson,
			langJsonc,
			langPython,
			langCpp,
			langC,
			langRust,
			langGo,
			langBash,
			langYaml,
			langToml,
			langXml,
			langHtml,
			langCss,
			langSvelte,
			langMarkdown,
			langDiff,
			langDocker,
			langSql,
			langCmake,
			langLua,
			langJava,
			langMatlab
		],
		// `forgiving` skips the rare grammar pattern the JS engine can't translate instead of throwing.
		engine: createJavaScriptRegexEngine({ forgiving: true }),
		warnings: false
	});
	return highlighter;
}

export type ResolvedLanguage = {
	/** Shiki id, or null for plain text. */
	id: string | null;
	/** Label for the header, or null for plain text. */
	label: string | null;
};

/** Map what was typed after the fence (`py`, `c++`, `urdf`) to a Shiki id and a label. */
export function resolveLanguage(typed: string | null | undefined): ResolvedLanguage {
	const key = (typed ?? '').trim().toLowerCase();
	if (PLAIN.has(key)) return { id: null, label: null };
	const id = LANG_ALIASES[key] ?? null;
	if (id) return { id, label: ALIAS_LABELS[key] ?? LANG_LABELS[id] ?? key };
	// Unknown language: plain text, but keep a (safe) label so readers know what it is.
	const label = key.replace(/[^\w+#.-]/g, '').slice(0, 20);
	return { id: null, label: label ? label.toUpperCase() : null };
}

/** Code bigger than this is shown as plain text (highlighting time grows with size). */
const MAX_HIGHLIGHT_CHARS = 60_000;

/**
 * Highlight `code` and return one HTML string per line (no line wrappers). Plain text, unknown
 * languages and highlighting errors give escaped lines.
 */
export function highlightLines(code: string, lang: string | null): string[] {
	const plain = () => code.split('\n').map((line) => escapeHtml(line));
	if (!lang || code.length > MAX_HIGHLIGHT_CHARS) return plain();
	try {
		const { tokens } = getHighlighter().codeToTokens(code, {
			lang,
			theme: THEME_NAME,
			tokenizeMaxLineLength: 2000,
			tokenizeTimeLimit: 300
		});
		return tokens.map((line) => {
			let html = '';
			let open: string | null = null;
			let buffer = '';
			const flush = () => {
				if (!buffer) return;
				html += open ? `<span style="${open}">${escapeHtml(buffer)}</span>` : escapeHtml(buffer);
				buffer = '';
			};
			for (const token of line) {
				const color = token.color && /^#[0-9a-f]{3,8}$/i.test(token.color) ? token.color.toUpperCase() : null;
				// FontStyle bit 1 = italic.
				const italic = typeof token.fontStyle === 'number' && token.fontStyle > 0 && (token.fontStyle & 1) === 1;
				let style: string | null = null;
				if (color && color !== CODE_FG) style = `color:${color}`;
				if (italic) style = style ? `${style};font-style:italic` : 'font-style:italic';
				if (style !== open) {
					flush();
					open = style;
				}
				buffer += token.content;
			}
			flush();
			return html;
		});
	} catch (err) {
		console.error('Code highlighting failed', err);
		return plain();
	}
}
