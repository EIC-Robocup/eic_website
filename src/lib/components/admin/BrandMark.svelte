<!--
	The EIC mark, with a mono sublabel beside it. Read out as "EIC Chula".
	Used at the top of the admin sidebar, in the mobile top bar and on the sign in card.
-->
<script lang="ts">
	import EicMark from '#lib/components/site/EicMark.svelte';

	type Props = {
		/** `md`: 24px mark (sidebar). `lg`: 28px mark (sign in card). `sm`: 20px (top bar). */
		size?: 'sm' | 'md' | 'lg';
		/** Grey mono label beside the mark. Pass an empty string to hide it. */
		sublabel?: string;
		/** Turns the mark into a link. */
		href?: string;
		class?: string;
	};

	let { size = 'md', sublabel = 'Content editor', href, class: className }: Props = $props();

	const mark = $derived(size === 'lg' ? 'h-7' : size === 'md' ? 'h-6' : 'h-5');
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class={['flex min-w-0 items-center gap-3 text-ink no-underline', href && 'min-h-11 rounded-sm', className]}
>
	<EicMark class={['w-auto shrink-0', mark].join(' ')} />
	<span class="sr-only">EIC Chula</span>
	{#if sublabel}
		<span
			class="min-w-0 truncate border-l border-line pl-3 font-mono text-[10px] leading-3.5 tracking-[0.1em] text-ink-muted uppercase"
		>
			{sublabel}
		</span>
	{/if}
</svelte:element>
