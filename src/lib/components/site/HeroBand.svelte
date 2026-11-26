<!--
	Graph-paper hero band: an optional faint construction circle, the page's content,
	an optional title block row (right aligned), and the ruler strip along the bottom.

	The circle is drawn in a 1440 × `height` viewBox scaled to cover the band, exactly as
	in the artboards (Main: cx 300 cy 380 r 300 h 760; Projects: 1160 320 280 h 640;
	People / About: 1180 360 300 h 700; Blog: 1160 280 260 h 560; Project: 260 300 260 h 900).

	`children` is rendered as is: wrap it in `site-container` and give it the hero padding
	(artboards: pt-16 pb-7, i.e. 64px / 28px).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	type Props = {
		/** Construction circle in viewBox units, or null for none. */
		circle?: { cx: number; cy: number; r: number } | null;
		/** viewBox height (width is always 1440). */
		height?: number;
		children: Snippet;
		/** Usually a <TitleBlock>; rendered right aligned above the ruler. */
		titleBlock?: Snippet;
		/** Element for the band: 'section' (default), 'header' (post header) or 'div'. */
		as?: 'section' | 'header' | 'div';
		/** Show the ruler strip (default true). */
		ruler?: boolean;
		labelledby?: string;
		class?: string;
	};

	let {
		circle = { cx: 1160, cy: 320, r: 280 },
		height = 640,
		children,
		titleBlock,
		as = 'section',
		ruler = true,
		labelledby,
		class: className
	}: Props = $props();
</script>

<svelte:element
	this={as}
	aria-labelledby={labelledby}
	class={cn('relative overflow-hidden bg-graph-paper', className)}
>
	{#if circle}
		<!-- Fades in slowly as the page arrives (data-reveal="slow", see #lib/motion/reveal.ts). -->
		<svg
			aria-hidden="true"
			data-reveal="slow"
			viewBox="0 0 1440 {height}"
			preserveAspectRatio="xMidYMid slice"
			class="pointer-events-none absolute inset-0 size-full"
		>
			<circle
				cx={circle.cx}
				cy={circle.cy}
				r={circle.r}
				fill="none"
				stroke="var(--eic-ink)"
				stroke-opacity="0.06"
			/>
		</svg>
	{/if}
	<div class="relative">
		{@render children()}
	</div>
	{#if titleBlock}
		<div class="relative site-container flex justify-end pt-4 pb-5">
			{@render titleBlock()}
		</div>
	{/if}
	{#if ruler}
		<div aria-hidden="true" class="relative ruler-strip"></div>
	{/if}
</svelte:element>
