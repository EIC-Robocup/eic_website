<!--
	The "From the archive" polaroids on the About page: a grid of cards, each with the photo
	(ImageField: upload, drop, paste or link), its alt text and the handwritten caption, plus
	Move earlier, Move later and Remove. New cards go at the end.

	<ArchiveEditor server={data.lists.archive} shown={data.shown.archive} bind:dirty />
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import XIcon from '@lucide/svelte/icons/x';
	import { Input } from '#lib/components/ui/input/index.js';
	import AdminButton from '../AdminButton.svelte';
	import ImageField from '../ImageField.svelte';
	import { inputClass, labelClass } from '../styles.ts';
	import ListForm from './ListForm.svelte';
	import SectionNotice from './SectionNotice.svelte';
	import { LIST_MAX, MAX, emptyRow, type ArchiveRow } from './rows.ts';

	type Props = { server: ArchiveRow[]; shown: boolean | null; dirty?: boolean };
	let { server, shown, dirty = $bindable(false) }: Props = $props();

	let rows = $state(untrack(() => $state.snapshot(server)));
	let grid: HTMLElement | undefined = $state();
	let wrap: HTMLElement | undefined = $state();
	let announcement = $state('');

	const uploads = new SvelteSet<ArchiveRow>();

	// Stable keys, so moving a card moves its DOM (and focus) with it.
	const keys = new WeakMap<ArchiveRow, number>();
	let nextKey = 0;
	function keyOf(row: ArchiveRow): number {
		let key = keys.get(row);
		if (key === undefined) {
			key = nextKey++;
			keys.set(row, key);
		}
		return key;
	}

	const cards = () => grid?.querySelectorAll<HTMLElement>('[data-card]') ?? [];

	async function add() {
		if (rows.length >= LIST_MAX.archive) return;
		rows.push(emptyRow('archive'));
		announcement = `Added photo ${rows.length}`;
		await tick();
		const list = cards();
		list[list.length - 1]?.querySelector<HTMLElement>('button')?.focus();
	}

	async function move(index: number, by: -1 | 1, which: 'earlier' | 'later') {
		const to = index + by;
		if (to < 0 || to >= rows.length) return;
		const [row] = rows.splice(index, 1);
		rows.splice(to, 0, row);
		announcement = `Moved photo to position ${to + 1}`;
		await tick();
		const card = cards()[to];
		const same = card?.querySelector<HTMLButtonElement>(`[data-move="${which}"]`);
		const other = card?.querySelector<HTMLButtonElement>(`[data-move="${which === 'earlier' ? 'later' : 'earlier'}"]`);
		(same && !same.disabled ? same : other)?.focus();
	}

	async function remove(index: number) {
		const [row] = rows.splice(index, 1);
		if (row) uploads.delete(row);
		announcement = `Removed photo ${index + 1}`;
		await tick();
		const list = cards();
		const next = list[Math.min(index, list.length - 1)];
		(next?.querySelector<HTMLElement>('[data-remove]') ?? wrap?.closest('section')?.querySelector<HTMLElement>('[data-list-add]'))?.focus();
	}
</script>

<ListForm
	list="archive"
	id="archive"
	bind:rows
	bind:dirty
	{server}
	title="Archive photos"
	description="The pinned polaroids on About. Captions show handwritten."
	noun={['photo', 'photos']}
	addLabel="+ Add photo"
	onadd={add}
	uploading={uploads.size > 0}
>
	{#snippet notice()}<SectionNotice {shown} page="about" pageTitle="About" />{/snippet}
	{#snippet children(errors)}
		<div bind:this={wrap} class="contents"></div>
		{#if rows.length}
			<ol bind:this={grid} class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,176px),1fr))] gap-3 p-0">
				{#each rows as row, index (keyOf(row))}
					{@const err = (key: string) => errors[`archive.${index}.${key}`]}
					<li data-card class="flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-surface-100/60 p-2.5">
						<div class="flex items-center justify-between gap-2">
							<span class="text-label text-brand-text" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
							<div class="-mr-1.5 flex items-center">
								<AdminButton
									variant="ghost"
									size="icon-sm"
									data-move="earlier"
									aria-label="Move photo {index + 1} earlier"
									disabled={index === 0}
									onclick={() => move(index, -1, 'earlier')}
								>
									<ArrowLeftIcon aria-hidden="true" />
								</AdminButton>
								<AdminButton
									variant="ghost"
									size="icon-sm"
									data-move="later"
									aria-label="Move photo {index + 1} later"
									disabled={index === rows.length - 1}
									onclick={() => move(index, 1, 'later')}
								>
									<ArrowRightIcon aria-hidden="true" />
								</AdminButton>
								<AdminButton
									variant="ghost"
									size="icon-sm"
									data-remove
									aria-label="Remove photo {index + 1}"
									onclick={() => remove(index)}
								>
									<XIcon aria-hidden="true" />
								</AdminButton>
							</div>
						</div>
						<ImageField
							folder="archive"
							aspect="4 / 3"
							compact
							label="Photo {index + 1}"
							class="[&>span:first-child]:sr-only"
							bind:url={row.imageUrl}
							bind:alt={row.alt}
							error={err('imageUrl') ?? err('alt')}
							bind:uploading={
								() => uploads.has(row),
								(value) => (value ? uploads.add(row) : uploads.delete(row))
							}
						/>
						<div class="flex flex-col gap-1.5">
							<label for="archive-caption-{keyOf(row)}" class={labelClass}>Caption <span class="font-normal text-ink-muted">Optional</span></label>
							<Input
								id="archive-caption-{keyOf(row)}"
								bind:value={row.caption}
								maxlength={MAX.caption}
								placeholder="RoboCup 2008, 1st!"
								aria-invalid={err('caption') ? 'true' : undefined}
								class="{inputClass} font-hand text-xl leading-6 md:text-xl"
							/>
							{#if err('caption')}
								<span class="text-xs leading-[18px] text-brand-text">{err('caption')}</span>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="m-0 rounded-sm border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-muted">
				No archive photos yet. Add one to pin it to the About page.
			</p>
		{/if}
		<span class="sr-only" aria-live="polite">{announcement}</span>
	{/snippet}
</ListForm>
