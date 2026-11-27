<!--
	Thin bar at the top of the admin content area with the menu button. Always shown below
	768px (where the sidebar is a sheet); on wider screens only while the sidebar is collapsed
	(Ctrl/Cmd+B), so it can always be brought back. Must sit inside Sidebar.Provider.
-->
<script lang="ts">
	import MenuIcon from '@lucide/svelte/icons/menu';
	import { useSidebar } from '#lib/components/ui/sidebar/index.js';
	import AdminButton from './AdminButton.svelte';
	import BrandMark from './BrandMark.svelte';

	const sidebar = useSidebar();
	const collapsed = $derived(sidebar.state === 'collapsed');
</script>

<div
	class={[
		'sticky top-0 z-20 h-14 items-center gap-2 border-b border-line bg-surface-000/95 px-2 backdrop-blur-sm sm:px-4',
		collapsed ? 'flex' : 'flex md:hidden'
	]}
>
	<AdminButton
		variant="ghost"
		size="icon"
		aria-label={sidebar.isMobile ? 'Open menu' : 'Show sidebar'}
		aria-expanded={sidebar.isMobile ? sidebar.openMobile : !collapsed}
		onclick={() => sidebar.toggle()}
	>
		<MenuIcon aria-hidden="true" />
	</AdminButton>
	<BrandMark href="/admin" size="sm" sublabel="" />
</div>
