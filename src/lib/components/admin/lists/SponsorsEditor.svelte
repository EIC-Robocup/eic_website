<!--
	The sponsors on the About page ("Supported by"): a logo (ImageField), the name, which is
	also the logo's alt text, and a link to their website. In the order shown on the site.

	<SponsorsEditor server={data.lists.sponsors} shown={data.shown.sponsors} bind:dirty />
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Input } from '#lib/components/ui/input/index.js';
	import ImageField from '../ImageField.svelte';
	import ListEditor from '../ListEditor.svelte';
	import { inputClass, monoInputClass } from '../styles.ts';
	import ListForm from './ListForm.svelte';
	import SectionNotice from './SectionNotice.svelte';
	import { LIST_MAX, MAX, emptyRow, type SponsorRow } from './rows.ts';

	type Props = { server: SponsorRow[]; shown: boolean | null; dirty?: boolean };
	let { server, shown, dirty = $bindable(false) }: Props = $props();

	let rows = $state(untrack(() => $state.snapshot(server)));
	let editor: ListEditor<SponsorRow> | undefined = $state();
	const uploads = new SvelteSet<SponsorRow>();
</script>

<ListForm
	list="sponsors"
	id="sponsors"
	bind:rows
	bind:dirty
	{server}
	title="Sponsors"
	description="Logos on About under Supported by, in this order."
	noun={['sponsor', 'sponsors']}
	addLabel="+ Add sponsor"
	onadd={() => editor?.add()}
	uploading={uploads.size > 0}
>
	{#snippet notice()}<SectionNotice {shown} page="about" pageTitle="About" />{/snippet}
	{#snippet children(errors)}
		<ListEditor
			bind:this={editor}
			bind:items={rows}
			create={() => emptyRow('sponsors')}
			itemLabel="sponsor"
			addPosition="none"
			max={LIST_MAX.sponsors}
			onchange={(items) => {
				for (const row of uploads) if (!items.includes(row)) uploads.delete(row);
			}}
			rowClass="grid min-w-0 flex-1 grid-cols-[112px_minmax(0,1fr)] items-start gap-2.5 border-t border-line pt-3"
		>
			{#snippet row(item, i)}
				{@const err = (key: string) => errors[`sponsors.${i}.${key}`]}
				{@const problems = [err('logoUrl'), err('name'), err('url')].filter(Boolean)}
				{@const describedBy = problems.length ? `sponsor-${i}-errors` : undefined}
				<ImageField
					folder="sponsors"
					aspect="16 / 10"
					compact
					allowUrl
					showAlt={false}
					label="Logo"
					class="[&>span:first-child]:sr-only"
					bind:url={item.logoUrl}
					alt={item.name}
					bind:uploading={
						() => uploads.has(item),
						(value) => (value ? uploads.add(item) : uploads.delete(item))
					}
				/>
				<div class="flex min-w-0 flex-col gap-1.5">
					<Input
						bind:value={item.name}
						aria-label="Name of sponsor {i + 1}"
						aria-invalid={err('name') ? 'true' : undefined}
						aria-describedby={describedBy}
						placeholder="Sponsor name"
						maxlength={MAX.name}
						class={inputClass}
					/>
					<Input
						bind:value={item.url}
						type="url"
						inputmode="url"
						aria-label="Website of sponsor {i + 1}"
						aria-invalid={err('url') ? 'true' : undefined}
						aria-describedby={describedBy}
						placeholder="https://"
						autocomplete="off"
						spellcheck="false"
						class={monoInputClass}
					/>
				</div>
				{#if problems.length}
					<p id={describedBy} class="col-span-full m-0 text-xs leading-[18px] text-brand-text">{problems.join(' ')}</p>
				{/if}
			{/snippet}
			{#snippet empty()}
				<p class="m-0 rounded-sm border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-muted">
					No sponsors yet. The Supported by row stays hidden until you add one.
				</p>
			{/snippet}
		</ListEditor>
	{/snippet}
</ListForm>
