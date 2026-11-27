<script lang="ts">
	import { onDestroy } from 'svelte';
	import { refreshAll } from '$app/navigation';
	import ImagesIcon from '@lucide/svelte/icons/images';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Panel from '#lib/components/admin/Panel.svelte';
	import MediaCard from '#lib/components/admin/media/MediaCard.svelte';
	import MediaDetails from '#lib/components/admin/media/MediaDetails.svelte';
	import { KIND_FILTERS, mediaKind, type MediaFile, type MediaKind } from '#lib/components/admin/media/media.ts';
	import { UploadQueue } from '#lib/components/admin/media/uploads.svelte.ts';
	import { acceptAttribute, formatBytes } from '#lib/components/admin/upload.ts';
	import { hintClass } from '#lib/components/admin/styles.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	type Filter = 'all' | Exclude<MediaKind, 'other'>;
	const PAGE_SIZE = 60;

	/* Filters */
	let kind = $state<Filter>('all');
	let query = $state('');
	let shown = $state(PAGE_SIZE);

	const kinds = $derived(new Map(data.files.map((f) => [f.id, mediaKind(f)])));
	const counts = $derived.by(() => {
		const out: Record<Filter, number> = { all: data.files.length, image: 0, video: 0, pdf: 0, model: 0 };
		for (const k of kinds.values()) if (k !== 'other') out[k]++;
		return out;
	});
	const filters = $derived<{ value: Filter; label: string }[]>([
		{ value: 'all', label: 'All' },
		...KIND_FILTERS.filter((k) => counts[k.value] > 0 || kind === k.value)
	]);
	const needle = $derived(query.trim().toLowerCase());
	const visible = $derived(
		data.files.filter(
			(f) =>
				(kind === 'all' || kinds.get(f.id) === kind) &&
				(!needle || f.filename.toLowerCase().includes(needle) || f.alt.toLowerCase().includes(needle))
		)
	);

	function setKind(value: string) {
		kind = (KIND_FILTERS.some((k) => k.value === value) ? value : 'all') as Filter;
		shown = PAGE_SIZE;
	}
	function clearFilters() {
		kind = 'all';
		query = '';
		shown = PAGE_SIZE;
	}

	/* Uploads: the button, a drop anywhere on the page, or a paste. */
	let keepOriginal = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	const queue = new UploadQueue({ folder: 'media', onUploaded: () => refreshAll() });
	onDestroy(() => queue.destroy());

	function upload(files: File[]) {
		if (!files.length) return;
		if (queue.add(files, { keepOriginal })) {
			// Show the new files at the top, whatever the filter.
			if (kind !== 'all' || needle) clearFilters();
		}
	}

	function onfilechange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		upload(files);
	}

	let dragDepth = $state(0);
	const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
	function ondragenter(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		dragDepth++;
	}
	function ondragover(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}
	function ondragleave(event: DragEvent) {
		if (!hasFiles(event)) return;
		dragDepth = Math.max(0, dragDepth - 1);
	}
	function ondrop(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		dragDepth = 0;
		upload(Array.from(event.dataTransfer?.files ?? []));
	}
	function onpaste(event: ClipboardEvent) {
		const files = Array.from(event.clipboardData?.files ?? []);
		if (!files.length) return;
		event.preventDefault();
		upload(files);
	}

	/* Details sheet. A snapshot keeps it filled while it closes after a delete. */
	let sheetOpen = $state(false);
	let currentId = $state<string | null>(null);
	let snapshot = $state<MediaFile | null>(null);
	const current = $derived(data.files.find((f) => f.id === currentId) ?? snapshot);

	function openFile(file: MediaFile) {
		currentId = file.id;
		snapshot = file;
		sheetOpen = true;
	}

	function returnFocus(event: Event) {
		event.preventDefault();
		const id = currentId;
		const target = id ? document.querySelector<HTMLElement>(`[data-media-open="${id}"]`) : null;
		(target ?? document.querySelector<HTMLElement>('[data-upload-button]'))?.focus();
	}
</script>

<svelte:window {ondragenter} {ondragover} {ondragleave} {ondrop} {onpaste} />

<PageHeader
	breadcrumb={[{ label: 'Library' }, { label: 'Media' }]}
	title="Media"
	description="Every file uploaded in the admin. Copy a link or the Markdown to use one in a post."
>
	{#snippet actions()}
		<AdminButton data-upload-button onclick={() => fileInput?.click()}>
			<UploadIcon aria-hidden="true" />Upload files
		</AdminButton>
	{/snippet}
</PageHeader>

{#if !data.storageReady}
	<Panel padding="sm" class="border-brand/45">
		<p class="m-0 text-sm leading-[22px] text-ink">
			Uploads are not set up yet. Add <code class="font-mono text-[13px]">SUPABASE_URL</code> and
			<code class="font-mono text-[13px]">SUPABASE_SECRET_KEY</code> to the environment, as the setup guide describes.
		</p>
	</Panel>
{/if}

{#if data.files.length || queue.busy}
<div
	class={[
		'drop-zone flex flex-col items-center justify-center gap-2 bg-surface-200/40 px-4 py-6 text-center text-[13px] text-ink-muted',
		dragDepth > 0 && 'border-ink bg-surface-300/40'
	]}
>
	<UploadIcon class="size-6 text-line-strong" strokeWidth={1.5} aria-hidden="true" />
	<p class="m-0">
		Drop files anywhere on this page, paste them, or
		<button
			type="button"
			class="inline-flex min-h-6 items-center font-medium text-brand-text underline-offset-4 hover:text-ink hover:underline"
			onclick={() => fileInput?.click()}>choose files</button
		>.
	</p>
	<p class={['m-0', hintClass]}>
		Images up to 10 MB (resized to 2400px and saved as WebP), PDFs up to 20 MB, MP4 or WebM videos up to 50 MB,
		GLB or glTF models up to 25 MB. No SVG.
	</p>
	<label class="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-ink-muted">
		<Checkbox bind:checked={keepOriginal} aria-describedby="keep-original-hint" />
		<span>Keep original quality</span>
		<span id="keep-original-hint" class="sr-only">Uploads images as they are, without resizing or converting to WebP.</span>
	</label>
</div>
{/if}

<input
	bind:this={fileInput}
	type="file"
	multiple
	class="hidden"
	accept={acceptAttribute()}
	tabindex="-1"
	aria-hidden="true"
	onchange={onfilechange}
/>

{#if data.files.length || queue.busy}
	<div class="flex flex-wrap items-center justify-between gap-3">
		<ToggleGroup.Root
			type="single"
			value={kind}
			onValueChange={setKind}
			aria-label="Filter by type"
			class="flex-wrap gap-1 rounded-[8px] border border-line bg-surface-000 p-1"
		>
			{#each filters as item (item.value)}
				<ToggleGroup.Item
					value={item.value}
					class="h-9 rounded-sm px-3.5 text-sm font-medium text-ink-muted hover:bg-transparent hover:text-ink data-[state=on]:bg-surface-300 data-[state=on]:text-ink"
				>
					{item.label}
					<span class="font-mono text-xs">{counts[item.value]}</span>
				</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
		<InputGroup.Root class="h-11 w-full rounded-sm border-line-strong bg-surface-100 shadow-none sm:w-[280px] dark:bg-surface-100">
			<InputGroup.Addon class="pl-3">
				<SearchIcon class="size-4 text-ink-muted" aria-hidden="true" />
			</InputGroup.Addon>
			<InputGroup.Input
				type="search"
				bind:value={query}
				oninput={() => (shown = PAGE_SIZE)}
				placeholder="Search by file name"
				aria-label="Search files by name or alt text"
				class="h-full"
			/>
		</InputGroup.Root>
	</div>

	{#if visible.length || queue.busy}
		<ul class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-4">
			{#each queue.items as item (item.id)}
				<li class="flex min-w-0 flex-col overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface-200" role="status">
					<span class="relative block aspect-[4/3] overflow-hidden border-b border-line bg-surface-100">
						{#if item.preview}
							<img src={item.preview} alt="" class="size-full object-cover opacity-40" />
						{/if}
						<span class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-xs text-ink">
							{item.status === 'waiting' ? 'Waiting' : item.status === 'saving' ? 'Saving' : `Uploading ${item.progress}%`}
							<Progress
								value={item.progress}
								max={100}
								class="h-1 w-full max-w-32 bg-surface-300 [&>[data-slot=progress-indicator]]:bg-brand"
								aria-label="Upload progress for {item.filename}"
							/>
						</span>
					</span>
					<span class="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-[13px] leading-5 font-medium">{item.filename}</span>
							<span class="font-mono text-[11px] text-ink-muted">{formatBytes(item.size)}</span>
						</span>
						<AdminButton variant="ghost" size="sm" class="h-11" onclick={() => queue.cancel(item.id)} aria-label="Cancel uploading {item.filename}">
							Cancel
						</AdminButton>
					</span>
				</li>
			{/each}
			{#each visible.slice(0, shown) as file (file.id)}
				<li class="min-w-0">
					<MediaCard {file} onopen={openFile} />
				</li>
			{/each}
		</ul>
		<div class="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted">
			<span role="status">
				Showing {Math.min(shown, visible.length)} of {visible.length}{visible.length !== data.files.length ? ` (${data.files.length} in all)` : ''}
				{#if data.total > data.files.length}· the newest {data.limit} of {data.total} files{/if}
			</span>
			{#if visible.length > shown}
				<AdminButton variant="outline" size="sm" onclick={() => (shown += PAGE_SIZE)}>Show more</AdminButton>
			{/if}
		</div>
	{:else}
		<EmptyState icon={SearchXIcon} title="No files match" description="Try another name, or show every type.">
			{#snippet actions()}
				<AdminButton variant="outline" onclick={clearFilters}>Clear filters</AdminButton>
			{/snippet}
		</EmptyState>
	{/if}
{:else}
	<EmptyState
		icon={ImagesIcon}
		title="No files yet"
		description="Drop photos, PDFs, videos and 3D models anywhere on this page, paste them, or choose them. Files uploaded with the image fields in posts, projects and pages show up here too."
	>
		{#snippet actions()}
			<AdminButton variant="outline" onclick={() => fileInput?.click()}>Choose files</AdminButton>
		{/snippet}
	</EmptyState>
{/if}

{#if dragDepth > 0}
	<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-surface-000/80 p-6" aria-hidden="true">
		<div class="drop-zone flex flex-col items-center gap-2 border-ink bg-surface-200 px-10 py-8 text-center">
			<UploadIcon class="size-8 text-ink" strokeWidth={1.5} />
			<span class="font-display text-lg font-semibold text-ink">Drop to upload</span>
			<span class="text-[13px] text-ink-muted">Files go into the Media library.</span>
		</div>
	</div>
{/if}

<Sheet.Root bind:open={sheetOpen}>
	<Sheet.Content
		side="right"
		class="w-full gap-0 overflow-y-auto border-line bg-surface-200 p-0 data-[side=right]:w-full sm:data-[side=right]:max-w-lg"
		onCloseAutoFocus={returnFocus}
	>
		{#if current}
			{#key current.id}
				<MediaDetails file={current} ondeleted={() => (sheetOpen = false)} />
			{/key}
		{/if}
	</Sheet.Content>
</Sheet.Root>
