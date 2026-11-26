<!-- TEMPORARY test page for PostBody (rich-markdown engineer). Delete after testing. -->
<script lang="ts">
	import PostBody from '#lib/components/site/PostBody.svelte';
	import ImageField from '#lib/components/admin/ImageField.svelte';
	import MarkdownHelp from '#lib/components/admin/MarkdownHelp.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { page } from '$app/state';
	const { data } = $props();
	let url = $state('');
	let alt = $state('');
	const view = $derived(page.url.searchParams.get('view') ?? 'post');
</script>

{#if view === 'help'}
	<Toaster />
	<div class="mx-auto max-w-md p-4"><MarkdownHelp oninsert={(t) => console.log('insert', t)} /></div>
{:else if view === 'upload'}
	<Toaster />
	<div class="mx-auto flex max-w-md flex-col gap-4 p-4">
		<ImageField folder="posts" label="Cover image" name="cover" bind:url bind:alt qualityOption />
		<p id="result">{url}</p>
	</div>
{:else}
	<header class="site-container pt-16 pb-10">
		<span class="text-label text-brand-text">Engineering</span>
		<h1 class="mt-4 font-display text-5xl font-semibold">How Walkie picks up a can</h1>
		<p class="mt-2 text-sm text-ink-muted">{data.readingMinutes} min read · {data.words} words</p>
	</header>
	<div class="site-container pb-24"><PostBody html={data.html} /></div>
{/if}
