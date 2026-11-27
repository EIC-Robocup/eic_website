<!--
	Mono chip with a hairline border and 2px corners: the shadcn Badge with the EIC tag variants.
	tone: 'sunken' (surface-100 fill, project cards), 'raised' (surface-200 fill, post tags),
	'outline' (no fill, line-strong border, 13px: software lists).
	With `href` it is a link. The chip keeps its size, but its tap area grows to at least 44px
	tall (an invisible ::before), so leave about 14px between rows of linked tags.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
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

	/** Half of what the chip lacks to 44px, outside its top and bottom edges. */
	const hitArea =
		"relative min-w-11 overflow-visible before:absolute before:inset-x-0 before:top-[min(0px,calc((100%_-_44px)_/_2))] before:bottom-[min(0px,calc((100%_-_44px)_/_2))] before:content-['']";
</script>

<Badge
	href={href ?? undefined}
	variant={`tag-${tone}` as const}
	size={`tag-${size}` as const}
	class={cn(href && hitArea, className)}
>
	{#if children}{@render children()}{:else}{label}{/if}
</Badge>
