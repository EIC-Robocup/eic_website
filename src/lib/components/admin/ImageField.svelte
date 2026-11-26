<!--
	An image picker for forms. Empty, it is a dashed drop zone ("Upload or drop, or paste a
	link"); filled, it shows the image with Replace and Remove, plus an alt text box.
	Uploads go to /admin/api/upload (big photos are resized in the browser first) with a
	progress bar and a Cancel button; problems show as toasts.

	With `name="cover"` the form submits `coverUrl` and `coverAlt`, matching the coverUrl and
	coverAlt columns. Read them on the server with `readImage(form, 'cover')` from form-data.ts.

	<ImageField label="Cover image" name="cover" folder="posts" aspect="16 / 10"
		hint="16:10. Leave empty to show the image slot." bind:url={coverUrl} bind:alt={coverAlt} />

	<ImageField variant="avatar" label="Headshot" name="photo" folder="people" initials="PK"
		hint="Square, at least 400px. Empty shows initials." bind:url={photoUrl} />
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ImageIcon from '@lucide/svelte/icons/image';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import AdminButton from './AdminButton.svelte';
	import { hintClass, inputClass, labelClass } from './styles.ts';
	import {
		IMAGE_TYPES,
		checkFile,
		prepareImage,
		uploadFile,
		type UploadFolder,
		type UploadedMedia
	} from './upload.ts';

	type Props = {
		/** Image URL: a public media URL, an https:// link, or a site path like /images/... Bindable. */
		url?: string;
		/** Alt text. Bindable. */
		alt?: string;
		/** Submits `${name}Url` and `${name}Alt` as hidden fields. */
		name?: string;
		/** Upload folder in the media bucket. */
		folder: UploadFolder;
		/** Group label, e.g. "Cover image". */
		label?: string;
		hint?: string;
		error?: string | null;
		/** CSS aspect ratio of the drop zone and preview, e.g. "16 / 10", "4 / 3", "1 / 1". */
		aspect?: string;
		/** `drop`: a drop zone (default). `avatar`: an 84px circle with an Upload link, for headshots. */
		variant?: 'drop' | 'avatar';
		/** Shown in the empty avatar circle. */
		initials?: string;
		/** Show the alt text box when there is an image. Default true for `drop`, false for `avatar`. */
		showAlt?: boolean;
		/** Offer "paste a link" as well as uploading. */
		allowUrl?: boolean;
		/** Smaller text and padding, for gallery grids. */
		compact?: boolean;
		/** MIME types offered in the file picker. */
		accept?: readonly string[];
		disabled?: boolean;
		/** True while a file uploads. Bindable, e.g. to disable Save meanwhile. */
		uploading?: boolean;
		/** After each successful upload, with the new media row. */
		onupload?: (media: UploadedMedia) => void;
		/** After the image or alt text changes. */
		onchange?: (value: { url: string; alt: string }) => void;
		id?: string;
		class?: string;
	};

	let {
		url = $bindable(''),
		alt = $bindable(''),
		name,
		folder,
		label,
		hint,
		error,
		aspect = '16 / 10',
		variant = 'drop',
		initials = '',
		showAlt,
		allowUrl = true,
		compact = false,
		accept = IMAGE_TYPES,
		disabled = false,
		uploading = $bindable(false),
		onupload,
		onchange,
		id,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const baseId = $derived(id ?? `image-${uid}`);
	const withAlt = $derived(showAlt ?? variant === 'drop');

	let fileInput: HTMLInputElement | undefined = $state();
	let altInput: HTMLInputElement | null = $state(null);
	let urlInput: HTMLInputElement | null = $state(null);
	let progress = $state(0);
	let dragging = $state(false);
	let linkMode = $state(false);
	let linkDraft = $state('');
	let controller: AbortController | null = null;

	function emit() {
		onchange?.({ url, alt });
	}

	function pick() {
		if (!disabled && !uploading) fileInput?.click();
	}

	async function upload(file: File) {
		if (disabled || uploading) return;
		const problem = checkFile(file, accept);
		if (problem) {
			toast.error(problem);
			return;
		}
		uploading = true;
		progress = 0;
		controller = new AbortController();
		try {
			const prepared = await prepareImage(file);
			if (typeof prepared === 'string') {
				toast.error(prepared);
				return;
			}
			const media = await uploadFile(prepared, {
				folder,
				alt,
				signal: controller.signal,
				onProgress: (p) => (progress = p)
			});
			url = media.url;
			linkMode = false;
			emit();
			onupload?.(media);
			toast.success('Image uploaded.');
			if (withAlt && !alt) {
				await tick();
				altInput?.focus();
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				toast('Upload cancelled.');
			} else {
				toast.error(err instanceof Error ? err.message : 'Upload failed.');
			}
		} finally {
			uploading = false;
			controller = null;
			if (fileInput) fileInput.value = '';
		}
	}

	function onfilechange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) void upload(file);
	}

	function hasFiles(event: DragEvent) {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}

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
		const file = event.dataTransfer?.files?.[0];
		if (file) void upload(file);
	}

	function onpaste(event: ClipboardEvent) {
		const file = Array.from(event.clipboardData?.files ?? [])[0];
		if (!file || disabled) return;
		event.preventDefault();
		void upload(file);
	}

	function isUsableUrl(value: string) {
		if (value.startsWith('/') && !value.startsWith('//')) return true;
		try {
			const parsed = new URL(value);
			return parsed.protocol === 'https:' || parsed.protocol === 'http:';
		} catch {
			return false;
		}
	}

	async function openLink() {
		linkMode = true;
		linkDraft = url;
		await tick();
		urlInput?.focus();
	}

	function applyLink() {
		const value = linkDraft.trim();
		if (!value) {
			linkMode = false;
			return;
		}
		if (!isUsableUrl(value)) {
			toast.error('Use a link that starts with https:// or a site path such as /images/...');
			urlInput?.focus();
			return;
		}
		url = value;
		linkMode = false;
		emit();
	}

	function onlinkkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			applyLink();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			linkMode = false;
		}
	}

	function clear() {
		url = '';
		alt = '';
		emit();
	}
</script>

{#snippet linkButton(text: string)}
	<button
		type="button"
		class="inline-flex min-h-6 items-center text-brand-text underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
		{disabled}
		onclick={openLink}>{text}</button
	>
{/snippet}

{#snippet progressOverlay(round: boolean)}
	<div
		class={[
			'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-100/90 p-3 text-center text-xs text-ink',
			round ? 'rounded-full' : 'rounded-[8px]'
		]}
		role="status"
	>
		<Spinner aria-hidden="true" aria-label="" role="presentation" />
		<span>{progress < 100 ? `Uploading ${progress}%` : 'Saving'}</span>
		{#if !round}
			<span class="h-1 w-full max-w-40 overflow-hidden rounded-full bg-surface-300" aria-hidden="true">
				<span class="block h-full bg-brand transition-[width]" style="width: {progress}%"></span>
			</span>
			<AdminButton variant="ghost" size="sm" onclick={() => controller?.abort()}>Cancel</AdminButton>
		{/if}
	</div>
{/snippet}

<div
	role="group"
	aria-labelledby={label ? `${baseId}-label` : undefined}
	aria-describedby={error ? `${baseId}-error` : undefined}
	class={['flex min-w-0 flex-col gap-1.5', className]}
	{onpaste}
>
	{#if label}
		<span id="{baseId}-label" class={labelClass}>{label}</span>
	{/if}

	{#if variant === 'avatar'}
		<div class="flex items-center gap-4">
			<span
				class="relative flex size-21 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong font-display text-[22px] font-semibold text-ink-muted"
			>
				{#if url}
					<img src={url} alt={alt} class="size-full object-cover" />
				{:else}
					<span aria-hidden="true">{initials}</span>
				{/if}
				{#if uploading}{@render progressOverlay(true)}{/if}
			</span>
			<div class="flex min-w-0 flex-col items-start gap-1">
				<div class="flex flex-wrap items-center gap-x-4">
					<button
						type="button"
						class="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
						disabled={disabled || uploading}
						onclick={pick}
					>
						{url ? 'Replace photo' : 'Upload photo'}
					</button>
					{#if url}
						<button
							type="button"
							class="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-ink disabled:opacity-50"
							disabled={disabled || uploading}
							onclick={clear}>Remove</button
						>
					{:else if allowUrl && !linkMode}
						<span class="text-sm">{@render linkButton('Paste a link')}</span>
					{/if}
				</div>
				{#if hint}<span class={hintClass}>{hint}</span>{/if}
			</div>
		</div>
	{:else}
		<div
			class="relative w-full"
			style:aspect-ratio={aspect}
			{ondragover}
			{ondragleave}
			{ondrop}
			role="presentation"
		>
			{#if url}
				<img
					src={url}
					alt={alt || 'Current image'}
					class="size-full rounded-[8px] border border-line bg-surface-100 object-cover"
				/>
				<div class="absolute right-2 bottom-2 flex flex-wrap justify-end gap-1.5">
					<AdminButton
						variant="outline"
						size="sm"
						class="bg-surface-100/90 dark:bg-surface-100/90"
						disabled={disabled || uploading}
						onclick={pick}>Replace</AdminButton
					>
					<AdminButton
						variant="outline"
						size="sm"
						class="bg-surface-100/90 dark:bg-surface-100/90"
						disabled={disabled || uploading}
						onclick={clear}>Remove</AdminButton
					>
				</div>
				{#if dragging}
					<div class="drop-zone pointer-events-none absolute inset-0 border-ink bg-surface-100/70"></div>
				{/if}
			{:else}
				<div
					class={[
						'drop-zone flex size-full flex-col items-center justify-center text-center text-ink-muted transition-colors',
						compact ? 'gap-1 p-2 text-xs' : 'gap-2 p-4 text-[13px]',
						dragging && 'border-ink bg-surface-300/40',
						error && 'border-brand-text'
					]}
				>
					{#if !compact}
						<ImageIcon class="size-6 text-line-strong" strokeWidth={1.5} aria-hidden="true" />
					{/if}
					<span>
						<button
							type="button"
							class="inline-flex min-h-6 items-center text-brand-text underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
							disabled={disabled || uploading}
							onclick={pick}>Upload</button
						>
						or drop{#if allowUrl}, or {@render linkButton('paste a link')}{/if}
					</span>
					{#if hint && !compact}<span class={hintClass}>{hint}</span>{/if}
				</div>
			{/if}
			{#if uploading}{@render progressOverlay(false)}{/if}
		</div>
		{#if hint && (url || compact)}<span class={hintClass}>{hint}</span>{/if}
	{/if}

	{#if linkMode}
		<div class="flex flex-wrap gap-2">
			<Input
				bind:ref={urlInput}
				bind:value={linkDraft}
				type="url"
				inputmode="url"
				aria-label="Image link"
				placeholder="https://... or /images/..."
				class="{inputClass} min-w-0 flex-1 basis-48"
				onkeydown={onlinkkeydown}
			/>
			<AdminButton variant="outline" onclick={applyLink}>Use link</AdminButton>
			<AdminButton variant="ghost" onclick={() => (linkMode = false)}>Cancel</AdminButton>
		</div>
	{/if}

	{#if withAlt && url}
		<div class="flex flex-col gap-1.5 pt-1">
			<label for="{baseId}-alt" class={labelClass}>Alt text</label>
			<Input
				bind:ref={altInput}
				bind:value={alt}
				id="{baseId}-alt"
				class={inputClass}
				maxlength={300}
				placeholder="What the image shows"
				aria-describedby="{baseId}-alt-hint"
				oninput={emit}
			/>
			<span id="{baseId}-alt-hint" class={hintClass}>Describe the image for people who can't see it.</span>
		</div>
	{/if}

	{#if error}
		<p id="{baseId}-error" class="m-0 text-xs leading-[18px] text-brand-text">{error}</p>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		class="hidden"
		accept={accept.join(',')}
		tabindex="-1"
		aria-hidden="true"
		onchange={onfilechange}
	/>
	{#if name}
		<input type="hidden" name="{name}Url" value={url} />
		<input type="hidden" name="{name}Alt" value={alt} />
	{/if}
</div>
