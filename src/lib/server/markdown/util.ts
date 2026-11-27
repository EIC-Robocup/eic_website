/** Small helpers shared by the Markdown renderer and its extensions. */

/** Escape text for HTML text and double-quoted attributes. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Turn heading text into an id: lower case, letters and digits joined by single hyphens. */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '');
}

/**
 * A URL a post may link to or load: http(s), mailto (links only), a site path (`/images/x.webp`)
 * or an in-page anchor. Never `javascript:`, `data:` or protocol-relative `//host`.
 */
export function isSafeUrl(url: string, { allowMailto = false, allowAnchor = false } = {}): boolean {
	const value = url.trim();
	if (!value || /[\u0000-\u001f\u007f\s]/.test(value)) return false;
	if (value.startsWith('#')) return allowAnchor;
	if (value.startsWith('/')) return !value.startsWith('//') && !value.startsWith('/\\');
	try {
		const parsed = new URL(value);
		if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return true;
		return allowMailto && parsed.protocol === 'mailto:';
	} catch {
		return false;
	}
}

/** True for absolute http(s) URLs (links that leave the site). */
export function isExternalUrl(url: string): boolean {
	return /^https?:\/\//i.test(url.trim());
}

let segmenter: Intl.Segmenter | null | undefined;

/**
 * Count words. Uses Intl.Segmenter so Thai (written without spaces between words) is counted
 * properly; falls back to splitting on spaces.
 */
export function countWords(text: string): number {
	if (!text) return 0;
	if (segmenter === undefined) {
		try {
			segmenter = new Intl.Segmenter(['th', 'en'], { granularity: 'word' });
		} catch {
			segmenter = null;
		}
	}
	if (!segmenter) return text.split(/\s+/).filter(Boolean).length;
	let words = 0;
	for (const part of segmenter.segment(text)) if (part.isWordLike) words += 1;
	return words;
}

/** Two digit figure numbers: 1 → "01". */
export function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

/** Width and height hinted in an upload's file name: `...-2400x1600.webp` (see storage.ts). */
export function sizeFromUrl(url: string): { width: number; height: number } | null {
	const match = /-(\d{2,5})x(\d{2,5})\.(?:webp|png|jpe?g|gif|avif)(?:[?#].*)?$/i.exec(url);
	if (!match) return null;
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (!width || !height || width > 20000 || height > 20000) return null;
	return { width, height };
}
