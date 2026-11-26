<!--
	The input for one scalar section field (text, textarea, url). Toggles are rendered by the
	caller (ToggleRow or a Switch). No `name`: the Pages editor submits each section as JSON.

	<ScalarControl field={field} bind:value={data.headline} attrs={attrs} />
-->
<script lang="ts" module>
	import type { FieldAttrs } from '../FormField.svelte';

	const NO_ATTRS: Partial<FieldAttrs> = {};
</script>

<script lang="ts">
	import type { ScalarField } from '#lib/content/sections.ts';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { inputClass, monoInputClass, textareaClass } from '../styles.ts';
	import { LIMITS } from './values.ts';

	type Props = {
		field: Exclude<ScalarField, { type: 'toggle' }>;
		/** The field's value. Bindable. */
		value: unknown;
		/** From FormField: id, aria-describedby, aria-invalid. Must be a stable object. */
		attrs?: Partial<FieldAttrs>;
		/** Accessible name when there is no visible label (list rows). */
		ariaLabel?: string;
		/** Space Grotesk, for headlines and big numbers. */
		display?: boolean;
	};

	let { field, value = $bindable(), attrs = NO_ATTRS, ariaLabel, display = false }: Props = $props();

	const text = () => (typeof value === 'string' ? value : '');
	const write = (next: string) => (value = next);
	const placeholder = $derived('placeholder' in field ? field.placeholder : undefined);
</script>

{#if field.type === 'textarea'}
	<Textarea
		{...attrs}
		bind:value={text, write}
		rows={field.rows ?? 3}
		maxlength={LIMITS.textarea}
		aria-label={ariaLabel}
		class={textareaClass}
	/>
{:else if field.type === 'url'}
	<Input
		{...attrs}
		bind:value={text, write}
		type="text"
		inputmode="url"
		autocomplete="off"
		spellcheck={false}
		maxlength={LIMITS.url}
		placeholder={placeholder ?? 'https://... or /page'}
		aria-label={ariaLabel}
		class={monoInputClass}
	/>
{:else}
	<Input
		{...attrs}
		bind:value={text, write}
		type="text"
		maxlength={LIMITS.text}
		{placeholder}
		aria-label={ariaLabel}
		class={display
			? `${inputClass} h-12 font-display text-lg font-semibold tracking-[-0.01em] md:text-xl`
			: inputClass}
	/>
{/if}
