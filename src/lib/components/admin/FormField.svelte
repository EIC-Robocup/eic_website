<!--
	Label, control, hint and error for one form field, wired for screen readers. The children
	snippet receives the attributes to spread on the control (`id`, `aria-describedby`,
	`aria-invalid`), so the label, hint and error are announced with it.

	<FormField label="Title" error={errors.title}>
		{#snippet children(attrs)}
			<Input {...attrs} name="title" class={inputClass} value={post.title} required />
		{/snippet}
	</FormField>

	For controls that are not a single input (TagsInput, a group of toggles), the attrs still
	work: TagsInput and ImageField accept `id`, `aria-describedby` and `aria-invalid`.
-->
<script lang="ts" module>
	export type FieldAttrs = {
		id: string;
		'aria-describedby'?: string;
		'aria-invalid'?: 'true';
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Label } from '#lib/components/ui/label/index.js';
	import { hintClass, labelClass } from './styles.ts';

	type Props = {
		label: string;
		children: Snippet<[FieldAttrs]>;
		/** Help text under the control. */
		hint?: string;
		/** Error message; shown in red and marks the control invalid. */
		error?: string | null;
		/** Adds "Optional" after the label. */
		optional?: boolean;
		/** The control's id. Generated when not set. */
		id?: string;
		/** Hide the label visually (it stays for screen readers). */
		hideLabel?: boolean;
		class?: string;
	};

	let {
		label,
		children,
		hint,
		error,
		optional = false,
		id,
		hideLabel = false,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const controlId = $derived(id ?? `field-${uid}`);
	const hintId = $derived(`${controlId}-hint`);
	const errorId = $derived(`${controlId}-error`);

	// One stable object with getters, not a $derived object: when a spread source is replaced,
	// Svelte re-reads every prop of the control, which would wipe text typed into an Input
	// whose `value` isn't bound (e.g. when this field's error appears or clears).
	const attrs: FieldAttrs = {
		get id() {
			return controlId;
		},
		get 'aria-describedby'() {
			return [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
		},
		get 'aria-invalid'() {
			return error ? ('true' as const) : undefined;
		}
	};
</script>

<div class={['flex min-w-0 flex-col gap-1.5', className]}>
	<Label for={controlId} class={[labelClass, hideLabel && 'sr-only'].filter(Boolean).join(' ')}>
		{label}
		{#if optional}<span class="font-normal text-ink-muted">Optional</span>{/if}
	</Label>
	{@render children(attrs)}
	{#if error}
		<p id={errorId} class="m-0 text-xs leading-[18px] text-brand-text">{error}</p>
	{/if}
	{#if hint}
		<p id={hintId} class={['m-0', hintClass]}>{hint}</p>
	{/if}
</div>
