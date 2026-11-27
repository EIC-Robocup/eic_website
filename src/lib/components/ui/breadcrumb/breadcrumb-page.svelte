<script lang="ts">
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<!-- EIC: the current page is plain text marked aria-current, not a disabled "link". -->
<span
	bind:this={ref}
	data-slot="breadcrumb-page"
	aria-current="page"
	class={cn("text-foreground font-normal", className)}
	{...restProps}
>
	{@render children?.()}
</span>
