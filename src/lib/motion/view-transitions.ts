/**
 * Page transitions with the View Transitions API (browser only).
 *
 * `pageTransition` is passed to `onNavigate` once, in the root layout, so every page gets it.
 * A client-side navigation to another page is wrapped in `document.startViewTransition`: the
 * old page fades out with a slight lift and the new one fades in with an 8px rise (CSS in
 * src/routes/layout.css). The site header (`site-nav`) and the admin sidebar (`admin-sidebar`)
 * have their own names there, so they keep still while the content changes.
 *
 * Skipped, so the navigation is instant: browsers without the API, reduced motion, back and
 * forward, and navigations that only change the query or hash (filters, search, "#contact").
 *
 * Shared elements: an element with `data-vt-key="project-walkie-4"` (or its `.vt-target`
 * descendant, for components that cannot take attributes) morphs into the element with the
 * same key on the next page. Names are given only for the length of a transition and only to
 * pairs that can match, so they are always unique:
 * - on the page being left: elements inside the link that was followed (the card), and
 *   elements outside any link (a page's hero photo and title);
 * - on the new page: elements whose key was named on the old page.
 * An element that finds no partner fades out (or in) with the page.
 */
import type { OnNavigate } from '$app/navigation';

const KEY = 'data-vt-key';
const ACTIVE = 'data-vt-active';

/** A valid, readable view-transition-name from a slug. */
function ident(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** Morph key of a project's cover (card) and hero photo (project page). */
export const projectMorphKey = (slug: string) => `project-${ident(slug)}`;

/** Morph key of a post's cover (card) and cover figure (post page). */
export const postMorphKey = (slug: string) => `post-${ident(slug)}`;

type Pending = {
	/** Keys named on the page being left. */
	keys: Set<string>;
	/** True once the new page's partners have been named. */
	arrived: boolean;
	transition: ViewTransition | null;
};

let pending: Pending | null = null;

/** True while a page transition is between capturing the old page and finishing. */
export function isPageTransitionRunning(): boolean {
	return pending !== null;
}

function target(el: HTMLElement): HTMLElement {
	return el.querySelector<HTMLElement>('.vt-target') ?? el;
}

function rendered(el: Element): boolean {
	return el.getClientRects().length > 0;
}

/** Name the first rendered element of each key that `accept` lets through. */
function nameElements(accept: (el: HTMLElement, key: string) => boolean): Set<string> {
	const named = new Set<string>();
	for (const el of document.querySelectorAll<HTMLElement>(`[${KEY}]`)) {
		const key = el.getAttribute(KEY);
		if (!key || named.has(key) || !accept(el, key)) continue;
		const node = target(el);
		if (!rendered(node)) continue;
		node.style.viewTransitionName = key;
		node.setAttribute(ACTIVE, '');
		named.add(key);
	}
	return named;
}

function clearNames() {
	for (const el of document.querySelectorAll<HTMLElement>(`[${ACTIVE}]`)) {
		el.style.removeProperty('view-transition-name');
		el.removeAttribute(ACTIVE);
	}
}

/**
 * Name the new page's partners of the old page's shared elements. Runs once per transition,
 * as soon as the new page is in the DOM (the reveal module calls it from afterNavigate, so it
 * can leave those elements visible; the transition calls it again as a fallback).
 */
export function nameArrivals(): void {
	if (!pending || pending.arrived) return;
	pending.arrived = true;
	const keys = pending.keys;
	if (keys.size === 0) return;
	clearNames();
	nameElements((_, key) => keys.has(key));
}

function pathOf(link: Element): string | null {
	if (!(link instanceof HTMLAnchorElement)) return null;
	try {
		return new URL(link.href, location.href).pathname;
	} catch {
		return null;
	}
}

const ignore = () => {};

/** For `onNavigate`: wraps the navigation in a view transition when it should animate. */
export function pageTransition(navigation: OnNavigate): Promise<void> | void {
	if (typeof document === 'undefined' || !document.startViewTransition) return;
	const from = navigation.from?.url;
	const to = navigation.to?.url;
	if (!from || !to || from.pathname === to.pathname) return;
	if (navigation.type === 'popstate') return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const root = document.documentElement;
	// The admin only crossfades (see layout.css).
	root.dataset.vt = to.pathname === '/admin' || to.pathname.startsWith('/admin/') ? 'admin' : 'site';

	clearNames();
	const destination = to.pathname;
	const keys = nameElements((el) => {
		const link = el.closest('a[href]');
		return link ? pathOf(link) === destination : true;
	});
	const state: Pending = { keys, arrived: false, transition: null };
	pending = state;

	const finish = () => {
		if (pending === state) {
			pending = null;
			clearNames();
			delete root.dataset.vt;
		}
	};

	return new Promise<void>((resolve) => {
		const transition = document.startViewTransition(async () => {
			resolve();
			await navigation.complete;
			nameArrivals();
		});
		state.transition = transition;
		transition.ready.catch(ignore);
		transition.updateCallbackDone.catch(ignore);
		transition.finished.then(finish, finish);
	});
}
