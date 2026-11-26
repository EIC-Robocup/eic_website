/**
 * Image delivery through Vercel Image Optimization.
 *
 * Photos uploaded in the admin panel live in the public Supabase Storage "media" bucket. On
 * Vercel they are served through `/_vercel/image`, which resizes them to the width the page
 * needs and converts them to AVIF or WebP, then caches the result at the edge for a month.
 * The widths here must match `images.sizes` in vite.config.ts: Vercel refuses any other width.
 *
 * Only Supabase Storage public URLs are rewritten. Site images (`/images/...`), other hosts and
 * everything in dev pass through unchanged, because `/_vercel/image` only exists on Vercel.
 *
 *     <img src={optimizedSrc(url, 1280)} srcset={srcset(url)} sizes="(min-width: 784px) 720px, 100vw" />
 *
 * Safe to import anywhere (server and browser).
 */
import { dev } from '$app/env';

/** Widths Vercel may resize to. Keep in sync with `images.sizes` in vite.config.ts. */
export const IMAGE_WIDTHS = [320, 480, 640, 960, 1280, 1920] as const;

/** Default quality for optimized images (Vercel accepts 1 to 100). */
export const DEFAULT_QUALITY = 75;

/** A public object URL in any Supabase project's Storage, e.g. https://abc.supabase.co/storage/v1/object/public/media/x.webp */
const SUPABASE_PUBLIC_URL = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/[^?#]+$/i;

/** True for URLs that Vercel may optimize (Supabase Storage public URLs). */
export function isOptimizable(url: string | null | undefined): url is string {
	return typeof url === 'string' && SUPABASE_PUBLIC_URL.test(url);
}

/** The smallest allowed width that is at least `width` (the largest one if none is). */
function snapWidth(width: number): number {
	for (const w of IMAGE_WIDTHS) if (w >= width) return w;
	return IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}

function clampQuality(quality: number): number {
	return Math.min(100, Math.max(1, Math.round(quality)));
}

/**
 * The URL to show `url` at about `width` CSS pixels wide. Rewritten to `/_vercel/image` for
 * Supabase Storage images outside dev; returned unchanged otherwise.
 */
export function optimizedSrc(url: string, width: number, quality = DEFAULT_QUALITY): string;
export function optimizedSrc(url: string | null | undefined, width: number, quality?: number): string | null | undefined;
export function optimizedSrc(url: string | null | undefined, width: number, quality = DEFAULT_QUALITY) {
	if (dev || !isOptimizable(url)) return url;
	return `/_vercel/image?url=${encodeURIComponent(url)}&w=${snapWidth(width)}&q=${clampQuality(quality)}`;
}

/**
 * A `srcset` for `url` at the given widths, or `undefined` when the URL is not optimized (then
 * leave the attribute off and the browser uses `src`).
 */
export function srcset(
	url: string | null | undefined,
	widths: readonly number[] = IMAGE_WIDTHS,
	quality = DEFAULT_QUALITY
): string | undefined {
	if (dev || !isOptimizable(url)) return undefined;
	const unique = [...new Set(widths.map(snapWidth))].sort((a, b) => a - b);
	return unique.map((w) => `${optimizedSrc(url, w, quality)} ${w}w`).join(', ');
}
