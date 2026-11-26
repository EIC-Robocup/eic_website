<script lang="ts">
	import './layout.css';
	import { onNavigate } from '$app/navigation';
	import { pageTransition } from '#lib/motion/view-transitions.ts';
	import type { LayoutProps } from './$types';

	const { children }: LayoutProps = $props();

	// Every client-side navigation to another page crossfades with the View Transitions API
	// (skipped for back/forward, filters and reduced motion). See view-transitions.ts.
	onNavigate(pageTransition);
</script>

{@render children()}
