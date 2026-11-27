<!--
	One file in the Media library grid: a thumbnail (or an icon for PDFs, videos and 3D
	models), the file name, type, size, date and uploader. The main button opens the details
	sheet; the two icon buttons copy the URL and the Markdown.
-->
<script lang="ts" module>
	import BoxIcon from '@lucide/svelte/icons/box';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FilmIcon from '@lucide/svelte/icons/film';
	import type { MediaKind } from './media.ts';

	export const KIND_ICONS: Record<MediaKind, typeof FileIcon> = {
		image: FileIcon,
		video: FilmIcon,
		pdf: FileTextIcon,
		model: BoxIcon,
		other: FileIcon
	};
</script>

<script lang="ts">
	import { toast } from 'svelte-sonner';
	import CodeIcon from '@lucide/svelte/icons/code';
	import LinkIcon from '@lucide/svelte/icons/link';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { formatDate } from '#lib/content/labels.ts';
	import { optimizedSrc } from '#lib/image.ts';
	import AdminButton from '../AdminButton.svelte';
	import { copyText, kindLabel, markdownFor, mediaKind, metaLine, uploaderLabel, type MediaFile } from './media.ts';

	type Props = {
		file: MediaFile;
		onopen: (file: MediaFile) => void;
	};

	let { file, onopen }: Props = $props();

	const kind = $derived(mediaKind(file));
	const Icon = $derived(KIND_ICONS[kind]);

	async function copy(text: string, what: string) {
		if (await copyText(text)) toast.success(`${what} copied.`, { description: file.filename });
		else toast.error(`Could not copy the ${what.toLowerCase()}. Open the file and copy it from there.`);
	}
</script>

<Card.Root class="gap-0 rounded-lg border border-line bg-surface-200 py-0 text-ink shadow-none ring-0">
	<button
		type="button"
		data-media-open={file.id}
		class="group flex min-w-0 flex-col text-left"
		onclick={() => onopen(file)}
	>
		<span class="relative block aspect-[4/3] overflow-hidden border-b border-line bg-surface-100">
			{#if kind === 'image'}
				<img
					src={optimizedSrc(file.url, 480)}
					alt=""
					loading="lazy"
					decoding="async"
					class="size-full object-cover transition-opacity group-hover:opacity-90"
				/>
			{:else}
				<span class="flex size-full flex-col items-center justify-center gap-2 text-ink-muted">
					<Icon class="size-9" strokeWidth={1.25} aria-hidden="true" />
					<span class="text-label text-[11px]">{kindLabel(kind)}</span>
				</span>
			{/if}
		</span>
		<span class="flex min-w-0 flex-col gap-0.5 px-3 pt-2.5 pb-1">
			<span class="truncate text-[13px] leading-5 font-medium text-ink group-hover:text-brand-text" title={file.filename}>
				<span class="sr-only">Open details for </span>{file.filename}
			</span>
			<span class="truncate font-mono text-[11px] leading-4 text-ink-muted">{metaLine(file)}</span>
			<span class="truncate text-xs leading-[18px] text-ink-muted">
				{formatDate(file.createdAt)} · {uploaderLabel(file)}
			</span>
		</span>
	</button>
	<div class="flex items-center gap-1 px-1.5 pb-1.5">
		{#if !file.alt && kind !== 'pdf'}
			<span class="ml-1.5 min-w-0 truncate text-[11px] text-ink-muted">No alt text</span>
		{/if}
		<span class="ml-auto shrink-0"></span>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<AdminButton {...props} variant="ghost" size="icon" aria-label="Copy URL of {file.filename}" onclick={() => copy(file.url, 'URL')}>
						<LinkIcon aria-hidden="true" />
					</AdminButton>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Copy URL</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<AdminButton
						{...props}
						variant="ghost"
						size="icon"
						aria-label="Copy Markdown for {file.filename}"
						onclick={() => copy(markdownFor(file), 'Markdown')}
					>
						<CodeIcon aria-hidden="true" />
					</AdminButton>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Copy Markdown</Tooltip.Content>
		</Tooltip.Root>
	</div>
</Card.Root>
