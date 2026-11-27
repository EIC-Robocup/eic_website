/**
 * Image delivery: the right size of each photo for the slot it fills.
 *
 * - Photos uploaded in the admin panel live in this project's public Supabase Storage "media"
 *   bucket. On Vercel they are served through `/_vercel/image`, which resizes them to the
 *   width the page needs and converts them to AVIF or WebP, then caches the result at the edge
 *   for a month. The widths here must match `images.sizes` in vite.config.ts and the quality
 *   its `qualities`: Vercel refuses anything else. Only the bucket of the project in
 *   SUPABASE_URL (read at build time) is allowed; other hosts and dev pass through unchanged.
 * - Site photos in static/images (the first release's content) have pre-sized copies made by
 *   scripts/resize-images.ts (`<name>-480w.webp`, `<name>-960w.webp`). They are plain files,
 *   so they work the same in dev, in a preview and on Vercel.
 *
 *     <img src={optimizedSrc(url, 1280)} srcset={srcset(url)} sizes="(min-width: 784px) 720px, 100vw" />
 *
 * Safe to import anywhere (server and browser).
 */
import { dev } from '$app/env';

/** The media bucket's host, from SUPABASE_URL at build time (vite.config.ts); '' when unset. */
declare const __MEDIA_HOST__: string;

/** Widths Vercel may resize to. Keep in sync with `images.sizes` in vite.config.ts. */
export const IMAGE_WIDTHS = [320, 480, 640, 960, 1280, 1920] as const;

/** The one quality Vercel accepts (`images.qualities` in vite.config.ts). */
export const DEFAULT_QUALITY = 75;

/** Public object URLs in this project's media bucket, e.g. https://abc.supabase.co/storage/v1/object/public/media/x.webp */
const MEDIA_PREFIX = __MEDIA_HOST__ ? `https://${__MEDIA_HOST__}/storage/v1/object/public/media/` : null;

/**
 * Site photos with pre-sized copies: path → available widths, smallest first; the last one
 * is the original's own width. Written by `node scripts/resize-images.ts`; don't edit by hand.
 */
const STATIC_PHOTOS: Record<string, readonly number[]> = {
	// <static-photos>
	'/images/archive/mea-2020.webp': [480, 960, 1200],
	'/images/archive/plc-2022.webp': [480, 960, 1200],
	'/images/archive/robocup-2022-team.webp': [480, 960, 1600],
	'/images/archive/walkie2-arm.webp': [480, 960, 1400],
	'/images/archive/walkie2-crew.webp': [480, 960, 1400],
	'/images/archive/walkie2-table.webp': [480, 960, 1400],
	'/images/people/mekkhala-wunbamrung.webp': [480, 600],
	'/images/people/taratorn-assawadejmetakul.webp': [480, 600],
	// </static-photos>
};

/** True for URLs that Vercel may optimize (this project's media bucket). */
export function isOptimizable(url: string | null | undefined): url is string {
	return typeof url === 'string' && MEDIA_PREFIX !== null && url.startsWith(MEDIA_PREFIX) && !/[?#]/.test(url);
}

/**
 * True for any public media bucket URL, whatever its host (also a local http Supabase, or a
 * build without SUPABASE_URL). Upload file names carry the size (`-2400x1600.webp`), so this
 * is enough for a width and height hint even where the photo can't be optimized.
 */
export function isMediaUpload(url: string | null | undefined): url is string {
	return typeof url === 'string' && /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/media\/[^?#]+$/.test(url);
}

/** The pre-sized copies of a site photo, smallest first (the original last), or null. */
function staticCopies(url: string): { url: string; width: number }[] | null {
	const widths = Object.hasOwn(STATIC_PHOTOS, url) ? STATIC_PHOTOS[url] : undefined;
	if (!widths?.length) return null;
	const original = widths[widths.length - 1];
	return widths.map((width) => ({
		width,
		url: width === original ? url : url.replace(/\.[a-z0-9]+$/i, `-${width}w.webp`)
	}));
}

/** The smallest allowed width that is at least `width` (the largest one if none is). */
function snapWidth(width: number): number {
	for (const w of IMAGE_WIDTHS) if (w >= width) return w;
	return IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}

/**
 * The URL to show `url` at about `width` CSS pixels wide: the smallest copy of a site photo
 * that is at least that wide, `/_vercel/image` for media bucket photos outside dev, or `url`.
 */
export function optimizedSrc(url: string, width: number): string;
export function optimizedSrc(url: string | null | undefined, width: number): string | null | undefined;
export function optimizedSrc(url: string | null | undefined, width: number) {
	if (typeof url !== 'string') return url;
	const copies = staticCopies(url);
	if (copies) return (copies.find((c) => c.width >= width) ?? copies[copies.length - 1]).url;
	if (dev || !isOptimizable(url)) return url;
	return `/_vercel/image?url=${encodeURIComponent(url)}&w=${snapWidth(width)}&q=${DEFAULT_QUALITY}`;
}

/**
 * A `srcset` for `url`: every copy of a site photo, or the given widths of a media bucket
 * photo. `undefined` when there is nothing to choose from (then leave the attribute off and
 * the browser uses `src`).
 */
export function srcset(url: string | null | undefined, widths: readonly number[] = IMAGE_WIDTHS): string | undefined {
	if (typeof url !== 'string') return undefined;
	const copies = staticCopies(url);
	if (copies) return copies.map((c) => `${c.url} ${c.width}w`).join(', ');
	if (dev || !isOptimizable(url)) return undefined;
	const unique = [...new Set(widths.map(snapWidth))].sort((a, b) => a - b);
	return unique.map((w) => `${optimizedSrc(url, w)} ${w}w`).join(', ');
}
