<script lang="ts">
	import { page } from '$app/state';
	import { pages } from '#lib/content/sections.ts';
	import ErrorView from '#lib/components/site/ErrorView.svelte';
	import SiteShell from '#lib/components/site/SiteShell.svelte';

	// Errors outside the (site) layout (unknown URLs, admin errors). Inside the site layout,
	// src/routes/(site)/+error.svelte renders instead, with the saved nav and footer.
	type SiteData = {
		nav: { data: (typeof pages.site.sections.nav)['defaults'] };
		footer: { data: (typeof pages.site.sections.footer)['defaults'] };
	};
	const site = $derived((page.data as { site?: SiteData }).site);
	const cta = $derived(site?.nav.data.cta ?? pages.site.sections.nav.defaults.cta);
	const footer = $derived(site?.footer.data ?? pages.site.sections.footer.defaults);
	const isAdmin = $derived(
		page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/')
	);
</script>

{#if isAdmin}
	<main id="main" class="min-h-dvh">
		<ErrorView />
	</main>
{:else}
	<SiteShell {cta} {footer}>
		<ErrorView />
	</SiteShell>
{/if}
