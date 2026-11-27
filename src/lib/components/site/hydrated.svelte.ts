import { tick, untrack } from 'svelte';

/**
 * Whether this component has mounted in the browser: false in the server render and while the
 * page hydrates, true right after. Controls that need JavaScript (the phone menu's Sheet, the
 * blog's category pills, the post's table of contents) render a plain HTML stand-in until then,
 * so they work before the app has loaded and without JavaScript at all.
 *
 *     const hydrated = useHydrated();
 *     {#if hydrated.current}<Sheet.Root …>{:else}<a href="#footer-nav">…</a>{/if}
 *
 * `before` runs just before the swap, while the stand-in is still on the page, to carry its
 * state over to the real control: whether it was open, and where focus was (see
 * `focusedIndex` and `refocus`). It runs untracked, so reading a `bind:this` ref in it doesn't
 * make the swap run again when that ref clears.
 *
 * Call it while the component initialises.
 */
export function useHydrated(before?: () => void): { readonly current: boolean } {
	let current = $state(false);
	$effect(() => {
		if (before) untrack(before);
		current = true;
	});
	return {
		get current() {
			return current;
		}
	};
}

const FOCUSABLE = 'a[href], button, summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';

function focusables(el: Element): HTMLElement[] {
	return [el, ...el.querySelectorAll(FOCUSABLE)].filter(
		(item): item is HTMLElement => item instanceof HTMLElement && item.matches(FOCUSABLE)
	);
}

/** Which focusable element in `el` (counting `el` itself) has focus, or -1 when none does. */
export function focusedIndex(el: Element | null | undefined): number {
	const active = document.activeElement;
	if (!el || !active || !el.contains(active)) return -1;
	return focusables(el).indexOf(active as HTMLElement);
}

/**
 * Once the swap has rendered, focus the focusable element at `index` in `el()`, so a keyboard
 * or screen reader user keeps their place instead of landing on <body>. Does nothing for -1.
 */
export function refocus(index: number, el: () => Element | null | undefined): void {
	if (index < 0) return;
	void tick().then(() => {
		const root = el();
		if (root) focusables(root)[index]?.focus();
	});
}
