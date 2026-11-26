/**
 * Client enhancements for a rendered post (PostBody runs them after mount and whenever the
 * HTML changes). Each feature looks for its markup and loads its code only when the post has
 * it: mermaid and @google/model-viewer are dynamic imports, and so are the shadcn Button and
 * the toast used by copy buttons.
 *
 * - heading anchor links (shown on hover and focus; a click also copies the link)
 * - copy buttons on code blocks, with a "Copied" toast
 * - lite YouTube and Vimeo players: the iframe is created only when the poster is clicked
 * - Mermaid diagrams drawn into their block, the source kept in a <details>
 * - <model-viewer> for 3D models, loaded when the model scrolls near the screen
 * - click to zoom for figures, galleries and images (PostBody shows the lightbox)
 */
import type { Component } from 'svelte';

export type LightboxItem = {
	src: string;
	alt: string;
	caption: string;
	/** "Fig. 02" when the figure has a number. */
	label: string;
	width?: number;
	height?: number;
};

export type EnhanceHooks = {
	/** Open the lightbox at `index`. */
	openLightbox: (items: LightboxItem[], index: number) => void;
	/** Start loading the lightbox code (called when the post has zoomable images). */
	preloadLightbox?: () => void;
};

type Cleanup = () => void;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/i;

/* ------------------------------------------------------------------------------------------ */
/* Toasts                                                                                       */
/* ------------------------------------------------------------------------------------------ */

let toasterMounted = false;

/** Show a toast, mounting a Toaster first when the page has none (the public site). */
export async function notify(message: string, kind: 'success' | 'error' = 'success'): Promise<void> {
	const { toast } = await import('svelte-sonner');
	if (!toasterMounted && !document.querySelector('section[aria-label^="Notifications"][aria-live]')) {
		toasterMounted = true;
		const [{ mount }, { Toaster }] = await Promise.all([import('svelte'), import('#lib/components/ui/sonner/index.js')]);
		mount(Toaster as unknown as Component<Record<string, unknown>>, {
			target: document.body,
			props: { position: 'bottom-center' }
		});
		// Give the toaster a frame to subscribe before the first toast.
		await new Promise((done) => requestAnimationFrame(() => done(null)));
	}
	if (kind === 'error') toast.error(message);
	else toast.success(message);
}

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// Older browsers / insecure origins: a hidden textarea and execCommand.
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.append(area);
		area.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		area.remove();
		return ok;
	}
}

/* ------------------------------------------------------------------------------------------ */
/* Heading anchors                                                                              */
/* ------------------------------------------------------------------------------------------ */

function headingAnchors(root: HTMLElement): Cleanup {
	const added: HTMLElement[] = [];
	for (const heading of root.querySelectorAll<HTMLElement>('h2[id], h3[id], h4[id]')) {
		if (heading.closest('.footnotes') || heading.querySelector('.heading-anchor')) continue;
		const text = heading.textContent?.trim() ?? '';
		const anchor = document.createElement('a');
		anchor.className = 'heading-anchor';
		anchor.href = `#${encodeURIComponent(heading.id)}`;
		anchor.setAttribute('aria-label', `Link to this section: ${text}`);
		anchor.textContent = '#';
		anchor.addEventListener('click', () => {
			const url = new URL(window.location.href);
			url.hash = heading.id;
			void copyText(url.toString()).then((ok) => {
				if (ok) void notify('Link copied');
			});
		});
		heading.append(anchor);
		added.push(anchor);
	}
	return () => added.forEach((a) => a.remove());
}

/* ------------------------------------------------------------------------------------------ */
/* Copy buttons                                                                                 */
/* ------------------------------------------------------------------------------------------ */

const COPY_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function copyButtons(root: HTMLElement): Cleanup {
	const blocks = [...root.querySelectorAll<HTMLElement>('.code-block')].filter((b) => !b.querySelector('.code-copy'));
	if (!blocks.length) return () => {};
	let cancelled = false;
	const mounted: Record<string, unknown>[] = [];
	let unmountFn: ((component: Record<string, unknown>) => void) | null = null;

	void (async () => {
		const [{ mount, unmount, createRawSnippet }, { Button }] = await Promise.all([
			import('svelte'),
			import('#lib/components/ui/button/index.js')
		]);
		if (cancelled) return;
		unmountFn = (c) => void unmount(c);
		for (const block of blocks) {
			const head = block.querySelector<HTMLElement>('.code-head');
			const code = block.querySelector('code');
			if (!head || !code) continue;
			const title = block.querySelector('.code-title')?.textContent?.trim();
			let label: HTMLElement | null = null;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const inner = (copied: boolean) => `${copied ? CHECK_ICON : COPY_ICON}<span>${copied ? 'Copied' : 'Copy'}</span>`;
			const children = createRawSnippet(() => ({
				render: () => `<span class="inline-flex items-center gap-1.5">${inner(false)}</span>`,
				setup(node: Element) {
					label = node as HTMLElement;
				}
			}));
			const component = mount(Button as unknown as Component<Record<string, unknown>>, {
				target: head,
				props: {
					variant: 'ghost',
					size: 'sm',
					class: 'code-copy h-9 pointer-coarse:h-11 px-2.5 text-[13px] text-ink-muted hover:text-ink',
					'aria-label': title ? `Copy code: ${title}` : 'Copy code',
					children,
					onclick: async () => {
						const ok = await copyText(code.textContent ?? '');
						if (!ok) {
							void notify('Could not copy. Select the code and copy it by hand.', 'error');
							return;
						}
						if (label) label.innerHTML = inner(true);
						void notify('Copied');
						clearTimeout(timer);
						timer = setTimeout(() => {
							if (label) label.innerHTML = inner(false);
						}, 2000);
					}
				}
			});
			mounted.push(component as Record<string, unknown>);
		}
	})();

	return () => {
		cancelled = true;
		for (const component of mounted) unmountFn?.(component);
	};
}

/* ------------------------------------------------------------------------------------------ */
/* Lite YouTube / Vimeo                                                                         */
/* ------------------------------------------------------------------------------------------ */

const preconnected = new Set<string>();
function preconnect(origin: string) {
	if (preconnected.has(origin)) return;
	preconnected.add(origin);
	const link = document.createElement('link');
	link.rel = 'preconnect';
	link.href = origin;
	document.head.append(link);
}

function playerUrl(figure: HTMLElement): { src: string; origin: string } | null {
	const { provider, id = '', start = '', hash = '' } = figure.dataset;
	const seconds = /^\d{1,6}$/.test(start) ? Number(start) : 0;
	if (provider === 'youtube' && YOUTUBE_ID.test(id)) {
		const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
		if (seconds) params.set('start', String(seconds));
		return { src: `https://www.youtube-nocookie.com/embed/${id}?${params}`, origin: 'https://www.youtube-nocookie.com' };
	}
	if (provider === 'vimeo' && VIMEO_ID.test(id)) {
		const params = new URLSearchParams({ autoplay: '1', dnt: '1' });
		if (hash && VIMEO_HASH.test(hash)) params.set('h', hash);
		return { src: `https://player.vimeo.com/video/${id}?${params}${seconds ? `#t=${seconds}s` : ''}`, origin: 'https://player.vimeo.com' };
	}
	return null;
}

function litePlayers(root: HTMLElement): Cleanup {
	const undo: Cleanup[] = [];
	for (const figure of root.querySelectorAll<HTMLElement>('figure.embed-video[data-provider]')) {
		const poster = figure.querySelector<HTMLAnchorElement>('a.embed-poster');
		const player = playerUrl(figure);
		if (!poster || !player) continue;
		const title = figure.dataset.title && figure.dataset.title !== 'Video' ? figure.dataset.title : '';
		const provider = figure.dataset.provider === 'vimeo' ? 'Vimeo' : 'YouTube';

		// The link becomes a real button that plays in place.
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'embed-poster';
		button.setAttribute('aria-label', `Play video${title ? `: ${title}` : ''} (${provider})`);
		for (const child of [...poster.childNodes]) {
			if (child instanceof HTMLElement && child.classList.contains('sr-only')) continue;
			button.append(child);
		}
		poster.replaceWith(button);

		const warm = () => preconnect(player.origin);
		button.addEventListener('pointerenter', warm, { once: true });
		button.addEventListener('focus', warm, { once: true });
		button.addEventListener('click', () => {
			const stage = document.createElement('div');
			stage.className = 'embed-stage';
			const iframe = document.createElement('iframe');
			iframe.className = 'embed-frame';
			iframe.src = player.src;
			iframe.title = `${title || 'Video'} (${provider})`;
			iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
			iframe.allowFullscreen = true;
			iframe.referrerPolicy = 'strict-origin-when-cross-origin';
			stage.append(iframe);
			button.replaceWith(stage);
			iframe.focus();
		});
		undo.push(() => {
			if (button.isConnected) button.replaceWith(poster);
		});
	}
	return () => undo.forEach((fn) => fn());
}

/* ------------------------------------------------------------------------------------------ */
/* Mermaid                                                                                      */
/* ------------------------------------------------------------------------------------------ */

type Mermaid = typeof import('mermaid').default;
let mermaidReady: Promise<Mermaid> | null = null;
/** Drawn diagrams by source, so the admin preview redraws instantly while you type. */
const diagramCache = new Map<string, string>();
let diagramCount = 0;

function loadMermaid(): Promise<Mermaid> {
	mermaidReady ??= import('mermaid').then(({ default: mermaid }) => {
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'strict',
			// Hairlines, no shadows (brand book).
			themeCSS: '.node rect, .node polygon, .node circle, .node path, .cluster rect { filter: none !important; }',
			theme: 'base',
			fontFamily: "'Inter Variable', Inter, system-ui, sans-serif",
			themeVariables: {
				darkMode: true,
				fontSize: '15px',
				background: '#0B0B0B',
				mainBkg: '#1A1A1A',
				primaryColor: '#1A1A1A',
				primaryTextColor: '#F3F2EE',
				primaryBorderColor: '#75726B',
				secondaryColor: '#232323',
				secondaryTextColor: '#F3F2EE',
				secondaryBorderColor: '#75726B',
				tertiaryColor: '#111111',
				tertiaryTextColor: '#F3F2EE',
				tertiaryBorderColor: '#2E2E2E',
				textColor: '#F3F2EE',
				lineColor: '#A3A09A',
				nodeBorder: '#75726B',
				nodeTextColor: '#F3F2EE',
				clusterBkg: '#111111',
				clusterBorder: '#2E2E2E',
				edgeLabelBackground: '#111111',
				titleColor: '#F3F2EE',
				noteBkgColor: '#232323',
				noteTextColor: '#F3F2EE',
				noteBorderColor: '#75726B',
				actorBkg: '#1A1A1A',
				actorBorder: '#75726B',
				actorTextColor: '#F3F2EE',
				actorLineColor: '#75726B',
				signalColor: '#A3A09A',
				signalTextColor: '#F3F2EE',
				labelBoxBkgColor: '#1A1A1A',
				labelBoxBorderColor: '#75726B',
				labelTextColor: '#F3F2EE',
				loopTextColor: '#F3F2EE',
				activationBkgColor: '#232323',
				activationBorderColor: '#75726B',
				sequenceNumberColor: '#111111',
				critBkgColor: '#D7262C',
				critBorderColor: '#FF6A6E',
				doneTaskBkgColor: '#232323',
				doneTaskBorderColor: '#75726B',
				taskBkgColor: '#1A1A1A',
				taskBorderColor: '#75726B',
				activeTaskBkgColor: '#2E2E2E',
				activeTaskBorderColor: '#F3F2EE',
				taskTextColor: '#F3F2EE',
				taskTextDarkColor: '#F3F2EE',
				gridColor: '#2E2E2E',
				todayLineColor: '#FF6A6E',
				pie1: '#D7262C',
				pie2: '#F3F2EE',
				pie3: '#A3A09A',
				pie4: '#55C98F',
				pie5: '#E5679A',
				pie6: '#75726B',
				pieStrokeColor: '#111111',
				pieOuterStrokeColor: '#2E2E2E',
				pieTitleTextColor: '#F3F2EE',
				pieSectionTextColor: '#111111',
				pieLegendTextColor: '#F3F2EE'
			}
		});
		return mermaid;
	});
	return mermaidReady;
}

function diagrams(root: HTMLElement): Cleanup {
	const blocks = [...root.querySelectorAll<HTMLElement>('.mermaid-block')].filter((b) => !b.dataset.drawn);
	if (!blocks.length) return () => {};
	let cancelled = false;

	void (async () => {
		let mermaid: Mermaid;
		try {
			mermaid = await loadMermaid();
		} catch (err) {
			console.error('Could not load mermaid', err);
			return;
		}
		for (const block of blocks) {
			if (cancelled) return;
			const pre = block.querySelector<HTMLElement>('pre.mermaid-source');
			const source = pre?.textContent ?? '';
			if (!pre || !source.trim()) continue;
			block.dataset.drawn = 'true';

			let svg = diagramCache.get(source);
			let failure: string | null = null;
			if (!svg) {
				try {
					diagramCount += 1;
					svg = (await mermaid.render(`eic-mermaid-${diagramCount}`, source)).svg;
					diagramCache.set(source, svg);
					if (diagramCache.size > 30) diagramCache.delete(diagramCache.keys().next().value as string);
				} catch (err) {
					failure = err instanceof Error ? err.message.split('\n')[0] : 'Unknown error';
				}
			}
			if (cancelled || !block.isConnected) return;

			const details = document.createElement('details');
			details.className = 'mermaid-details';
			const summary = document.createElement('summary');
			summary.textContent = 'Diagram source';
			details.append(summary);

			if (svg) {
				const figure = document.createElement('div');
				figure.className = 'mermaid-diagram';
				figure.setAttribute('role', 'img');
				const first = source.trim().split('\n')[0].trim();
				figure.setAttribute('aria-label', `Diagram (${first.slice(0, 60)}). The source is below.`);
				figure.innerHTML = svg;
				// Natural size, shrinking to at most 65% on narrow screens; beyond that the
				// block scrolls sideways so labels stay readable on phones.
				const drawing = figure.querySelector('svg');
				const natural = drawing?.viewBox?.baseVal?.width ?? 0;
				if (drawing && natural > 0) {
					drawing.style.width = '100%';
					drawing.style.maxWidth = `${Math.round(natural)}px`;
					drawing.style.minWidth = `${Math.round(Math.min(natural, natural * 0.65))}px`;
				}
				pre.replaceWith(figure);
				details.append(pre);
				block.append(details);
				// Wide diagrams scroll sideways: let keyboard users scroll them too.
				if (block.scrollWidth > block.clientWidth + 1) {
					block.tabIndex = 0;
					block.setAttribute('role', 'group');
					block.setAttribute('aria-label', 'Diagram, scrolls sideways');
				}
			} else {
				const message = document.createElement('p');
				message.className = 'mermaid-error';
				message.textContent = `This diagram could not be drawn: ${failure}`;
				block.prepend(message);
			}
		}
	})();

	return () => {
		cancelled = true;
	};
}

/* ------------------------------------------------------------------------------------------ */
/* 3D models                                                                                    */
/* ------------------------------------------------------------------------------------------ */

let modelViewerReady: Promise<unknown> | null = null;

function safeModelUrl(value: string | undefined): string | null {
	if (!value) return null;
	if (value.startsWith('/') && !value.startsWith('//')) return value;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
	} catch {
		return null;
	}
}

function models(root: HTMLElement): Cleanup {
	const figures = [...root.querySelectorAll<HTMLElement>('figure.media-model[data-src]')];
	if (!figures.length) return () => {};
	const observers: IntersectionObserver[] = [];

	for (const figure of figures) {
		const stage = figure.querySelector<HTMLElement>('.model-stage');
		const src = safeModelUrl(figure.dataset.src);
		if (!stage || !src || stage.querySelector('model-viewer')) continue;
		const label = stage.querySelector<HTMLElement>('.model-label');

		const start = async () => {
			if (label) label.textContent = 'Loading 3D model';
			try {
				modelViewerReady ??= import('@google/model-viewer');
				await modelViewerReady;
			} catch (err) {
				console.error('Could not load model-viewer', err);
				if (label) label.textContent = 'The 3D viewer could not load';
				return;
			}
			if (!stage.isConnected) return;
			const viewer = document.createElement('model-viewer');
			viewer.setAttribute('src', src);
			viewer.setAttribute('alt', figure.dataset.alt || '3D model');
			viewer.setAttribute('camera-controls', '');
			viewer.setAttribute('auto-rotate', '');
			viewer.setAttribute('auto-rotate-delay', '1500');
			viewer.setAttribute('touch-action', 'pan-y');
			viewer.setAttribute('interaction-prompt', 'none');
			viewer.setAttribute('shadow-intensity', '0.6');
			viewer.setAttribute('exposure', '1.05');
			viewer.setAttribute('environment-image', 'neutral');
			const bar = document.createElement('span');
			bar.className = 'model-progress';
			bar.setAttribute('aria-hidden', 'true');
			viewer.addEventListener('progress', (event) => {
				const progress = (event as unknown as CustomEvent<{ totalProgress: number }>).detail?.totalProgress ?? 0;
				bar.style.width = `${Math.round(progress * 100)}%`;
				if (progress >= 1) bar.remove();
			});
			viewer.addEventListener('load', () => {
				stage.classList.add('is-loaded');
				const hint = document.createElement('span');
				hint.className = 'model-hint';
				hint.textContent = 'Drag to turn';
				hint.setAttribute('aria-hidden', 'true');
				stage.append(hint);
			});
			viewer.addEventListener('error', () => {
				if (label) label.textContent = 'This model could not be loaded';
				bar.remove();
			});
			stage.append(viewer, bar);
		};

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					observer.disconnect();
					void start();
				}
			},
			{ rootMargin: '300px 0px' }
		);
		observer.observe(figure);
		observers.push(observer);
	}
	return () => observers.forEach((o) => o.disconnect());
}

/* ------------------------------------------------------------------------------------------ */
/* Lightbox triggers                                                                            */
/* ------------------------------------------------------------------------------------------ */

/** The largest candidate of an image's srcset, else its src. */
function fullSize(img: HTMLImageElement): string {
	const set = img.getAttribute('srcset');
	if (set) {
		let best = '';
		let bestWidth = 0;
		for (const candidate of set.split(/,\s+/)) {
			const [url, descriptor = ''] = candidate.trim().split(/\s+/);
			const width = Number(descriptor.replace(/w$/, '')) || 0;
			if (url && width >= bestWidth) {
				best = url;
				bestWidth = width;
			}
		}
		if (best) return best;
	}
	return img.currentSrc || img.src;
}

function captionFor(img: HTMLImageElement): { caption: string; label: string } {
	const figure = img.closest('figure');
	const label = figure?.querySelector(':scope > figcaption .fig-label')?.textContent?.trim() ?? '';
	if (figure?.classList.contains('gallery')) {
		const items = [...figure.querySelectorAll('.gallery-item')];
		const index = items.findIndex((li) => li.contains(img));
		const key = items[index]?.querySelector('.gallery-key')?.textContent?.trim();
		const text = figure.querySelector(':scope > figcaption .fig-text');
		if (key && text) {
			// Pick "(b) Second" out of "(a) First (b) Second".
			const parts = text.innerHTML.split(/<b>/).slice(1);
			const mine = parts.find((p) => p.startsWith(`(${key})`));
			if (mine) {
				const holder = document.createElement('span');
				holder.innerHTML = mine.replace(/^\([a-z]\)<\/b>\s*/, '');
				return { caption: holder.textContent?.trim() ?? '', label: label ? `${label} (${key})` : '' };
			}
		}
		return { caption: '', label };
	}
	const text = figure?.querySelector(':scope > figcaption .fig-text')?.textContent?.trim() ?? '';
	return { caption: text, label };
}

function zoomableImages(root: HTMLElement): HTMLImageElement[] {
	return [...root.querySelectorAll<HTMLImageElement>('.figure-frame img, .gallery-item img, p > img')].filter(
		(img) => !img.closest('a') && !img.closest('.embed')
	);
}

function lightbox(root: HTMLElement, hooks: EnhanceHooks): Cleanup {
	const images = zoomableImages(root);
	if (!images.length) return () => {};
	const items: LightboxItem[] = images.map((img) => ({
		src: fullSize(img),
		alt: img.alt,
		...captionFor(img),
		width: Number(img.getAttribute('width')) || undefined,
		height: Number(img.getAttribute('height')) || undefined
	}));
	const undo: Cleanup[] = [];
	images.forEach((img, index) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'zoom-trigger';
		button.setAttribute('aria-label', img.alt ? `Enlarge image: ${img.alt}` : 'Enlarge image');
		button.setAttribute('aria-haspopup', 'dialog');
		img.replaceWith(button);
		button.append(img);
		button.addEventListener('click', () => hooks.openLightbox(items, index));
		undo.push(() => {
			if (button.isConnected) button.replaceWith(img);
		});
	});

	// Load the lightbox code once the browser is idle.
	const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
	if (idle) idle(() => hooks.preloadLightbox?.());
	else setTimeout(() => hooks.preloadLightbox?.(), 800);

	return () => undo.forEach((fn) => fn());
}

/* ------------------------------------------------------------------------------------------ */

/** Run every enhancement on `root` (the element holding the post HTML). Returns a cleanup. */
export function enhancePost(root: HTMLElement, hooks: EnhanceHooks): Cleanup {
	const cleanups = [headingAnchors(root), copyButtons(root), litePlayers(root), diagrams(root), models(root), lightbox(root, hooks)];
	return () => {
		for (const cleanup of cleanups.reverse()) {
			try {
				cleanup();
			} catch {
				// The DOM may already be gone.
			}
		}
	};
}
