<!--
	The standard section head: SectionLabel, a big heading and an optional "All posts →"
	link on the right (Main, Project, About artboards). The link's tap area is 44px tall; its
	negative margin keeps the row as tall as the text.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';
	import SectionLabel from './SectionLabel.svelte';

	type Props = {
		no?: number | string;
		label: string;
		title: string;
		/** id for the heading, so the section can use aria-labelledby. */
		id?: string;
		level?: 2 | 3;
		/** Right-hand link, e.g. { label: 'All projects →', href: '/projects' }. */
		link?: { label: string; href: string } | null;
		/** Anything else for the right-hand side (replaces the link). */
		aside?: Snippet;
		class?: string;
	};
	let { no, label, title, id, level = 2, link, aside, class: className }: Props = $props();
</script>

<div class={cn('flex flex-wrap items-end justify-between gap-4', className)}>
	<div class="flex min-w-0 flex-col gap-4">
		<SectionLabel {no} {label} />
		<svelte:element
			this={`h${level}`}
			{id}
			class="font-display text-[clamp(40px,4.4vw,56px)] leading-none font-semibold tracking-[-0.025em] text-balance"
			>{title}</svelte:element
		>
	</div>
	{#if aside}
		{@render aside()}
	{:else if link}
		<a
			href={link.href}
			class="-my-2.5 inline-flex min-h-11 items-center text-[15px] font-medium whitespace-nowrap text-brand-text no-underline transition-colors duration-150 hover:text-ink"
			>{link.label}</a
		>
	{/if}
</div>
