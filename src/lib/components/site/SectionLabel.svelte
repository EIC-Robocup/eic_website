<!-- Section opener: numbered circle, grey mono label and a short rule. -->
<script lang="ts">
	import { cn } from '#lib/utils.js';
	import SecNo from './SecNo.svelte';

	type Props = {
		/** Section number; 1 renders as "01". Leave out for a label without the circle. */
		no?: number | string;
		label: string;
		class?: string;
	};
	let { no, label, class: className }: Props = $props();
</script>

<div class={cn('flex items-center gap-3', className)}>
	{#if no !== undefined && no !== ''}<SecNo {no} />{/if}
	<span class="text-label text-ink-muted">{label}</span>
	<span aria-hidden="true" class="h-px w-16 shrink-0 bg-line-strong"></span>
</div>
