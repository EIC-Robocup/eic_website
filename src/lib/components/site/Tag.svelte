<!--
	Mono chip with a hairline border and 2px corners.
	tone: 'sunken' (surface-100 fill, project cards), 'raised' (surface-200 fill, post tags),
	'outline' (no fill, line-strong border, 13px: software lists).
	With `href` it is a link.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	type Props = {
		label?: string;
		children?: Snippet;
		href?: string | null;
		tone?: 'sunken' | 'raised' | 'outline';
		size?: 'sm' | 'md';
		class?: string;
	};
	let { label, children, href, tone = 'sunken', size = 'sm', class: className }: Props = $props();

	const classes = $derived(
		cn(
			'inline-flex items-center rounded-xs border font-mono text-xs leading-4 text-ink no-underline',
			size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5',
			tone === 'sunken' && 'border-line bg-surface-100',
			tone === 'raised' && 'border-line bg-surface-200',
			tone === 'outline' && 'border-line-strong text-[13px] leading-5',
			href && 'transition-colors duration-150 hover:border-ink',
			className
		)
	);
</script>

{#if href}
	<a {href} class={classes}>{#if children}{@render children()}{:else}{label}{/if}</a>
{:else}
	<span class={classes}>{#if children}{@render children()}{:else}{label}{/if}</span>
{/if}
