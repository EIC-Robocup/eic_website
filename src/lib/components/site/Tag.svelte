<!--
	Mono chip with a hairline border and 2px corners: the shadcn Badge with the EIC tag variants.
	tone: 'sunken' (surface-100 fill, project cards), 'raised' (surface-200 fill, post tags),
	'outline' (no fill, line-strong border, 13px: software lists).
	With `href` it is a link.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';

	type Props = {
		label?: string;
		children?: Snippet;
		href?: string | null;
		tone?: 'sunken' | 'raised' | 'outline';
		size?: 'sm' | 'md';
		class?: string;
	};
	let { label, children, href, tone = 'sunken', size = 'sm', class: className }: Props = $props();
</script>

<Badge href={href ?? undefined} variant={`tag-${tone}` as const} size={`tag-${size}` as const} class={className}>
	{#if children}{@render children()}{:else}{label}{/if}
</Badge>
