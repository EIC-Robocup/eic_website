<script lang="ts">
	import SiteShell from '#lib/components/site/SiteShell.svelte';
	import type { LayoutProps } from './$types';

	const { data, children }: LayoutProps = $props();
</script>

<SiteShell cta={data.site.nav.data.cta} footer={data.site.footer.data}>
	{@render children()}
</SiteShell>

<!-- No Toaster here: the few site toasts ("Link copied") mount one on demand (notify.ts). -->
