<!--
	The EIC gear on its ink badge, the "EIC Chula" wordmark and a mono sublabel.
	Used at the top of the admin sidebar, in the mobile top bar and on the sign in card.
-->
<script lang="ts">
	import logo from '#lib/components/site/assets/eic-logo-128.webp';

	type Props = {
		/** `md`: 36px badge (sidebar). `lg`: 44px badge (sign in card). `sm`: 32px (top bar). */
		size?: 'sm' | 'md' | 'lg';
		/** Grey mono line under the wordmark. Pass an empty string to hide it. */
		sublabel?: string;
		/** Turns the mark into a link. */
		href?: string;
		class?: string;
	};

	let { size = 'md', sublabel = 'Content editor', href, class: className }: Props = $props();

	const badge = $derived(
		size === 'lg' ? 'size-11 rounded-[10px]' : size === 'md' ? 'size-9 rounded-lg' : 'size-8 rounded-md'
	);
	const img = $derived(size === 'lg' ? 'size-10' : size === 'md' ? 'size-[33px]' : 'size-[29px]');
	const word = $derived(size === 'lg' ? 'text-xl' : size === 'md' ? 'text-[17px]' : 'text-base');
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class={['flex min-w-0 items-center gap-2.5 text-ink no-underline', href && 'min-h-11 rounded-sm', className]}
>
	<span class={['flex shrink-0 items-center justify-center overflow-hidden bg-ink', badge]}>
		<img src={logo} alt="" width="40" height="40" class={['block', img]} />
	</span>
	<span class="flex min-w-0 flex-col gap-px">
		<span class={['font-display leading-tight font-semibold tracking-[-0.01em]', word]}>EIC Chula</span>
		{#if sublabel}
			<span class="truncate font-mono text-[10px] leading-3.5 tracking-[0.1em] text-ink-muted uppercase">
				{sublabel}
			</span>
		{/if}
	</span>
</svelte:element>
