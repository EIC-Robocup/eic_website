<script lang="ts">
	import PostEditor from '#lib/components/admin/posts/PostEditor.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<PostEditor {data} />
