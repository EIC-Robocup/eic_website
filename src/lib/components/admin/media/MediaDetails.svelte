<!--
	The details of one media file, inside the Media library's Sheet: a preview, the alt text
	form, the URL and Markdown with copy buttons, where the file is used (fetched when the sheet
	opens), and Delete with a warning that pages using it will break. Render it inside
	{#key file.id} so each file gets fresh state.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import AdminButton from '../AdminButton.svelte';
	import ConfirmDelete from '../ConfirmDelete.svelte';
	import FormField from '../FormField.svelte';
	import { AdminForm } from '../form.svelte.ts';
	import { formatDateTime, isoString } from '../sections/time.ts';
	import { hintClass, inputClass, labelClass } from '../styles.ts';
	import { KIND_ICONS } from './MediaCard.svelte';
	import {
		copyText,
		folderOf,
		kindLabel,
		markdownFor,
		mediaKind,
		metaLine,
		uploaderLabel,
		type MediaFile
	} from './media.ts';

	type Use = { kind: string; label: string; where: string; href: string | null };

	type Props = {
		file: MediaFile;
		/** After the file is deleted (close the sheet). */
		ondeleted?: () => void;
	};

	let { file, ondeleted }: Props = $props();

	const uid = $props.id();
	const kind = $derived(mediaKind(file));
	const Icon = $derived(KIND_ICONS[kind]);
	const markdown = $derived(markdownFor(file));

	let alt = $state(untrack(() => file.alt));
	const altDirty = $derived(alt.replace(/\s+/g, ' ').trim() !== file.alt);
	const altForm = new AdminForm();

	/* Where the file is used, for the delete warning. */
	let uses = $state<Use[] | null>(null);
	let usesFailed = $state(false);
	$effect(() => {
		const controller = new AbortController();
		const id = file.id;
		fetch(`/admin/media/${id}/usage`, { headers: { accept: 'application/json' }, signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error(String(response.status));
				const body = (await response.json()) as { uses?: Use[] };
				uses = Array.isArray(body.uses) ? body.uses : [];
			})
			.catch((err) => {
				if (!(err instanceof DOMException && err.name === 'AbortError')) usesFailed = true;
			});
		return () => controller.abort();
	});

	const deleteDescription = $derived.by(() => {
		const tail = "Pages that use it will show a broken image or link. This can't be undone.";
		if (!uses) return `It is removed from storage. ${tail}`;
		if (!uses.length) return "We found no page using it. It is removed from storage. This can't be undone.";
		const names = uses.slice(0, 3).map((u) => `${u.label} (${u.where})`).join(', ');
		const more = uses.length > 3 ? ` and ${uses.length - 3} more` : '';
		return `It is used in ${uses.length === 1 ? 'one place' : `${uses.length} places`}: ${names}${more}. ${tail}`;
	});

	async function copy(text: string, what: string) {
		if (await copyText(text)) toast.success(`${what} copied.`);
		else toast.error(`Could not copy the ${what.toLowerCase()}. Select it and copy it by hand.`);
	}

	const rowClass = 'grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-1.5 text-[13px] leading-5';
</script>

<Sheet.Header class="gap-1.5 border-b border-line p-5 pr-14">
	<span class="text-label text-brand-text">{kindLabel(kind)}</span>
	<Sheet.Title class="font-display text-lg leading-6 font-semibold tracking-[-0.01em] break-all text-ink">
		{file.filename}
	</Sheet.Title>
	<Sheet.Description class="font-mono text-xs text-ink-muted">{metaLine(file)}</Sheet.Description>
</Sheet.Header>

<div class="flex flex-col gap-5 p-5">
	<div class="overflow-hidden rounded-lg border border-line bg-surface-100">
		{#if kind === 'image'}
			<img src={file.url} alt={file.alt} class="max-h-[50vh] w-full object-contain" />
		{:else if kind === 'video'}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video src={file.url} controls preload="metadata" class="max-h-[50vh] w-full bg-black"></video>
		{:else}
			<div class="flex aspect-[16/9] flex-col items-center justify-center gap-3 text-ink-muted">
				<Icon class="size-10" strokeWidth={1.25} aria-hidden="true" />
				<a href={file.url} target="_blank" rel="noopener noreferrer" class="text-sm text-brand-text hover:text-ink">
					Open the file<span aria-hidden="true">&nbsp;↗</span><span class="sr-only">(opens in a new tab)</span>
				</a>
			</div>
		{/if}
	</div>

	<form method="POST" action="?/alt" use:enhance={altForm.submit} class="flex flex-col gap-2">
		<input type="hidden" name="id" value={file.id} />
		<FormField
			label="Alt text"
			error={altForm.errors.alt}
			hint={kind === 'pdf'
				? 'Used as the link text when you copy the Markdown.'
				: 'Used when you copy the Markdown. Pages and projects keep their own alt text.'}
		>
			{#snippet children(attrs)}
				<Input {...attrs} name="alt" bind:value={alt} class={inputClass} maxlength={300} placeholder="What the file shows" />
			{/snippet}
		</FormField>
		<AdminButton type="submit" variant="outline" size="sm" class="self-start" pending={altForm.pending} disabled={!altDirty}>
			Save alt text
		</AdminButton>
	</form>

	<div class="flex flex-col gap-3">
		<div class="flex flex-col gap-1.5">
			<label for="{uid}-url" class={labelClass}>URL</label>
			<InputGroup.Root class="h-11 rounded-sm border-line-strong bg-surface-100 shadow-none dark:bg-surface-100">
				<InputGroup.Input id="{uid}-url" value={file.url} readonly class="h-full font-mono text-xs md:text-xs" onfocus={(e: FocusEvent) => (e.currentTarget as HTMLInputElement).select()} />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button size="sm" class="-mr-2 h-[42px] rounded-none rounded-r-sm border-l border-line px-3 text-ink hover:bg-surface-300 dark:hover:bg-surface-300" onclick={() => copy(file.url, 'URL')} aria-label="Copy URL">
						<CopyIcon aria-hidden="true" />Copy
					</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="{uid}-md" class={labelClass}>Markdown</label>
			<InputGroup.Root class="h-11 rounded-sm border-line-strong bg-surface-100 shadow-none dark:bg-surface-100">
				<InputGroup.Input id="{uid}-md" value={markdown} readonly class="h-full font-mono text-xs md:text-xs" onfocus={(e: FocusEvent) => (e.currentTarget as HTMLInputElement).select()} />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button size="sm" class="-mr-2 h-[42px] rounded-none rounded-r-sm border-l border-line px-3 text-ink hover:bg-surface-300 dark:hover:bg-surface-300" onclick={() => copy(markdown, 'Markdown')} aria-label="Copy Markdown">
						<CopyIcon aria-hidden="true" />Copy
					</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
			<span class={hintClass}>
				{kind === 'video'
					? 'Paste it into a post: it becomes a video player.'
					: kind === 'model'
						? 'Paste it into a post: it becomes a 3D viewer you can turn.'
						: kind === 'pdf'
							? 'Paste it into a post: it becomes a link to the PDF.'
							: 'Paste it into a post. Add a caption in quotes after the URL.'}
			</span>
		</div>
	</div>

	<dl class="m-0 flex flex-col divide-y divide-line border-y border-line">
		<div class={rowClass}><dt class="text-ink-muted">Folder</dt><dd class="m-0 font-mono text-xs leading-5">{folderOf(file.path) || 'none'}</dd></div>
		<div class={rowClass}>
			<dt class="text-ink-muted">Uploaded</dt>
			<dd class="m-0"><time datetime={isoString(file.createdAt)}>{formatDateTime(file.createdAt)}</time></dd>
		</div>
		<div class={rowClass}><dt class="text-ink-muted">By</dt><dd class="m-0 break-all">{file.uploadedBy ?? uploaderLabel(file)}</dd></div>
	</dl>

	<section aria-labelledby="{uid}-uses" class="flex flex-col gap-2">
		<h3 id="{uid}-uses" class="m-0 text-sm leading-5 font-medium text-ink">Used in</h3>
		{#if usesFailed}
			<p class={['m-0', hintClass]}>Could not check where it is used.</p>
		{:else if !uses}
			<div class="flex flex-col gap-2" aria-busy="true">
				<Skeleton class="h-5 w-3/4 bg-surface-300" />
				<Skeleton class="h-5 w-1/2 bg-surface-300" />
				<span class="sr-only">Checking where it is used</span>
			</div>
		{:else if uses.length}
			<ul class="m-0 flex list-none flex-col gap-1 p-0">
				{#each uses as use, i (i)}
					<li class="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px] leading-5">
						<span class="text-label text-[11px] text-ink-muted">{use.kind}</span>
						{#if use.href}
							<a href={use.href} class="min-w-0 truncate text-brand-text hover:text-ink">{use.label}</a>
						{:else}
							<span class="min-w-0 truncate">{use.label}</span>
						{/if}
						<span class="text-ink-muted">{use.where}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class={['m-0', hintClass]}>Not used in any post, project, person, page or list we know of.</p>
		{/if}
	</section>

	<Separator class="bg-line" />
	<ConfirmDelete
		action="?/delete"
		id={file.id}
		title="Delete {file.filename}?"
		description={deleteDescription}
		triggerLabel="Delete file"
		confirmLabel="Delete file"
		variant="outline"
		{ondeleted}
	/>
</div>
