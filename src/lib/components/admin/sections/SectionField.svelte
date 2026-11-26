<!--
	One field of a page section, generated from its definition in src/lib/content/sections.ts:
	text, textarea, url, toggle, link { label, href }, image { url, alt }, tags, or a list of
	objects with scalar sub-fields. Nothing here has a `name`: the Pages editor submits the
	whole section as JSON. Errors are keyed by path within the section (`primaryCta.href`,
	`items.2.value`), as `validateSection` returns them.

	<SectionField {field} bind:value={draft.data[field.key]} errors={errors} />
-->
<script lang="ts">
	import LinkIcon from '@lucide/svelte/icons/link';
	import type { Field, ImageValue, LinkValue } from '#lib/content/sections.ts';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import FormField from '../FormField.svelte';
	import ImageField from '../ImageField.svelte';
	import ListEditor from '../ListEditor.svelte';
	import TagsInput from '../TagsInput.svelte';
	import ToggleRow from '../ToggleRow.svelte';
	import { hintClass, inputClass, labelClass } from '../styles.ts';
	import ScalarControl from './ScalarControl.svelte';
	import { LIMITS, emptyItem } from './values.ts';

	type Row = Record<string, unknown>;

	type Props = {
		field: Field;
		/** The field's value. Bindable. */
		value: unknown;
		/** Errors for this section, keyed by field path. */
		errors?: Record<string, string>;
		/** Hide the label of a list (when the panel title already names it). */
		hideListLabel?: boolean;
		/** Put a list's Add button elsewhere (call `add()`). */
		listAddButton?: 'bottom' | 'none';
	};

	let {
		field,
		value = $bindable(),
		errors = {},
		hideListLabel = false,
		listAddButton = 'bottom'
	}: Props = $props();

	const uid = $props.id();
	const error = $derived(errors[field.key]);

	// Typed views of the value. The value is a $state proxy owned by the page, so writing to
	// these objects updates the editor's draft.
	const link = $derived(value as LinkValue);
	const image = $derived(value as ImageValue);
	const items = $derived((Array.isArray(value) ? value : []) as Row[]);
	const tags = $derived((Array.isArray(value) ? value : []) as string[]);

	let list: ListEditor<Row> | undefined = $state();

	/** For list fields: add an empty row (focuses its first input). */
	export function add() {
		void list?.add();
	}

	const SWITCH_CLASS =
		'h-6 w-10 px-[2px] data-unchecked:bg-line dark:data-unchecked:bg-line [&>[data-slot=switch-thumb]]:size-[18px]! [&>[data-slot=switch-thumb]]:bg-white! data-checked:[&>[data-slot=switch-thumb]]:translate-x-4!';

	const listField = $derived(field.type === 'list' ? field : null);
	const compactRows = $derived((listField?.fields.length ?? 0) <= 2);
	const rowClass = $derived.by(() => {
		if (!listField) return '';
		const subs = listField.fields;
		if (subs.length === 1) return 'grid min-w-0 flex-1 gap-2.5';
		if (subs.length === 2) {
			return subs[0].key === 'value'
				? 'grid min-w-0 flex-1 gap-2.5 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)]'
				: 'grid min-w-0 flex-1 gap-2.5 sm:grid-cols-2';
		}
		return 'grid min-w-0 flex-1 gap-x-3 gap-y-3 sm:grid-cols-2';
	});
	const noun = $derived(listField ? listField.itemLabel.charAt(0).toUpperCase() + listField.itemLabel.slice(1) : '');
	const listMax = $derived(listField?.max ?? LIMITS.list);
</script>

{#if field.type === 'toggle'}
	<ToggleRow
		label={field.label}
		hint={field.hint}
		bind:checked={() => value === true, (next) => (value = next)}
	/>
{:else if field.type === 'link'}
	{@const labelError = errors[`${field.key}.label`]}
	{@const hrefError = errors[`${field.key}.href`]}
	<div role="group" aria-labelledby="{uid}-label" class="flex min-w-0 flex-col gap-1.5">
		<Label id="{uid}-label" for="{uid}-text" class={labelClass}>{field.label}</Label>
		<Input
			id="{uid}-text"
			bind:value={() => link.label, (next) => (link.label = next)}
			maxlength={LIMITS.linkLabel}
			placeholder="Button text"
			aria-invalid={labelError ? 'true' : undefined}
			aria-describedby={[labelError && `${uid}-label-error`, field.hint && `${uid}-hint`].filter(Boolean).join(' ') ||
				undefined}
			class={inputClass}
		/>
		{#if labelError}
			<p id="{uid}-label-error" class="m-0 text-xs leading-[18px] text-brand-text">{labelError}</p>
		{/if}
		<InputGroup.Root
			class="h-11 rounded-sm border-line-strong bg-surface-100 shadow-none dark:bg-surface-100 has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:outline-2 has-[[data-slot=input-group-control]:focus-visible]:outline-offset-2 has-[[data-slot=input-group-control]:focus-visible]:outline-focus"
		>
			<InputGroup.Addon class="pl-3 text-ink-muted">
				<LinkIcon aria-hidden="true" />
			</InputGroup.Addon>
			<InputGroup.Input
				bind:value={() => link.href, (next) => (link.href = next)}
				inputmode="url"
				autocomplete="off"
				spellcheck={false}
				maxlength={LIMITS.url}
				placeholder="/projects or https://..."
				aria-label="{field.label} link"
				aria-invalid={hrefError ? 'true' : undefined}
				aria-describedby={hrefError ? `${uid}-href-error` : undefined}
				class="h-full px-2 font-mono text-[13px] outline-none! placeholder:text-ink-muted/70 md:text-[13px]"
			/>
		</InputGroup.Root>
		{#if hrefError}
			<p id="{uid}-href-error" class="m-0 text-xs leading-[18px] text-brand-text">{hrefError}</p>
		{/if}
		{#if field.hint}<p id="{uid}-hint" class={['m-0', hintClass]}>{field.hint}</p>{/if}
	</div>
{:else if field.type === 'image'}
	<ImageField
		label={field.label}
		hint={field.hint}
		{error}
		folder="pages"
		aspect="16 / 6"
		bind:url={() => image.url, (next) => (image.url = next)}
		bind:alt={() => image.alt, (next) => (image.alt = next)}
	/>
{:else if field.type === 'tags'}
	<FormField label={field.label} hint={field.hint ?? 'Press Enter or a comma after each one.'} {error}>
		{#snippet children(attrs)}
			<TagsInput
				{...attrs}
				bind:tags={() => tags, (next) => (value = next)}
				max={LIMITS.tags}
				maxLength={LIMITS.tag}
				placeholder="Add a chip"
			/>
		{/snippet}
	</FormField>
{:else if field.type === 'list'}
	<div role="group" aria-labelledby="{uid}-label" class="flex min-w-0 flex-col gap-2.5">
		<span id="{uid}-label" class={[labelClass, hideListLabel && 'sr-only']}>{field.label}</span>
		{#if field.hint}<p class={['m-0', hintClass]}>{field.hint}</p>{/if}
		<ListEditor
			bind:this={list}
			bind:items={() => items, (next) => (value = next)}
			create={() => emptyItem(field)}
			itemLabel={field.itemLabel}
			max={listMax}
			numbered={!compactRows}
			addPosition={listAddButton}
			{rowClass}
		>
			{#snippet header()}
				{#if compactRows}
					{#each field.fields as sub (sub.key)}<span>{sub.label}</span>{/each}
				{/if}
			{/snippet}
			{#snippet row(item, index)}
				{#each field.fields as sub (sub.key)}
					{@const path = `${field.key}.${index}.${sub.key}`}
					{@const subError = errors[path]}
					{@const name = `${noun} ${index + 1} ${sub.label.toLowerCase()}`}
					{#if sub.type === 'toggle'}
						<div class="flex min-h-11 items-center gap-3">
							<Switch
								id="{uid}-{index}-{sub.key}"
								bind:checked={() => item[sub.key] === true, (next) => (item[sub.key] = next)}
								class={SWITCH_CLASS}
							/>
							<Label for="{uid}-{index}-{sub.key}" class={labelClass}>
								<span class="sr-only">{noun} {index + 1}</span>{sub.label}
							</Label>
						</div>
					{:else if compactRows}
						{@const errorId = `${uid}-${index}-${sub.key}-error`}
						<div class="flex min-w-0 flex-col gap-1">
							<ScalarControl
								field={sub}
								bind:value={() => item[sub.key], (next) => (item[sub.key] = next)}
								ariaLabel={name}
								display={sub.key === 'value'}
								attrs={subError ? { 'aria-invalid': 'true', 'aria-describedby': errorId } : undefined}
							/>
							{#if subError}
								<p id={errorId} class="m-0 text-xs leading-[18px] text-brand-text">{subError}</p>
							{/if}
						</div>
					{:else}
						<FormField label={sub.label} hint={sub.hint} error={subError}>
							{#snippet children(attrs)}
								<ScalarControl
									field={sub}
									bind:value={() => item[sub.key], (next) => (item[sub.key] = next)}
									{attrs}
								/>
							{/snippet}
						</FormField>
					{/if}
				{/each}
			{/snippet}
		</ListEditor>
		{#if error}<p class="m-0 text-xs leading-[18px] text-brand-text">{error}</p>{/if}
	</div>
{:else}
	<FormField label={field.label} hint={field.hint} {error}>
		{#snippet children(attrs)}
			<ScalarControl {field} bind:value {attrs} display={field.key === 'headline'} />
		{/snippet}
	</FormField>
{/if}
