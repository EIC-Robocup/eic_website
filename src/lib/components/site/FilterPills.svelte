<!--
	A row of filter pills (toggle buttons with aria-pressed). The selected pill has an ink
	fill. Bind the selected value: <FilterPills label="Filter projects" {options} bind:value />
-->
<script lang="ts" module>
	export type FilterOption = { value: string; label: string; count?: number | null };
</script>

<script lang="ts">
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

	function pick(next: string) {
		if (next === value) return;
		value = next;
		onchange?.(next);
	}
</script>

<div role="group" aria-label={label} class={cn('flex flex-wrap items-center gap-2', className)}>
	{#each options as option (option.value)}
		{@const pressed = option.value === value}
		<button
			type="button"
			aria-pressed={pressed}
			onclick={() => pick(option.value)}
			class={[
				'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm border text-[15px] leading-5 font-medium transition-colors duration-150',
				withCounts ? 'px-[18px]' : 'px-4',
				pressed
					? 'border-ink bg-ink text-ink-on-light'
					: 'border-line-strong bg-surface-200 text-ink hover:border-ink'
			]}
		>
			{option.label}
			{#if option.count != null}<span class="opacity-70">{option.count}</span>{/if}
		</button>
	{/each}
</div>
