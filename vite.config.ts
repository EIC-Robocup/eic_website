import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

/**
 * The CSP hash of the inline motion script in src/app.html, read from the file on every build
 * so it can never drift from the script. Kit hashes its own inline scripts (csp mode 'hash').
 */
function appHtmlScriptHashes(): string[] {
	const html = readFileSync(new URL('./src/app.html', import.meta.url), 'utf8');
	const hashes: string[] = [];
	for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
		hashes.push(`sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}`);
	}
	return hashes;
}

/**
 * Svelte's server render gives <img> elements with load or error handlers (bits-ui's Avatar)
 * `onload="this.__e=event"` and `onerror="this.__e=event"`, so events that fire before
 * hydration are not lost. 'unsafe-hashes' with this hash allows exactly that handler and no
 * other inline handler.
 */
const SVELTE_EVENT_CAPTURE = `sha256-${createHash('sha256').update('this.__e=event', 'utf8').digest('base64')}`;

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	// The Supabase project whose public "media" bucket Vercel may resize (see src/lib/image.ts).
	// Read at build time; without SUPABASE_URL nothing is optimized and photos load as they are.
	let mediaHost = '';
	try {
		mediaHost = env.SUPABASE_URL ? new URL(env.SUPABASE_URL).hostname : '';
	} catch {
		console.warn('SUPABASE_URL is not a URL: media photos will not go through Vercel Image Optimization.');
	}

	// Vercel Image Optimization for photos in the media bucket, used through optimizedSrc() and
	// srcset() in src/lib/image.ts (keep `sizes` and `qualities` in sync with IMAGE_WIDTHS and
	// DEFAULT_QUALITY there). Only this project's media bucket and one quality are allowed, so
	// nobody can bill transformations of their own images to the club's account. Resized copies
	// are cached for 31 days. A variable, not an inline literal: the adapter's type lacks
	// `qualities`, which Vercel's Build Output API accepts.
	const images = {
		sizes: [320, 480, 640, 960, 1280, 1920],
		formats: ['image/avif', 'image/webp'] as ('image/avif' | 'image/webp')[],
		minimumCacheTTL: 2678400,
		domains: [],
		qualities: [75],
		remotePatterns: mediaHost
			? [{ protocol: 'https' as const, hostname: mediaHost, pathname: '/storage/v1/object/public/media/**' }]
			: []
	};

	return {
		define: {
			__MEDIA_HOST__: JSON.stringify(mediaHost)
		},
		plugins: [
			tailwindcss(),
			enhancedImages(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				/**
				 * Content Security Policy. Hashes, not nonces: public pages are cached by Vercel's CDN
				 * (hooks.server.ts), and a cached nonce would be the same for everyone. Kit adds the
				 * hashes of its own inline scripts to each response.
				 * - script-src: the site's bundles, the app.html motion script, Svelte's pre-hydration
				 *   event capture on images, and WebAssembly for model-viewer's Draco and KTX2 decoders.
				 * - style-src 'unsafe-inline': Svelte, bits-ui and Mermaid set inline styles.
				 * - img, media and connect: posts may show images, videos and 3D models from any
				 *   https host, and the admin uploads straight to a signed Supabase Storage URL.
				 * - frame-src: the click-to-play YouTube and Vimeo players only.
				 * No form-action: sign in with GitHub or Google answers a form post with a redirect
				 * to Supabase and the provider.
				 */
				csp: {
					mode: 'hash',
					directives: {
						'default-src': ['self'],
						'script-src': [
							'self',
							'wasm-unsafe-eval',
							'unsafe-hashes',
							SVELTE_EVENT_CAPTURE as `sha256-${string}`,
							...(appHtmlScriptHashes() as `sha256-${string}`[])
						],
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:', 'blob:', 'https:'],
						'media-src': ['self', 'blob:', 'https:'],
						'font-src': ['self', 'data:'],
						'connect-src': ['self', 'https:'],
						'worker-src': ['self', 'blob:'],
						'frame-src': ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
						'object-src': ['none'],
						'base-uri': ['self'],
						'frame-ancestors': ['self']
					}
				},
				// Singapore is the closest Vercel region to Bangkok. Put the Supabase project in
				// Southeast Asia (Singapore) too, so database calls stay short.
				adapter: adapter({
					runtime: 'nodejs24.x',
					regions: ['sin1'],
					images
				})
			})
		]
	};
});
