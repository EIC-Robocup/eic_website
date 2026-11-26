<script lang="ts">
	import './layout.css';
	import type { LayoutProps } from './$types';

	const { children }: LayoutProps = $props();
</script>

{@render children()}
