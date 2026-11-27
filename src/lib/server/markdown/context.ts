/**
 * Per-render state shared by the renderer and its extensions: figure numbers, heading ids,
 * footnotes, feature flags, and "fragments".
 *
 * Fragments are pieces of markup we generate ourselves from trusted libraries (Shiki code,
 * KaTeX math, embed and media placeholders). They never go through the main sanitizer, which
 * allows no `style` or `data-*` attributes at all; instead each is cleaned by its own narrow
 * allowlist (sanitize.ts) and spliced back in after the main pass. In the main HTML a fragment
 * is a placeholder made of private-use characters and a per-render nonce; the source has those
 * characters stripped first, so a post cannot forge one.
 */
import type { Token } from 'marked';

export type FragmentKind = 'code' | 'math' | 'embed';

export type PostFeatures = {
	/** KaTeX math: load the KaTeX stylesheet. */
	math: boolean;
	/** ```mermaid diagrams: the client loads mermaid. */
	mermaid: boolean;
	/** .glb/.gltf models: the client loads <model-viewer>. */
	model: boolean;
	/** .mp4/.webm videos. */
	video: boolean;
	/** YouTube, Vimeo or GitHub embeds. */
	embed: boolean;
};

export type Heading = { id: string; text: string; depth: number };

export type FootnoteDef = { label: string; tokens: Token[] };

export const PH_START = '\uE000';
export const PH_END = '\uE001';

/** Ids the site already uses on post pages; a heading with that slug gets a suffix. */
const RESERVED_IDS = ['main', 'top', 'content', 'site-menu', 'admin-main', 'nav', 'footer', 'related', 'toc', 'share'];

export class RenderContext {
	readonly mode: 'html' | 'text';
	readonly nonce = Math.random().toString(36).slice(2, 10);
	readonly fragments: { kind: FragmentKind; html: string }[] = [];
	readonly features: PostFeatures = { math: false, mermaid: false, model: false, video: false, embed: false };
	readonly headings: Heading[] = [];
	readonly footnotes = new Map<string, FootnoteDef>();
	/** Footnote label → its number, in order of first reference. */
	readonly footnoteOrder = new Map<string, number>();
	/** Footnote label → how many times it has been referenced so far. */
	readonly footnoteRefs = new Map<string, number>();
	private figure: number;
	private readonly ids = new Map<string, number>(RESERVED_IDS.map((id) => [id, 1]));

	constructor(mode: 'html' | 'text', figureStart = 1) {
		this.mode = mode;
		this.figure = Math.max(1, Math.floor(figureStart)) - 1;
	}

	/** The next figure number ("Fig. 02"). */
	nextFigure(): number {
		this.figure += 1;
		return this.figure;
	}

	/** A unique id from a slug: "setup", "setup-1", "setup-2". */
	uniqueId(base: string): string {
		const slug = base || 'section';
		const seen = this.ids.get(slug) ?? 0;
		this.ids.set(slug, seen + 1);
		return seen ? `${slug}-${seen}` : slug;
	}

	/** Store a fragment and return its placeholder (on its own line when `block`). */
	fragment(kind: FragmentKind, html: string, block: boolean): string {
		const index = this.fragments.push({ kind, html }) - 1;
		const placeholder = `${PH_START}${this.nonce}:${index}${PH_END}`;
		return block ? `${placeholder}\n` : placeholder;
	}
}
