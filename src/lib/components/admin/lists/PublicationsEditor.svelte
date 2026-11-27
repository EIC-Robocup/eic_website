<!--
	The papers on the Projects page: year, title, venue, authors, and a link that can also be
	an uploaded PDF (PaperField, through uploadFile). Saved newest first; the arrows order
	papers within the same year.

	<PublicationsEditor server={data.lists.publications} shown={data.shown.publications} bind:dirty />
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import FormField from '../FormField.svelte';
	import ListEditor from '../ListEditor.svelte';
	import PaperField from '../projects/PaperField.svelte';
	import { inputClass, monoInputClass, textareaClass } from '../styles.ts';
	import ListForm from './ListForm.svelte';
	import SectionNotice from './SectionNotice.svelte';
	import { LIST_MAX, MAX, emptyRow, type PublicationRow } from './rows.ts';

	type Props = { server: PublicationRow[]; shown: boolean | null; dirty?: boolean };
	let { server, shown, dirty = $bindable(false) }: Props = $props();

	let rows = $state(untrack(() => $state.snapshot(server)));
	let editor: ListEditor<PublicationRow> | undefined = $state();
	const uploads = new SvelteSet<PublicationRow>();
</script>

<ListForm
	list="publications"
	id="publications"
	bind:rows
	bind:dirty
	{server}
	title="Publications"
	description="Papers on the Projects page. Saved newest first; the arrows order papers within the same year."
	noun={['paper', 'papers']}
	addLabel="+ Add paper"
	onadd={() => editor?.add()}
	uploading={uploads.size > 0}
>
	{#snippet notice()}<SectionNotice {shown} page="projects" pageTitle="Projects" />{/snippet}
	{#snippet children(errors)}
		<ListEditor
			bind:this={editor}
			bind:items={rows}
			create={() => emptyRow('publications')}
			itemLabel="paper"
			addPosition="none"
			max={LIST_MAX.publications}
			onchange={(items) => {
				for (const row of uploads) if (!items.includes(row)) uploads.delete(row);
			}}
			rowClass="grid min-w-0 flex-1 gap-3 border-t border-line pt-4 sm:grid-cols-[96px_minmax(0,1fr)]"
		>
			{#snippet row(item, i)}
				{@const err = (key: string) => errors[`publications.${i}.${key}`]}
				<FormField label="Year" error={err('year')}>
					{#snippet children(attrs)}
						<Input
							{...attrs}
							bind:value={item.year}
							inputmode="numeric"
							maxlength={4}
							placeholder="2026"
							autocomplete="off"
							class={monoInputClass}
						/>
					{/snippet}
				</FormField>
				<FormField label="Title" error={err('title')}>
					{#snippet children(attrs)}
						<Textarea
							{...attrs}
							bind:value={item.title}
							maxlength={MAX.title}
							rows={1}
							class="{textareaClass} min-h-11 resize-none"
							onkeydown={(event: KeyboardEvent) => {
								// One line: Enter saves the list instead of adding a line break.
								if (event.key === 'Enter') {
									event.preventDefault();
									(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
								}
							}}
						/>
					{/snippet}
				</FormField>
				<div class="grid min-w-0 gap-3 sm:col-span-2 md:grid-cols-2">
					<FormField label="Venue" optional error={err('venue')}>
						{#snippet children(attrs)}
							<Input {...attrs} bind:value={item.venue} maxlength={MAX.venue} placeholder="Journal or conference" class={inputClass} />
						{/snippet}
					</FormField>
					<FormField label="Authors" optional error={err('authors')}>
						{#snippet children(attrs)}
							<Input
								{...attrs}
								bind:value={item.authors}
								maxlength={MAX.authors}
								placeholder="In the order on the paper"
								class={inputClass}
							/>
						{/snippet}
					</FormField>
				</div>
				<div class="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
					<PaperField
						label="Link"
						hint="The paper's page, or upload the PDF."
						folder="projects"
						bind:value={item.url}
						error={err('url')}
						bind:uploading={
							() => uploads.has(item),
							(value) => (value ? uploads.add(item) : uploads.delete(item))
						}
					/>
				</div>
			{/snippet}
			{#snippet empty()}
				<p class="m-0 rounded-sm border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-muted">
					No papers yet. The Publications section stays hidden until you add one.
				</p>
			{/snippet}
		</ListEditor>
	{/snippet}
</ListForm>
