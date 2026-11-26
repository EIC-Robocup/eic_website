<!-- The numbered circle that opens a section ("01"). -->
<script lang="ts">
	import { cn } from '#lib/utils.js';
	import { pad2 } from './format.ts';

	type Props = { no: number | string; class?: string };
	let { no, class: className }: Props = $props();
</script>

<span
	class={cn(
		'inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border border-ink font-mono text-xs leading-none font-medium',
		className
	)}>{pad2(no)}</span
>
