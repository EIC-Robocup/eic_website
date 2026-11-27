<script lang="ts">
	import ProjectEditor from '#lib/components/admin/projects/ProjectEditor.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<ProjectEditor mode="create" project={data.project} takenSlugs={data.takenSlugs} featuredOther={data.featuredOther} />
