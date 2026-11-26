<!--
	A link field that can also take an uploaded PDF: paste an https:// link or a site path, or
	press "Upload PDF" to send a file through uploadFile() and fill the field with its URL.
	Submits the value under `name`.

	<PaperField label="Team description paper" name="paperUrl" bind:value={draft.paperUrl} error={errors.paperUrl} />
-->
<script lang="ts">
	import { toast } from 'svelte-sonner';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import AdminButton from '../AdminButton.svelte';
	import FormField from '../FormField.svelte';
	import { monoInputClass } from '../styles.ts';
	import { acceptAttribute, checkFile, uploadFile, type UploadFolder } from '../upload.ts';

	type Props = {
		value?: string;
		name?: string;
		label: string;
		hint?: string;
		error?: string | null;
		folder?: UploadFolder;
		uploading?: boolean;
		disabled?: boolean;
	};

	let {
		value = $bindable(''),
		name,
		label,
		hint,
		error,
		folder = 'projects',
		uploading = $bindable(false),
		disabled = false
	}: Props = $props();

	const PDF = ['application/pdf'] as const;
	let fileInput: HTMLInputElement | undefined = $state();
	let progress = $state(0);
	let controller: AbortController | null = null;

	async function onfilechange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const problem = checkFile(file, PDF);
		if (problem) {
			toast.error(problem === 'That file is empty.' ? problem : 'Upload a PDF file.');
			return;
		}
		uploading = true;
		progress = 0;
		controller = new AbortController();
		try {
			const media = await uploadFile(file, {
				folder,
				signal: controller.signal,
				onProgress: (fraction) => (progress = Math.round(fraction * 100))
			});
			value = media.url;
			toast.success('PDF uploaded.', { description: media.filename });
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') toast('Upload cancelled.');
			else toast.error(err instanceof Error ? err.message : 'Upload failed.');
		} finally {
			uploading = false;
			controller = null;
		}
	}

	const isPdf = $derived(/\.pdf($|[?#])/i.test(value.trim()));
</script>

<FormField {label} {hint} {error} optional>
	{#snippet children(attrs)}
		<Input
			{...attrs}
			{name}
			bind:value
			type="text"
			inputmode="url"
			autocomplete="off"
			spellcheck="false"
			placeholder="https://... or upload the PDF"
			class={monoInputClass}
			{disabled}
			readonly={uploading}
		/>
	{/snippet}
</FormField>
<div class="-mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
	{#if uploading}
		<span class="flex min-w-0 flex-1 items-center gap-2 text-xs text-ink-muted" role="status">
			<Progress value={progress} max={100} class="h-1 max-w-32 bg-surface-300 [&>[data-slot=progress-indicator]]:bg-brand" aria-label="PDF upload progress" />
			Uploading {progress}%
		</span>
		<AdminButton variant="ghost" size="sm" onclick={() => controller?.abort()}>Cancel</AdminButton>
	{:else}
		<AdminButton variant="outline" size="sm" {disabled} onclick={() => fileInput?.click()}>
			<FileTextIcon aria-hidden="true" />{value ? 'Replace with a PDF' : 'Upload PDF'}
		</AdminButton>
		{#if value && isPdf}
			<a href={value} target="_blank" rel="noopener noreferrer" class="inline-flex min-h-9 items-center text-[13px] text-brand-text hover:text-ink">
				Open the PDF<span aria-hidden="true">&nbsp;↗</span><span class="sr-only">(opens in a new tab)</span>
			</a>
		{/if}
	{/if}
</div>
<input
	bind:this={fileInput}
	type="file"
	class="hidden"
	accept={acceptAttribute(PDF)}
	tabindex="-1"
	aria-hidden="true"
	onchange={onfilechange}
/>
