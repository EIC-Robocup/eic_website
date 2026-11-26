<!--
	A handwritten note (Caveat, brand-text) with a curved arrow pointing at what it talks
	about. At most one per section. Position it from the page (usually absolutely).
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';

	type Arrow = 'down-right' | 'down-left' | 'right' | 'left';
	type Props = {
		text: string;
		arrow?: Arrow;
		/** Rotation in degrees (artboards use -3 to -6). */
		rot?: number;
		class?: string;
	};

	let { text, arrow = 'down-right', rot = -5, class: className }: Props = $props();

	const row = $derived(arrow === 'right' || arrow === 'left');
</script>

<div
	class={cn(
		'pointer-events-none inline-flex gap-1.5',
		row ? 'items-center' : arrow === 'down-left' ? 'items-end' : 'items-start',
		arrow === 'left' ? 'flex-row-reverse' : row ? 'flex-row' : 'flex-col',
		className
	)}
	style:transform="rotate({rot}deg)"
>
	<span
		class="font-hand text-[26px] leading-none font-semibold whitespace-nowrap text-brand-text sm:text-[30px]"
		>{text}</span
	>
	{#if arrow === 'down-right'}
		<svg
			class="h-[50px] w-[83px] shrink-0 sm:h-[58px] sm:w-24"
			viewBox="0 0 96 58"
			aria-hidden="true"
			fill="none"
			stroke="var(--eic-brand-text)"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M10 4 C18 34 46 48 84 46" /><path d="M72 37 L85 46 L72 54" /></svg
		>
	{:else if arrow === 'down-left'}
		<svg
			class="h-[50px] w-[83px] shrink-0 sm:h-[58px] sm:w-24"
			viewBox="0 0 96 58"
			aria-hidden="true"
			fill="none"
			stroke="var(--eic-brand-text)"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M86 4 C78 34 50 48 12 46" /><path d="M24 37 L11 46 L24 54" /></svg
		>
	{:else if arrow === 'right'}
		<svg
			class="h-[35px] w-[83px] shrink-0 sm:h-10 sm:w-24"
			viewBox="0 0 96 40"
			aria-hidden="true"
			fill="none"
			stroke="var(--eic-brand-text)"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M4 24 C28 4 56 40 84 18" /><path d="M72 12 L86 17 L76 28" /></svg
		>
	{:else}
		<svg
			class="h-[35px] w-[83px] shrink-0 sm:h-10 sm:w-24"
			viewBox="0 0 96 40"
			aria-hidden="true"
			fill="none"
			stroke="var(--eic-brand-text)"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M92 24 C68 4 40 40 12 18" /><path d="M24 12 L10 17 L20 28" /></svg
		>
	{/if}
</div>
