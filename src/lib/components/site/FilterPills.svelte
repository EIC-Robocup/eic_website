<!--
	A row of filter pills: the shadcn ToggleGroup (single choice, arrow keys move between pills)
	with the EIC pill style. The selected pill has an ink fill. One pill is always selected:
	clicking the selected pill again does nothing.
	Bind the selected value: <FilterPills label="Filter projects" {options} bind:value />

	When the server can filter too, pass `href` (the URL that shows each option): until the page
	is interactive, and without JavaScript, the pills are plain links to those URLs, in the same
	style, with aria-current on the selected one.
-->
<script lang="ts" module>
	export type FilterOption = { value: string; label: string; count?: number | null };
</script>

<script lang="ts">
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { toggleVariants } from '#lib/components/ui/toggle/index.js';
	import { cn } from '#lib/utils.js';
	import { focusedIndex, refocus, useHydrated } from './hydrated.svelte.ts';

	type Props = {
		/** Accessible name of the group, e.g. "Filter projects". */
		label: string;
		options: FilterOption[];
		value: string;
		/** Called after the value changes. */
		onchange?: (value: string) => void;
		/** The page that shows `value`, for the links used before the page is interactive. */
		href?: (value: string) => string;
		class?: string;
	};

	let { label, options, value = $bindable(), onchange, href, class: className }: Props = $props();

	/** The links shown until the page is interactive, then the ToggleGroup. */
	let links: HTMLElement | null = $state(null);
	let group: HTMLElement | null = $state(null);
	// A focused link hands focus to the pill for the same option.
	const hydrated = useHydrated(() => refocus(focusedIndex(links), () => group));
	const withCounts = $derived(options.some((o) => o.count != null));
	const groupClass = $derived(cn('w-auto flex-wrap rounded-none', className));

	function pick(next: string | undefined) {
		// The group reports '' when the selected pill is pressed again: keep the selection.
		if (!next || next === value) return;
		value = next;
		onchange?.(next);
	}
</script>

{#snippet text(option: FilterOption)}
	{option.label}
	{#if option.count != null}<span class="opacity-70">{option.count}</span>{/if}
{/snippet}

{#if href && !hydrated.current}
	<!-- Same look as the ToggleGroup: data-state drives the pill variant's selected style. -->
	<ul bind:this={links} aria-label={label} class={cn('m-0 flex list-none items-center gap-2 p-0', groupClass)}>
		{#each options as option (option.value)}
			{@const selected = option.value === value}
			<li>
				<a
					href={href(option.value)}
					aria-current={selected ? 'page' : undefined}
					data-state={selected ? 'on' : 'off'}
					class={cn(
						toggleVariants({ variant: 'pill', size: 'pill' }),
						'no-underline',
						withCounts && 'px-[18px]'
					)}
				>
					{@render text(option)}
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<ToggleGroup.Root
		bind:ref={group}
		type="single"
		variant="pill"
		size="pill"
		spacing={2}
		aria-label={label}
		bind:value={() => value, pick}
		class={groupClass}
	>
		{#each options as option (option.value)}
			<ToggleGroup.Item value={option.value} class={withCounts ? 'px-[18px]' : undefined}>
				{@render text(option)}
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
{/if}
