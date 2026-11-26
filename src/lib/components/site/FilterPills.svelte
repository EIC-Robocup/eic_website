<!--
	A row of filter pills: the shadcn ToggleGroup (single choice, arrow keys move between pills)
	with the EIC pill style. The selected pill has an ink fill. One pill is always selected:
	clicking the selected pill again does nothing.
	Bind the selected value: <FilterPills label="Filter projects" {options} bind:value />
-->
<script lang="ts" module>
	export type FilterOption = { value: string; label: string; count?: number | null };
</script>

<script lang="ts">
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		/** Accessible name of the group, e.g. "Filter projects". */
		label: string;
		options: FilterOption[];
		value: string;
		/** Called after the value changes. */
		onchange?: (value: string) => void;
		class?: string;
	};

	let { label, options, value = $bindable(), onchange, class: className }: Props = $props();

	const withCounts = $derived(options.some((o) => o.count != null));

	function pick(next: string | undefined) {
		// The group reports '' when the selected pill is pressed again: keep the selection.
		if (!next || next === value) return;
		value = next;
		onchange?.(next);
	}
</script>

<ToggleGroup.Root
	type="single"
	variant="pill"
	size="pill"
	spacing={2}
	aria-label={label}
	bind:value={() => value, pick}
	class={cn('w-auto flex-wrap rounded-none', className)}
>
	{#each options as option (option.value)}
		<ToggleGroup.Item value={option.value} class={withCounts ? 'px-[18px]' : undefined}>
			{option.label}
			{#if option.count != null}<span class="opacity-70">{option.count}</span>{/if}
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
