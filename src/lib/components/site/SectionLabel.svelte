<!-- Section opener: numbered circle, grey mono label and a short rule. -->
<script lang="ts">
	import { Separator } from '#lib/components/ui/separator/index.js';
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
	<Separator decorative class="bg-line-strong data-horizontal:w-16" />
</div>
