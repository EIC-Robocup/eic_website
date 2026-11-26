<script lang="ts">
	import SiteShell from '#lib/components/site/SiteShell.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import type { LayoutProps } from './$types';

	const { data, children }: LayoutProps = $props();
</script>

<SiteShell cta={data.site.nav.data.cta} footer={data.site.footer.data}>
	{@render children()}
</SiteShell>

<!-- Short confirmations such as "Link copied" on the post page. -->
<Toaster position="bottom-center" />
