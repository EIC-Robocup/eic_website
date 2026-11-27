<!--
	Errors inside the admin panel (a stale /admin/posts/<id>, an unknown page key, a database
	that does not answer). Renders inside the admin shell, so the sidebar stays: plain admin
	styling, no drafting hero, graph paper or notes. Errors outside this layout (the sign in
	page, an unknown /admin/... URL) still reach src/routes/+error.svelte.
-->
<script lang="ts">
	import { page } from '$app/state';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Panel from '#lib/components/admin/Panel.svelte';
	import { ADMIN_NAV, isActiveAdminPath } from '#lib/components/admin/nav.ts';

	const status = $derived(page.status);
	const notFound = $derived(status === 404);

	// Kit's own messages ("Not Found", "Internal Error") say less than ours; admin loads
	// throw specific ones ("This post does not exist. It may have been deleted.").
	const GENERIC = new Set(['Not Found', 'Internal Error', 'Error']);
	const message = $derived(page.error?.message?.trim() ?? '');
	const line = $derived.by(() => {
		if (message && !GENERIC.has(message) && status < 500) return message;
		if (notFound) return 'The link may be old, or the item was deleted.';
		if (status >= 500) return 'We could not load this page. Try again in a moment.';
		return 'We could not load this page.';
	});

	/** The section the broken link belongs to, e.g. Posts for /admin/posts/<id>. */
	const section = $derived(
		ADMIN_NAV.flatMap((group) => group.links).find(
			(link) => link.href !== '/admin' && isActiveAdminPath(page.url.pathname, link.href) && page.url.pathname !== link.href
		)
	);
</script>

<PageHeader
	breadcrumb={[{ label: `Error ${status}` }]}
	title={notFound ? 'Page not found' : 'Something went wrong'}
	documentTitle={notFound ? 'Page not found' : 'Error'}
/>

<Panel>
	<div class="flex flex-col gap-5">
		<p class="m-0 max-w-[60ch] text-[15px] leading-6 text-ink">{line}</p>
		<div class="flex flex-wrap gap-2.5">
			{#if section}
				<AdminButton href={section.href}>Back to {section.label}</AdminButton>
				<AdminButton variant="outline" href="/admin">Dashboard</AdminButton>
			{:else}
				<AdminButton href="/admin">Back to the dashboard</AdminButton>
			{/if}
			{#if status >= 500}
				<AdminButton variant="outline" onclick={() => location.reload()}>Try again</AdminButton>
			{/if}
		</div>
	</div>
</Panel>
