<!--
	One page section in the Pages editor: a numbered Panel with the section's title and
	description, a "Show on page" switch when the section is toggleable, the form generated
	from its field definitions, and a footer with its status, "Undo changes" (local) and
	"Reset to default" (deletes the saved row through `resetAction`, after a confirm).

	<SectionPanel number="01" sectionKey="hero" def={def} bind:draft={drafts.hero}
		baseline={data.values.hero} saved={data.saved.hero} errors={sectionErrors(errors, 'hero')} />
-->
<script lang="ts">
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import type { SectionDef } from '#lib/content/sections.ts';
	import AdminButton from '../AdminButton.svelte';
	import ConfirmDelete from '../ConfirmDelete.svelte';
	import Panel from '../Panel.svelte';
	import SectionField from './SectionField.svelte';
	import { formatDateTime, isoString, timeAgo } from './time.ts';
	import { LIMITS, isWideField, stableStringify, type SectionDraft } from './values.ts';

	type Props = {
		/** "01", "02"... */
		number: string;
		sectionKey: string;
		def: SectionDef;
		/** What the editor holds now. Bindable; must be $state. */
		draft: SectionDraft;
		/** What the site shows now (saved values over defaults). */
		baseline: SectionDraft;
		/** The saved row, when this section differs from the default copy. */
		saved?: { updatedAt: Date | string; updatedBy: string | null } | null;
		/** Errors for this section, keyed by field path. */
		errors?: Record<string, string>;
		/** For relative times; pass the same value on server and client. */
		now?: Date;
		/** Action that deletes the saved row (receives `id` = section key). */
		resetAction?: string;
	};

	let {
		number,
		sectionKey,
		def,
		draft = $bindable(),
		baseline,
		saved = null,
		errors = {},
		now = new Date(),
		resetAction = '?/reset'
	}: Props = $props();

	const uid = $props.id();
	const switchId = `${uid}-enabled`;

	const SWITCH_CLASS =
		'h-6 w-10 px-[2px] data-unchecked:bg-line dark:data-unchecked:bg-line [&>[data-slot=switch-thumb]]:size-[18px]! [&>[data-slot=switch-thumb]]:bg-white! data-checked:[&>[data-slot=switch-thumb]]:translate-x-4!';

	const dirty = $derived(stableStringify(draft) !== stableStringify(baseline));
	const soleList = $derived(def.fields.length === 1 && def.fields[0].type === 'list' ? def.fields[0] : null);
	const soleListCount = $derived(soleList && Array.isArray(draft.data[soleList.key]) ? (draft.data[soleList.key] as unknown[]).length : 0);
	const soleListMax = $derived(soleList?.max ?? LIMITS.list);

	let soleField: SectionField | undefined = $state();

	function clone(value: SectionDraft): SectionDraft {
		return structuredClone($state.snapshot(value)) as SectionDraft;
	}

	function undo() {
		draft = clone(baseline);
	}
</script>

<Panel {number} title={def.title} description={def.description} id="section-{sectionKey}">
	{#snippet actions()}
		{#if soleList}
			<span class="text-xs text-ink-muted" aria-hidden="true">{soleListCount} of {soleListMax}</span>
			<AdminButton
				variant="ghost"
				size="sm"
				disabled={soleListCount >= soleListMax}
				onclick={() => soleField?.add()}
			>
				+ Add {soleList.itemLabel}
			</AdminButton>
		{/if}
		{#if def.toggleable}
			<div class="flex min-h-11 items-center gap-2.5">
				<Label for={switchId} class="text-[13px] font-medium text-ink-muted">Show on page</Label>
				<Switch id={switchId} bind:checked={draft.enabled} class={SWITCH_CLASS} />
			</div>
		{/if}
	{/snippet}

	{#if def.fields.length}
		<div class="grid min-w-0 gap-x-4 gap-y-5 sm:grid-cols-2">
			{#each def.fields as field (field.key)}
				<div class={['min-w-0', isWideField(field) && 'sm:col-span-2']}>
					{#if soleList}
						<SectionField
							bind:this={soleField}
							{field}
							bind:value={draft.data[field.key]}
							{errors}
							hideListLabel
							listAddButton="none"
						/>
					{:else}
						<SectionField {field} bind:value={draft.data[field.key]} {errors} />
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="m-0 text-sm leading-[22px] text-ink-muted">
			Nothing to write here: this section fills itself from the site's content. Use the switch to show or hide it.
		</p>
	{/if}

	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3.5">
		<p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-[18px] text-ink-muted">
			{#if dirty}
				<span class="inline-flex items-center gap-1.5 text-ink">
					<span class="size-1.5 rounded-full bg-brand-text" aria-hidden="true"></span>Unpublished changes
				</span>
			{:else if saved}
				<span>
					Edited
					<time datetime={isoString(saved.updatedAt)} title={formatDateTime(saved.updatedAt)}
						>{timeAgo(saved.updatedAt, now, { lower: true })}</time
					>{#if saved.updatedBy}&nbsp;by {saved.updatedBy}{/if}
				</span>
			{:else}
				<span>Default copy</span>
			{/if}
			{#if def.toggleable && !draft.enabled}
				<span aria-hidden="true">·</span><span>Hidden on the site</span>
			{/if}
		</p>
		<div class="flex flex-wrap items-center gap-1">
			{#if dirty}
				<AdminButton variant="ghost" size="sm" onclick={undo}>Undo changes</AdminButton>
			{/if}
			<ConfirmDelete
				action={resetAction}
				id={sectionKey}
				title="Reset {def.title} to the default copy?"
				description="{def.toggleable
					? 'The saved text and the Show on page switch for this section are removed'
					: 'The saved text for this section is removed'} and the page shows the designed default again. Unpublished changes in other sections stay as they are."
				confirmLabel="Reset section"
				success="Section reset to the default copy."
				disabled={!saved}
				ondeleted={undo}
			>
				{#snippet trigger(props)}
					<AdminButton {...props} variant="ghost" size="sm" disabled={!saved}>Reset to default</AdminButton>
				{/snippet}
			</ConfirmDelete>
		</div>
	</div>
</Panel>
