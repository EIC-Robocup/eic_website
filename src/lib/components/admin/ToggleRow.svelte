<!--
	A labelled on/off switch row: name and hint on the left, a 40×24 switch on the right
	(red when on). With `name`, the form submits `name=on` when it is on and nothing when it
	is off; read it on the server with `readBool(form, name)` from form-data.ts.

	<ToggleRow name="published" label="Published" hint="Listed on the Projects page" checked={project.published} />
	<ToggleRow label="Show the gallery" bind:checked={showGallery} divided />
-->
<script lang="ts">
	import { Switch } from '#lib/components/ui/switch/index.js';

	type Props = {
		label: string;
		hint?: string;
		/** Form field name. */
		name?: string;
		checked?: boolean;
		disabled?: boolean;
		/** A hairline above the row, for lists of toggles. */
		divided?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		id?: string;
		class?: string;
	};

	let {
		label,
		hint,
		name,
		checked = $bindable(false),
		disabled = false,
		divided = false,
		onCheckedChange,
		id,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const switchId = $derived(id ?? `toggle-${uid}`);
</script>

<div
	class={[
		'flex items-center justify-between gap-4',
		divided && 'border-t border-line pt-3.5',
		className
	]}
>
	<label for={switchId} class="flex min-w-0 flex-col gap-0.5">
		<span class="text-sm leading-5 font-medium text-ink">{label}</span>
		{#if hint}<span id="{switchId}-hint" class="text-xs leading-[18px] text-ink-muted">{hint}</span>{/if}
	</label>
	<Switch
		id={switchId}
		{name}
		bind:checked
		{disabled}
		{onCheckedChange}
		aria-describedby={hint ? `${switchId}-hint` : undefined}
		class="h-6 w-10 px-[2px] data-unchecked:bg-line dark:data-unchecked:bg-line [&>[data-slot=switch-thumb]]:size-[18px]! [&>[data-slot=switch-thumb]]:bg-white! data-checked:[&>[data-slot=switch-thumb]]:translate-x-4!"
	/>
</div>
