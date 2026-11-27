<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import AdminSidebar from '#lib/components/admin/AdminSidebar.svelte';
	import AdminTopBar from '#lib/components/admin/AdminTopBar.svelte';
	import type { LayoutProps } from './$types';

	const { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<a
	href="#admin-main"
	class="sr-only z-50 rounded-sm bg-ink px-3 py-2 text-sm font-medium text-ink-on-light focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
>
	Skip to content
</a>

<Sidebar.Provider>
	<AdminSidebar editor={data.editor} counts={data.counts} pageCount={data.pageCount} />
	<Sidebar.Inset id="admin-main" tabindex={-1} class="min-w-0 bg-surface-100 outline-none">
		<AdminTopBar />
		<div class="mx-auto flex w-full max-w-[1272px] min-w-0 flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 md:px-9 md:pt-7">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<Toaster position="bottom-right" closeButton />
