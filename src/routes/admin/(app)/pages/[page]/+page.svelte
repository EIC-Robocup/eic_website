<script lang="ts">
	import PageEditor from './PageEditor.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<!-- A fresh editor (and fresh drafts) for each page. -->
{#key data.page}
	<PageEditor {data} />
{/key}
