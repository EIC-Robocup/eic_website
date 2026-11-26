<!--
	The public site frame: skip link, sticky Nav, <main id="main"> and the Footer.
	Used by the (site) layout and by the root error page.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SectionData } from '#lib/content/sections.ts';
	import Footer from './Footer.svelte';
	import Nav from './Nav.svelte';

	type Props = {
		cta?: SectionData<'site', 'nav'>['cta'];
		footer: SectionData<'site', 'footer'>;
		children: Snippet;
	};
	let { cta, footer, children }: Props = $props();
</script>

<a
	href="#main"
	class="fixed top-2 left-2 z-50 inline-flex min-h-11 -translate-y-[200%] items-center rounded-sm bg-ink px-4 text-[15px] font-medium text-ink-on-light no-underline transition-transform duration-150 focus:translate-y-0"
	>Skip to content</a
>
<div class="flex min-h-dvh flex-col">
	<Nav {cta} />
	<main id="main" tabindex="-1" class="flex-1 focus:outline-none">
		{@render children()}
	</main>
	<Footer data={footer} />
</div>
