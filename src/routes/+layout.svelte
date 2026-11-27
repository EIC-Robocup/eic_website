<script lang="ts">
	import './layout.css';
	// The same files layout.css loads through Fontsource (one hashed asset each, never fetched
	// twice). Preloaded so the headings and body text don't wait for the stylesheet to parse.
	import spaceGrotesk from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url';
	import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
	import { onNavigate } from '$app/navigation';
	import { pageTransition } from '#lib/motion/view-transitions.ts';
	import type { LayoutProps } from './$types';

	const { children }: LayoutProps = $props();

	// Every client-side navigation to another page crossfades with the View Transitions API
	// (skipped for back/forward, filters and reduced motion). See view-transitions.ts.
	onNavigate(pageTransition);
</script>

<svelte:head>
	<link rel="preload" as="font" type="font/woff2" href={spaceGrotesk} crossorigin="anonymous" />
	<link rel="preload" as="font" type="font/woff2" href={inter} crossorigin="anonymous" />
</svelte:head>

{@render children()}
