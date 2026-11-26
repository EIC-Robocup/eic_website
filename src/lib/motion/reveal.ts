/**
 * Reveal on arrival: page content fades in and rises 8px (240ms) as it enters the window.
 *
 *     const reveal = createReveal();      // during component init (registers navigation hooks)
 *     <main {@attach reveal}>             // once, in SiteShell: every page gets it
 *
 * No page needs to opt in. The module walks `main`'s blocks (its sections, the article) and
 * marks their content with `data-reveal`:
 * - the children of each block's `.site-container` (or of the block when it has none);
 * - plain layout wrappers (a column of eyebrow, heading and text) are opened up, so their
 *   children rise one after another;
 * - grids and lists (`ul`, `ol`, a CSS grid) give their items, so cards rise one by one;
 * - anything already marked `data-reveal` in the markup is included (e.g. a HeroBand's
 *   construction circle, `data-reveal="slow"`).
 * Items that enter together are staggered, at most 300ms in all per section. Each item is
 * revealed once, by an IntersectionObserver; content added later ("Load older posts", a
 * filter, a new page after navigation) is picked up by a MutationObserver.
 *
 * Progressive enhancement: an inline script in app.html adds `motion` to <html> unless the
 * visitor prefers reduced motion; the CSS (layout.css) hides content only under `html.motion`.
 * Until this module has marked the page (`motion-ready`), `main` stays transparent, so content
 * never flashes before its entrance; if the module has not run within 2.5s the inline script
 * removes `motion` and everything shows (the module then turns motion back on for the next
 * pages only). Without JavaScript nothing is ever hidden.
 *
 * Back and forward show the page at once. During a page transition, the element morphing from
 * the previous page (see view-transitions.ts) is shown at once too. Focus inside a hidden item
 * (Tab, find in page) reveals it immediately.
 */
import type { Attachment } from 'svelte/attachments';
import { afterNavigate, onNavigate } from '$app/navigation';
import { isPageTransitionRunning, nameArrivals } from './view-transitions.ts';

const THRESHOLD = 0.12;
const ROOT_MARGIN = '0px 0px -8% 0px';
/** Delay between items that enter together, and the most a section's stagger may add up to. */
const STEP = 60;
const MAX_STAGGER = 300;
/** Longest reveal (in ms) per kind, after which the reveal's transition styles are removed. */
const DURATION = { default: 240, slow: 1200, note: 1000 } as const;
/** Fallback: anything in view and still hidden this long after a scan is shown. */
const SAFETY = 2500;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT', 'BR']);
/** Nested blocks are walked like the top-level ones (People groups, the post article). */
const BLOCK_TAGS = new Set(['SECTION', 'ARTICLE']);

type Mode = 'animate' | 'instant';

function transparent(style: CSSStyleDeclaration): boolean {
	return (
		(style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent') &&
		style.backgroundImage === 'none' &&
		parseFloat(style.borderTopWidth) === 0 &&
		parseFloat(style.borderBottomWidth) === 0 &&
		parseFloat(style.borderLeftWidth) === 0 &&
		parseFloat(style.borderRightWidth) === 0 &&
		style.boxShadow === 'none'
	);
}

function elementChildren(el: Element): HTMLElement[] {
	return Array.from(el.children).filter(
		(c): c is HTMLElement => c instanceof HTMLElement && !SKIP_TAGS.has(c.tagName)
	);
}

/** Hidden from sight but kept for screen readers (sr-only, lg:sr-only ...). */
function visuallyHidden(el: HTMLElement, style: CSSStyleDeclaration): boolean {
	return (
		style.clipPath.startsWith('inset(50%') ||
		style.clip === 'rect(0px, 0px, 0px, 0px)' ||
		(style.position === 'absolute' && el.offsetWidth <= 1 && el.offsetHeight <= 1)
	);
}

/** A horizontal scroller: its parts come into view sideways, so it rises as one piece. */
function scroller(style: CSSStyleDeclaration): boolean {
	return style.overflowX === 'auto' || style.overflowX === 'scroll';
}

function hasOwnText(el: Element): boolean {
	for (const node of el.childNodes) {
		if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
	}
	return false;
}

export function createReveal(): Attachment<HTMLElement> {
	/** Type of the navigation in progress, between onNavigate and afterNavigate. */
	let arriving: string | null = null;
	let controller: ReturnType<typeof setup> | null = null;

	onNavigate((navigation) => {
		arriving = navigation.type;
	});

	afterNavigate((navigation) => {
		// The page transition names the element morphing in; keep that one visible.
		nameArrivals();
		controller?.scan(navigation.type === 'popstate' ? 'instant' : 'animate');
		arriving = null;
	});

	function setup(main: HTMLElement, late = false) {
		const html = document.documentElement;
		const seen = new WeakSet<HTMLElement>();
		/** Waiting for the observer; dropped when they leave the page (no detached nodes kept). */
		const observed = new Set<HTMLElement>();
		const timers = new Set<ReturnType<typeof setTimeout>>();
		let frame = 0;

		const io = new IntersectionObserver(onIntersect, {
			threshold: [0, THRESHOLD],
			rootMargin: ROOT_MARGIN
		});

		function later(fn: () => void, ms: number) {
			const t = setTimeout(() => {
				timers.delete(t);
				fn();
			}, ms);
			timers.add(t);
		}

		function skip(el: HTMLElement, style: CSSStyleDeclaration): boolean {
			return (
				Boolean(el.hidden) ||
				el.classList.contains('sr-only') ||
				el.hasAttribute('data-reveal-skip') ||
				style.display === 'none' ||
				style.display === 'contents' ||
				style.position === 'fixed' ||
				visuallyHidden(el, style)
			);
		}

		/** A grid or list whose items should rise one by one. */
		function isList(el: HTMLElement, style: CSSStyleDeclaration): boolean {
			// A frame, a hairline grid or a scroller rises as one piece.
			if (!transparent(style) || scroller(style)) return false;
			const kids = elementChildren(el);
			if (kids.length < 2) return false;
			return el.tagName === 'UL' || el.tagName === 'OL' || style.display.includes('grid');
		}

		/** A plain layout wrapper (no frame of its own) whose children can rise one by one. */
		function isWrapper(el: HTMLElement, style: CSSStyleDeclaration): boolean {
			if (el.tagName !== 'DIV' || hasOwnText(el) || !transparent(style)) return false;
			if (style.position === 'absolute') return false;
			const column =
				style.display === 'block' ||
				(style.display.includes('flex') && style.flexDirection.startsWith('column'));
			return column && elementChildren(el).length >= 2;
		}

		function collectChildren(container: HTMLElement, items: HTMLElement[], depth: number) {
			for (const child of elementChildren(container)) {
				const style = getComputedStyle(child);
				if (skip(child, style)) continue;
				if (scroller(style)) {
					items.push(child);
				} else if (BLOCK_TAGS.has(child.tagName) && depth < 3) {
					collectBlock(child, items, depth + 1);
				} else if (isList(child, style)) {
					for (const item of elementChildren(child)) {
						if (!skip(item, getComputedStyle(item))) items.push(item);
					}
				} else if (depth < 1 && isWrapper(child, style)) {
					collectChildren(child, items, depth + 1);
				} else if (
					child.tagName === 'DIV' &&
					elementChildren(child).length === 1 &&
					!hasOwnText(child) &&
					transparent(style) &&
					depth < 3
				) {
					// A wrapper around one thing (often a framed grid): look inside.
					collectChildren(child, items, depth + 1);
				} else {
					items.push(child);
				}
			}
		}

		function collectBlock(block: HTMLElement, items: HTMLElement[], depth: number) {
			const style = getComputedStyle(block);
			if (skip(block, style)) return;
			let containers: HTMLElement[];
			if (block.classList.contains('site-container')) {
				containers = [block];
			} else {
				containers = Array.from(
					block.querySelectorAll<HTMLElement>(':scope > .site-container, :scope > * > .site-container')
				);
				if (containers.length === 0) containers = [block];
			}
			for (const container of containers) collectChildren(container, items, depth);
		}

		/** Mark new content. Already processed elements are left alone. */
		function scan(mode: Mode = arriving === 'popstate' ? 'instant' : 'animate') {
			cancelAnimationFrame(frame);
			frame = 0;
			if (!html.classList.contains('motion')) return;

			for (const el of observed) {
				if (!el.isConnected) {
					io.unobserve(el);
					observed.delete(el);
				}
			}

			const found: HTMLElement[] = [];
			for (const block of elementChildren(main)) collectBlock(block, found, 0);
			found.push(...main.querySelectorAll<HTMLElement>('[data-reveal]'));

			const fresh: HTMLElement[] = [];
			for (const el of found) {
				if (seen.has(el)) continue;
				seen.add(el);
				fresh.push(el);
			}
			if (fresh.length === 0) {
				html.classList.add('motion-ready');
				return;
			}

			const morphing = isPageTransitionRunning();
			for (const el of fresh) {
				if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
				const instant =
					mode === 'instant' ||
					!el.getClientRects().length ||
					(morphing && el.querySelector('[data-vt-active]') !== null);
				if (instant) {
					show(el, 0, true);
				} else {
					io.observe(el);
					observed.add(el);
				}
			}
			html.classList.add('motion-ready');

			// Safety net: whatever is in view and still hidden after a while is shown.
			later(() => {
				for (const el of fresh) {
					if (el.hasAttribute('data-revealed')) continue;
					const r = el.getBoundingClientRect();
					if (r.bottom > 0 && r.top < window.innerHeight && r.width > 0) show(el, 0, false);
				}
			}, SAFETY);
			checkBottom();
		}

		function durationOf(el: HTMLElement): number {
			if (el.dataset.reveal === 'slow') return DURATION.slow;
			if (el.querySelector('.note-arrow')) return DURATION.note;
			return DURATION.default;
		}

		function show(el: HTMLElement, delay: number, instant: boolean) {
			io.unobserve(el);
			observed.delete(el);
			if (el.hasAttribute('data-revealed')) return;
			const done = () => {
				el.style.removeProperty('will-change');
				el.style.removeProperty('--reveal-delay');
				el.setAttribute('data-reveal-done', '');
			};
			if (instant) {
				el.setAttribute('data-reveal-done', '');
			} else {
				if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
				el.style.willChange = 'opacity, translate';
				later(done, delay + durationOf(el) + 80);
			}
			el.setAttribute('data-revealed', '');
			el.classList.add('is-revealed');
		}

		/** Reveal a batch: items of the same section rise one after another. */
		function showBatch(els: HTMLElement[]) {
			const groups = new Map<Element, HTMLElement[]>();
			for (const el of els) {
				const group = el.closest('#main > *, section, article') ?? main;
				const list = groups.get(group);
				if (list) list.push(el);
				else groups.set(group, [el]);
			}
			for (const list of groups.values()) {
				list.sort((a, b) =>
					a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
				);
				const staggered = list.filter((el) => !el.dataset.reveal);
				const step = staggered.length > 1 ? Math.min(STEP, MAX_STAGGER / (staggered.length - 1)) : 0;
				let i = 0;
				for (const el of list) {
					show(el, el.dataset.reveal ? 0 : Math.round(i++ * step), false);
				}
			}
		}

		function onIntersect(entries: IntersectionObserverEntry[]) {
			const ready: HTMLElement[] = [];
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const el = entry.target as HTMLElement;
				const rootHeight = entry.rootBounds?.height ?? window.innerHeight;
				// Very tall items can never be 12% visible: they go as soon as they show.
				const reachable = rootHeight / Math.max(1, entry.boundingClientRect.height) > THRESHOLD * 1.25;
				if (entry.intersectionRatio >= THRESHOLD || !reachable) ready.push(el);
			}
			if (ready.length) showBatch(ready);
		}

		/**
		 * The observer's root stops 8% above the bottom of the window. At the end of the page
		 * (or on a page too short to scroll) that strip can never scroll up, so whatever is
		 * visible there is revealed here.
		 */
		function checkBottom() {
			const doc = document.documentElement;
			const atEnd = window.scrollY + window.innerHeight >= doc.scrollHeight - window.innerHeight * 0.08 - 2;
			if (!atEnd) return;
			const visible: HTMLElement[] = [];
			for (const el of main.querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])')) {
				const r = el.getBoundingClientRect();
				if (r.width > 0 && r.top < window.innerHeight && r.bottom > 0) visible.push(el);
			}
			if (visible.length) showBatch(visible);
		}

		let scrollFrame = 0;
		function onScroll() {
			if (scrollFrame) return;
			scrollFrame = requestAnimationFrame(() => {
				scrollFrame = 0;
				checkBottom();
			});
		}

		function onFocusIn(event: FocusEvent) {
			const el = (event.target as Element | null)?.closest<HTMLElement>(
				'[data-reveal]:not([data-revealed])'
			);
			if (el) show(el, 0, true);
		}

		const mo = new MutationObserver(() => {
			if (!frame) frame = requestAnimationFrame(() => scan());
		});

		scan(late ? 'instant' : 'animate');
		mo.observe(main, { childList: true, subtree: true });
		main.addEventListener('focusin', onFocusIn);
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });

		return {
			scan,
			destroy() {
				io.disconnect();
				observed.clear();
				mo.disconnect();
				cancelAnimationFrame(frame);
				cancelAnimationFrame(scrollFrame);
				for (const t of timers) clearTimeout(t);
				main.removeEventListener('focusin', onFocusIn);
				window.removeEventListener('scroll', onScroll);
				window.removeEventListener('resize', onScroll);
			}
		};
	}

	return (main) => {
		const html = document.documentElement;
		if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) {
			html.classList.remove('motion');
			return;
		}
		// The app arrived after app.html's 2.5s safety showed the page: leave this page as it
		// is, and let the next pages animate.
		const late = html.hasAttribute('data-motion-late') && !html.classList.contains('motion');
		if (late) {
			html.removeAttribute('data-motion-late');
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			html.classList.add('motion');
		}
		if (!html.classList.contains('motion')) return;
		controller = setup(main, late);
		return () => {
			controller?.destroy();
			controller = null;
		};
	};
}
