<!--
	The project gallery: photos, and captioned empty slots (the site shows a crop marked
	placeholder for those), in a grid. Each has alt text and a caption, Move earlier / later
	buttons and a Remove button. "Add photos" uploads several files at once (pick them, drop
	them on the gallery, or paste them), three at a time, through uploadFile(); "Paste links"
	adds images by URL; "Add empty slot" adds a placeholder. An empty slot takes a file too.

	Submits the rows as JSON in a hidden `name` field. Errors are keyed like the validator's:
	`gallery.2.alt`, `gallery.2.url`, `gallery.2.caption`.

	<GalleryEditor bind:items={draft.gallery} name="gallery" folder="projects" {errors} bind:uploading />
-->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { optimizedSrc } from '#lib/image.ts';
	import type { GalleryImage } from '#lib/server/db/schema.ts';
	import AdminButton from '../AdminButton.svelte';
	import { isSafeUrl } from '../form-data.ts';
	import { hintClass, inputClass, labelClass, textareaClass } from '../styles.ts';
	import {
		IMAGE_TYPES,
		acceptAttribute,
		checkFile,
		formatBytes,
		uploadFile,
		type UploadFolder
	} from '../upload.ts';
	import { LIMITS } from './project-form.ts';

	type Props = {
		/** The rows. Bindable; pass $state. */
		items: GalleryImage[];
		/** Hidden JSON field name. */
		name?: string;
		folder?: UploadFolder;
		errors?: Record<string, string>;
		/** Error key prefix, e.g. "gallery" for `gallery.2.alt`. */
		errorKey?: string;
		/** True while any file uploads. Bindable, to hold Save. */
		uploading?: boolean;
		max?: number;
		disabled?: boolean;
	};

	let {
		items = $bindable(),
		name,
		folder = 'projects',
		errors = {},
		errorKey = 'gallery',
		uploading = $bindable(false),
		max = LIMITS.gallery,
		disabled = false
	}: Props = $props();

	const uid = $props.id();

	type Upload = {
		filename: string;
		progress: number;
		preview: string;
		waiting: boolean;
		controller: AbortController;
		/** Added by this upload (removed again if it fails), as opposed to filling a slot. */
		isNew: boolean;
	};
	const uploads = new SvelteMap<GalleryImage, Upload>();

	let list: HTMLElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let linksInput: HTMLTextAreaElement | null = $state(null);
	let dragging = $state(false);
	let linksOpen = $state(false);
	let linksDraft = $state('');
	let announcement = $state('');
	/** The slot a picked file goes into; null adds new photos. */
	let target: GalleryImage | null = null;

	$effect(() => {
		uploading = uploads.size > 0;
	});

	// Stable keys, so moving a tile moves its DOM (and focus) with it.
	const keys = new WeakMap<object, number>();
	let nextKey = 0;
	function keyOf(item: GalleryImage): number {
		let key = keys.get(item);
		if (key === undefined) {
			key = nextKey++;
			keys.set(item, key);
		}
		return key;
	}

	const room = $derived(Math.max(0, max - items.length));
	const pad = (n: number) => String(n).padStart(2, '0');
	const err = (i: number, field?: string) => errors[field ? `${errorKey}.${i}.${field}` : `${errorKey}.${i}`];

	/* ---------------------------------------------------------------------------------------- */
	/* Uploads: a small queue, three at a time                                                   */
	/* ---------------------------------------------------------------------------------------- */

	const CONCURRENCY = 3;
	const queue: { item: GalleryImage; file: File }[] = [];
	let active = 0;
	let batch = { ok: 0, before: 0, after: 0 };

	function pump() {
		while (active < CONCURRENCY && queue.length) {
			const next = queue.shift()!;
			active++;
			void run(next.item, next.file).finally(() => {
				active--;
				pump();
				if (active === 0 && queue.length === 0) finishBatch();
			});
		}
	}

	function finishBatch() {
		const { ok, before, after } = batch;
		batch = { ok: 0, before: 0, after: 0 };
		if (!ok) return;
		const saved = after < before ? `Compressed ${formatBytes(before)} → ${formatBytes(after)}.` : undefined;
		toast.success(ok === 1 ? 'Photo uploaded.' : `${ok} photos uploaded.`, saved ? { description: saved } : undefined);
		announcement = `${ok === 1 ? 'Photo' : `${ok} photos`} uploaded. Add alt text to each.`;
	}

	function enqueue(item: GalleryImage, file: File, isNew: boolean) {
		uploads.set(item, {
			filename: file.name,
			progress: 0,
			preview: URL.createObjectURL(file),
			waiting: true,
			controller: new AbortController(),
			isNew
		});
		queue.push({ item, file });
		pump();
	}

	function patch(item: GalleryImage, change: Partial<Upload>) {
		const current = uploads.get(item);
		if (current) uploads.set(item, { ...current, ...change });
	}

	async function run(item: GalleryImage, file: File) {
		const state = uploads.get(item);
		if (!state || state.controller.signal.aborted) return;
		patch(item, { waiting: false });
		try {
			const media = await uploadFile(file, {
				folder,
				alt: item.alt,
				signal: state.controller.signal,
				onProgress: (fraction) => patch(item, { progress: Math.round(fraction * 100) })
			});
			item.url = media.url;
			batch.ok++;
			batch.before += media.originalSize;
			batch.after += media.size;
		} catch (error) {
			const cancelled = error instanceof DOMException && error.name === 'AbortError';
			if (!cancelled) toast.error(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed.'}`);
			if (state.isNew) removeItem(item);
		} finally {
			URL.revokeObjectURL(state.preview);
			uploads.delete(item);
		}
	}

	function cancel(item: GalleryImage) {
		const state = uploads.get(item);
		if (!state) return;
		state.controller.abort();
		const waiting = queue.findIndex((q) => q.item === item);
		if (waiting !== -1) {
			// Not started yet: settle it here.
			queue.splice(waiting, 1);
			URL.revokeObjectURL(state.preview);
			uploads.delete(item);
			if (state.isNew) removeItem(item);
		}
		toast('Upload cancelled.');
	}

	onDestroy(() => {
		for (const state of uploads.values()) state.controller.abort();
		queue.length = 0;
	});

	/** Add new photos for these files (as many as there is room for). */
	function addFiles(files: File[]) {
		if (disabled) return;
		const usable: File[] = [];
		for (const file of files) {
			const problem = checkFile(file, IMAGE_TYPES);
			if (problem) toast.error(`${file.name}: ${problem}`);
			else usable.push(file);
		}
		if (!usable.length) return;
		if (usable.length > room) {
			toast.error(
				room
					? `The gallery holds ${max} photos. Adding the first ${room}.`
					: `The gallery is full (${max} photos). Remove one first.`
			);
		}
		const take = usable.slice(0, room);
		for (const file of take) {
			items.push({ url: '', alt: '', caption: '' });
			enqueue(items[items.length - 1], file, true);
		}
		if (take.length) announcement = `Uploading ${take.length === 1 ? 'one photo' : `${take.length} photos`}.`;
	}

	/** Put a file into an existing slot (an empty one, or replace a photo). */
	function fillSlot(item: GalleryImage, file: File) {
		if (disabled || uploads.has(item)) return;
		const problem = checkFile(file, IMAGE_TYPES);
		if (problem) {
			toast.error(problem);
			return;
		}
		enqueue(item, file, false);
	}

	function pick(slot: GalleryImage | null) {
		if (disabled) return;
		target = slot;
		if (fileInput) {
			fileInput.multiple = slot === null;
			fileInput.click();
		}
	}

	function onfilechange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (!files.length) return;
		if (target) fillSlot(target, files[0]);
		else addFiles(files);
		target = null;
	}

	const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

	function ondragover(event: DragEvent) {
		if (disabled || !hasFiles(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		dragging = true;
	}

	function ondragleave(event: DragEvent) {
		const to = event.relatedTarget as Node | null;
		if (!to || !(event.currentTarget as HTMLElement).contains(to)) dragging = false;
	}

	function ondrop(event: DragEvent) {
		if (disabled || !hasFiles(event)) return;
		event.preventDefault();
		dragging = false;
		const files = Array.from(event.dataTransfer?.files ?? []);
		// Dropped on an empty slot: fill it with the first file, add the rest.
		const slotEl = (event.target as HTMLElement).closest<HTMLElement>('[data-empty-slot]');
		const index = slotEl ? Number(slotEl.dataset.emptySlot) : -1;
		const slot = index >= 0 ? items[index] : undefined;
		if (slot && !slot.url && files.length) {
			fillSlot(slot, files[0]);
			addFiles(files.slice(1));
		} else addFiles(files);
	}

	function onpaste(event: ClipboardEvent) {
		const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
		if (!files.length || disabled) return;
		event.preventDefault();
		addFiles(files);
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Links, empty slots, moving and removing                                                   */
	/* ---------------------------------------------------------------------------------------- */

	async function openLinks() {
		linksOpen = true;
		await tick();
		linksInput?.focus();
	}

	function addLinks() {
		const lines = linksDraft
			.split(/[\s,]+/)
			.map((l) => l.trim())
			.filter(Boolean);
		if (!lines.length) {
			linksOpen = false;
			return;
		}
		const bad = lines.filter((l) => !isSafeUrl(l) || l.length > LIMITS.url);
		if (bad.length) {
			toast.error(
				bad.length === 1
					? `This is not a link we can use: ${bad[0].slice(0, 80)}. Use https:// or a site path such as /images/...`
					: `${bad.length} of these are not links we can use. Use https:// or a site path such as /images/...`
			);
			linksInput?.focus();
			return;
		}
		const take = lines.slice(0, room);
		if (take.length < lines.length) toast.error(`The gallery holds ${max} photos. Added the first ${take.length}.`);
		for (const url of take) items.push({ url, alt: '', caption: '' });
		announcement = `Added ${take.length === 1 ? 'one photo' : `${take.length} photos`}. Add alt text to each.`;
		linksDraft = '';
		linksOpen = false;
	}

	function onlinkskeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			addLinks();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			linksOpen = false;
		}
	}

	async function addSlot() {
		if (!room) return;
		items.push({ url: '', alt: '', caption: '' });
		announcement = `Added empty slot ${items.length}.`;
		await tick();
		list?.querySelector<HTMLElement>('[data-gallery-row]:last-child [data-caption]')?.focus();
	}

	function removeItem(item: GalleryImage) {
		const index = items.indexOf(item);
		if (index !== -1) items.splice(index, 1);
	}

	async function remove(index: number) {
		const item = items[index];
		if (uploads.has(item)) uploads.get(item)?.controller.abort();
		items.splice(index, 1);
		announcement = `Removed photo ${index + 1}.`;
		await tick();
		const rows = list?.querySelectorAll<HTMLElement>('[data-gallery-row]');
		const next = rows?.[Math.min(index, (rows?.length ?? 1) - 1)];
		(next?.querySelector<HTMLElement>('[data-remove]') ?? list?.parentElement?.querySelector<HTMLElement>('[data-add-photos]'))?.focus();
	}

	async function move(index: number, by: -1 | 1, event: MouseEvent) {
		const to = index + by;
		if (to < 0 || to >= items.length) return;
		const [item] = items.splice(index, 1);
		items.splice(to, 0, item);
		announcement = `Moved photo to position ${to + 1}.`;
		const which = (event.currentTarget as HTMLElement).dataset.move;
		await tick();
		const moved = list?.querySelectorAll<HTMLElement>('[data-gallery-row]')[to];
		const same = moved?.querySelector<HTMLButtonElement>(`[data-move="${which}"]`);
		const other = moved?.querySelector<HTMLButtonElement>(`[data-move="${which === 'earlier' ? 'later' : 'earlier'}"]`);
		(same && !same.disabled ? same : other)?.focus();
	}
</script>

<div
	class={['flex min-w-0 flex-col gap-3 rounded-lg', dragging && 'outline-2 outline-offset-4 outline-ink outline-dashed']}
	role="group"
	aria-label="Gallery photos"
	{ondragover}
	{ondragleave}
	{ondrop}
	{onpaste}
>
	{#if items.length}
		<ol bind:this={list} class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3 p-0">
			{#each items as item, index (keyOf(item))}
				{@const upload = uploads.get(item)}
				{@const urlError = err(index, 'url')}
				{@const captionError = err(index, 'caption')}
				<li
					data-gallery-row
					class={[
						'flex min-w-0 flex-col gap-2.5 rounded-lg border bg-surface-100 p-2.5',
						urlError || err(index) ? 'border-brand-text' : 'border-line'
					]}
				>
					<div class="relative aspect-[4/3] w-full overflow-hidden rounded-[6px]">
						{#if upload}
							<img src={upload.preview} alt="" class="size-full object-cover opacity-40" />
							<div class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-ink" role="status">
								<span class="w-full truncate font-medium">{upload.filename}</span>
								<span>{upload.waiting ? 'Waiting' : upload.progress < 2 ? 'Preparing' : upload.progress < 96 ? `Uploading ${upload.progress}%` : 'Saving'}</span>
								<Progress value={upload.waiting ? 0 : upload.progress} max={100} class="h-1 w-full max-w-36 bg-surface-300 [&>[data-slot=progress-indicator]]:bg-brand" aria-label="Upload progress for {upload.filename}" />
								<AdminButton variant="outline" size="sm" class="bg-surface-100/90 dark:bg-surface-100/90" onclick={() => cancel(item)}>Cancel</AdminButton>
							</div>
						{:else if item.url}
							<img src={optimizedSrc(item.url, 480)} alt={item.alt} loading="lazy" class="size-full border border-line bg-surface-200 object-cover" />
						{:else}
							<div
								data-empty-slot={index}
								class="drop-zone flex size-full flex-col items-center justify-center gap-1.5 p-3 text-center text-xs text-ink-muted"
							>
								<span class="line-clamp-2 font-medium text-ink">{item.caption || 'Empty slot'}</span>
								<span>
									<button
										type="button"
										class="inline-flex min-h-6 items-center text-brand-text underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
										{disabled}
										onclick={() => pick(item)}>Upload</button
									> or drop a photo
								</span>
							</div>
						{/if}
						<span class="text-label absolute top-2 left-2 rounded-xs bg-surface-100/90 px-1.5 text-[11px] text-brand-text" aria-hidden="true">
							{pad(index + 1)}
						</span>
					</div>

					<div class="flex items-center gap-1">
						<AdminButton
							variant="ghost"
							size="icon"
							data-move="earlier"
							aria-label="Move photo {index + 1} earlier"
							disabled={disabled || index === 0}
							onclick={(e: MouseEvent) => move(index, -1, e)}
						>
							<ArrowLeftIcon aria-hidden="true" />
						</AdminButton>
						<AdminButton
							variant="ghost"
							size="icon"
							data-move="later"
							aria-label="Move photo {index + 1} later"
							disabled={disabled || index === items.length - 1}
							onclick={(e: MouseEvent) => move(index, 1, e)}
						>
							<ArrowRightIcon aria-hidden="true" />
						</AdminButton>
						{#if item.url && !upload}
							<AdminButton variant="ghost" size="sm" class="h-11" {disabled} onclick={() => pick(item)} aria-label="Replace photo {index + 1}">
								Replace
							</AdminButton>
						{/if}
						<AdminButton
							variant="ghost"
							size="icon"
							class="ml-auto"
							data-remove
							aria-label="Remove photo {index + 1}"
							{disabled}
							onclick={() => remove(index)}
						>
							<XIcon aria-hidden="true" />
						</AdminButton>
					</div>

					{#if urlError}
						<p class="m-0 text-xs leading-[18px] break-words text-brand-text">{urlError}</p>
					{/if}
					{#if err(index)}
						<p class="m-0 text-xs leading-[18px] text-brand-text">{err(index)}</p>
					{/if}

					{#if item.url || upload}
						{@const altError = err(index, 'alt')}
						<div class="flex flex-col gap-1">
							<label for="{uid}-alt-{index}" class={labelClass}>Alt text</label>
							<Input
								id="{uid}-alt-{index}"
								bind:value={item.alt}
								class={inputClass}
								maxlength={LIMITS.alt}
								placeholder="What the photo shows"
								aria-invalid={altError ? 'true' : undefined}
								aria-describedby={altError ? `${uid}-alt-${index}-error` : undefined}
							/>
							{#if altError}
								<p id="{uid}-alt-{index}-error" class="m-0 text-xs leading-[18px] text-brand-text">{altError}</p>
							{/if}
						</div>
					{/if}
					<div class="flex flex-col gap-1">
						<label for="{uid}-caption-{index}" class={labelClass}>
							Caption {#if item.url}<span class="font-normal text-ink-muted">Optional</span>{/if}
						</label>
						<Input
							id="{uid}-caption-{index}"
							data-caption
							bind:value={item.caption}
							class={inputClass}
							maxlength={LIMITS.caption}
							placeholder={item.url ? 'Shown under the photo' : 'e.g. Front view'}
							aria-invalid={captionError ? 'true' : undefined}
							aria-describedby={captionError ? `${uid}-caption-${index}-error` : undefined}
						/>
						{#if captionError}
							<p id="{uid}-caption-{index}-error" class="m-0 text-xs leading-[18px] text-brand-text">{captionError}</p>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	{/if}

	<div
		class={[
			'drop-zone flex flex-col items-center justify-center gap-2 px-4 py-5 text-center text-[13px] text-ink-muted transition-colors',
			dragging && 'border-ink bg-surface-300/40'
		]}
	>
		<ImagePlusIcon class="size-6 text-line-strong" strokeWidth={1.5} aria-hidden="true" />
		<span>
			<button
				type="button"
				data-add-photos
				class="inline-flex min-h-6 items-center font-medium text-brand-text underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
				disabled={disabled || !room}
				onclick={() => pick(null)}>Add photos</button
			>, drop them here or paste them. Several at once is fine.
		</span>
		<span class={hintClass}>PNG, JPEG, WebP, GIF or AVIF. Photos are resized to 2400px and saved as WebP.</span>
		<div class="flex flex-wrap justify-center gap-2 pt-1">
			{#if !linksOpen}
				<AdminButton variant="outline" size="sm" disabled={disabled || !room} onclick={openLinks}>Paste links</AdminButton>
			{/if}
			<AdminButton variant="ghost" size="sm" disabled={disabled || !room} onclick={addSlot}>+ Add empty slot</AdminButton>
		</div>
		<span class="text-xs text-ink-muted">{items.length} of {max}</span>
	</div>

	{#if linksOpen}
		<div class="flex flex-col gap-2">
			<label for="{uid}-links" class={labelClass}>Image links</label>
			<Textarea
				bind:ref={linksInput}
				bind:value={linksDraft}
				id="{uid}-links"
				rows={3}
				class={textareaClass}
				placeholder={'https://...\n/images/archive/...'}
				aria-describedby="{uid}-links-hint"
				onkeydown={onlinkskeydown}
			/>
			<span id="{uid}-links-hint" class={hintClass}>One link per line: https:// links or site paths such as /images/....</span>
			<div class="flex flex-wrap gap-2">
				<AdminButton variant="outline" size="sm" onclick={addLinks}>Add links</AdminButton>
				<AdminButton variant="ghost" size="sm" onclick={() => (linksOpen = false)}>Cancel</AdminButton>
			</div>
		</div>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		class="hidden"
		accept={acceptAttribute(IMAGE_TYPES)}
		multiple
		tabindex="-1"
		aria-hidden="true"
		onchange={onfilechange}
	/>
	{#if name}<input type="hidden" {name} value={JSON.stringify(items)} />{/if}
	<span class="sr-only" aria-live="polite">{announcement}</span>
</div>
