<!--
	A photo, or the crop-marked placeholder that stands in until the photo exists.
	`rounded` gives it its own frame (hairline border, 10px radius), as hero and gallery
	figures have; inside a card leave it off and let the card clip the corners.

	Photos from the Supabase media bucket are served through Vercel Image Optimization
	(#lib/image.ts): the slot builds a srcset by itself, so pass `sizes` with the width the slot
	takes on the page, e.g. sizes="(min-width: 1264px) 384px, (min-width: 768px) 33vw, 100vw".
	Site images (/images/...) and other links are used as they are.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';
	import { optimizedSrc, srcset as buildSrcset } from '#lib/image.ts';

	type Props = {
		src?: string | null;
		alt?: string;
		/** Names the shot inside the empty slot, e.g. "Photo · Walkie 4". */
		label: string;
		/** CSS aspect-ratio. `null` lets the parent size it (use `class="h-full"`). */
		aspect?: string | null;
		class?: string;
		/** Own frame: hairline border and rounded-lg corners. */
		rounded?: boolean;
		/** Load at once with high priority (the hero photo). Otherwise lazy. */
		eager?: boolean;
		/** Placeholder icon size in px (artboards use 26 to 36). */
		iconSize?: number;
		/**
		 * How wide the image is shown, for the browser to pick from the srcset. Default '100vw';
		 * pass the real width (cards are much narrower) so phones fetch smaller files.
		 */
		sizes?: string;
		/** Your own srcset. By default one is built for media bucket photos. */
		srcset?: string;
	};

	let {
		src = null,
		alt = '',
		label,
		aspect = '4 / 3',
		class: className,
		rounded = false,
		eager = false,
		iconSize = 32,
		sizes = '100vw',
		srcset
	}: Props = $props();

	const imgSrc = $derived(src ? optimizedSrc(src, 1280) : null);
	const imgSrcset = $derived(srcset ?? (src ? buildSrcset(src) : undefined));
</script>

<div
	class={cn(
		'relative overflow-hidden bg-[#161616] crop-marks',
		rounded && 'rounded-lg border border-line',
		className
	)}
	style:aspect-ratio={aspect ?? undefined}
>
	{#if imgSrc}
		<img
			src={imgSrc}
			{alt}
			srcset={imgSrcset}
			sizes={imgSrcset ? sizes : undefined}
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : undefined}
			decoding="async"
			class="block size-full object-cover"
		/>
	{:else}
		<div
			class="flex size-full flex-col items-center justify-center gap-2.5 p-4 text-center text-ink-muted"
		>
			<svg
				width={iconSize}
				height={iconSize}
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--eic-line-strong)"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				class="shrink-0"
			>
				<rect x="3" y="5" width="18" height="14" rx="2" />
				<circle cx="9" cy="10" r="1.6" />
				<path d="M21 16 L15 11 L6 19" />
			</svg>
			<span class="text-label">{label}</span>
		</div>
	{/if}
</div>
