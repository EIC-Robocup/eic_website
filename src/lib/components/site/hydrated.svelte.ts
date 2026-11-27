/**
 * Whether this component has mounted in the browser: false in the server render and while the
 * page hydrates, true right after. Controls that need JavaScript (the phone menu's Sheet, the
 * blog's category pills, the post's table of contents) render a plain HTML stand-in until then,
 * so they work before the app has loaded and without JavaScript at all.
 *
 *     const hydrated = useHydrated();
 *     {#if hydrated.current}<Sheet.Root …>{:else}<a href="#footer-nav">…</a>{/if}
 *
 * Call it while the component initialises.
 */
export function useHydrated(): { readonly current: boolean } {
	let current = $state(false);
	$effect(() => {
		current = true;
	});
	return {
		get current() {
			return current;
		}
	};
}
