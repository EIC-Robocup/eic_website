<!--
	The sign in card (AdminLogin design): graph paper behind a centred 400px surface-200 card
	with the brand mark, a title and a line of text. Used by /admin/login and /auth/confirm.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import BrandMark from './BrandMark.svelte';

	type Props = {
		title: string;
		description?: string;
		children?: Snippet;
		/** Under the card, centred. */
		footer?: Snippet;
	};

	let { title, description, children, footer }: Props = $props();
</script>

<main id="main" class="flex min-h-dvh items-center justify-center bg-graph-paper px-4 py-12 sm:px-6">
	<div class="flex w-full max-w-[400px] flex-col gap-5">
		<div class="flex flex-col gap-[18px] rounded-[12px] border border-line bg-surface-200 p-6 sm:p-8">
			<BrandMark size="lg" />
			<div class="flex flex-col gap-1">
				<h1 class="m-0 font-display text-[26px] leading-8 font-semibold tracking-[-0.015em] text-ink">
					{title}
				</h1>
				{#if description}
					<p class="m-0 text-sm leading-[22px] text-ink-muted">{description}</p>
				{/if}
			</div>
			{@render children?.()}
		</div>
		{#if footer}
			<div class="text-center text-[13px] leading-5 text-ink-muted">{@render footer()}</div>
		{/if}
	</div>
</main>
