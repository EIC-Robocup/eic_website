<script lang="ts">
	import { page } from '$app/state';
	import { pages } from '#lib/content/sections.ts';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import AuthCard from '#lib/components/admin/AuthCard.svelte';
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

	/*
	 * Admin errors that reach this page (the sign in page and sign out) get the sign in page's
	 * card, not the public drafting hero: the admin has no notes or title blocks. Errors inside
	 * the panel, unknown /admin/... URLs too, render in its shell (admin/(app)/+error.svelte).
	 */
	const status = $derived(page.status);
	const notFound = $derived(status === 404);
	const adminLine = $derived(
		notFound
			? 'The link may be old, or the page has moved. Start again from the dashboard.'
			: status >= 500
				? 'We could not load this page. Try again in a moment.'
				: (page.error?.message ?? 'We could not load this page.')
	);
</script>

<svelte:head>
	{#if isAdmin}
		<title>{notFound ? 'Page not found' : 'Error'} · EIC Admin</title>
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

{#if isAdmin}
	<AuthCard title={notFound ? 'Page not found' : 'Something went wrong'} description={adminLine}>
		<div class="flex flex-wrap gap-2.5">
			<AdminButton href="/admin">Back to the dashboard</AdminButton>
			{#if status >= 500}
				<AdminButton variant="outline" onclick={() => location.reload()}>Try again</AdminButton>
			{/if}
		</div>
		{#snippet footer()}Error {status}{/snippet}
	</AuthCard>
{:else}
	<SiteShell {cta} {footer}>
		<ErrorView />
	</SiteShell>
{/if}
