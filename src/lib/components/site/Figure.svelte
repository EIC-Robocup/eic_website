<!--
	A framed photo (or image slot) with a "Fig. 01" caption under it, and an optional
	handwritten Note hanging off the bottom left corner, as in the hero artboards.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';
	import ImageSlot from './ImageSlot.svelte';
	import { pad2 } from './format.ts';

	type Props = {
		src?: string | null;
		alt?: string;
		/** Image slot label, e.g. "Photo · Walkie 4 in action". */
		label: string;
		aspect?: string | null;
		/** Figure number: 1 renders "Fig. 01", "02" renders "Fig. 02". */
		fig?: number | string;
		caption?: string | null;
		eager?: boolean;
		/** Frame the image (border and radius). On by default, as in hero figures. */
		rounded?: boolean;
		iconSize?: number;
		/** A <Note> to overlay. Positioned by `noteClass`. */
		note?: Snippet;
		/** Where the note sits. Default: off the bottom left corner (artboard: left -24px, bottom -36px). */
		noteClass?: string;
		class?: string;
		imageClass?: string;
	};

	let {
		src = null,
		alt = '',
		label,
		aspect = '4 / 3',
		fig = 1,
		caption,
		eager = false,
		rounded = true,
		iconSize = 32,
		note,
		noteClass,
		class: className,
		imageClass
	}: Props = $props();
</script>

<figure class={cn('relative m-0 flex min-w-0 flex-col gap-2.5', className)}>
	<ImageSlot {src} {alt} {label} {aspect} {eager} {rounded} {iconSize} class={imageClass} />
	{#if caption}
		<figcaption class="flex items-baseline gap-2.5">
			<span class="text-label shrink-0 text-brand-text">Fig. {pad2(fig)}</span>
			<span class="text-sm text-ink-muted">{caption}</span>
		</figcaption>
	{/if}
	{#if note}
		<div class={cn('absolute -bottom-9 left-0 sm:-left-6', noteClass)}>
			{@render note()}
		</div>
	{/if}
</figure>
