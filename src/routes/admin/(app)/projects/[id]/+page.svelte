<script lang="ts">
	import ProjectEditor from '#lib/components/admin/projects/ProjectEditor.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

{#key data.id}
	<ProjectEditor
		mode="edit"
		id={data.id}
		project={data.project}
		saved={data.saved}
		updatedAt={data.updatedAt}
		takenSlugs={data.takenSlugs}
		featuredOther={data.featuredOther}
		linkedPosts={data.linkedPosts}
		now={data.now}
	/>
{/key}
