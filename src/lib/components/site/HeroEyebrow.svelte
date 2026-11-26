<!-- Hero eyebrow: red mono label, a short rule, then a grey mono sublabel. -->
<script lang="ts">
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { cn } from '#lib/utils.js';

	type Props = { label: string; sublabel?: string | null; class?: string };
	let { label, sublabel, class: className }: Props = $props();
</script>

<div class={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
	<span class="text-label text-brand-text">{label}</span>
	{#if sublabel}
		<Separator decorative class="bg-line-strong data-horizontal:w-10" />
		<span class="text-label text-ink-muted">{sublabel}</span>
	{/if}
</div>
