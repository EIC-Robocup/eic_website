<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	/*
	 * EIC public site: tags are mono 12px chips with 2px corners and a hairline border; the
	 * status badge is a coloured dot plus a mono uppercase word (the `text-label` style, written
	 * out here so class merging keeps it). Both use the site's own focus ring when they are links.
	 */
	const tag =
		"h-auto rounded-xs font-mono text-xs leading-4 font-normal text-ink no-underline whitespace-normal transition-colors duration-150 focus-visible:ring-0 [a]:hover:border-ink";
	const status =
		"h-auto gap-1.5 rounded-none border-0 bg-transparent p-0 font-mono text-xs leading-4 font-medium tracking-[0.08em] uppercase overflow-visible";

	export const badgeVariants = tv({
		base: "h-5 gap-1 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none",
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
				secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
				destructive: "bg-destructive/10 [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive dark:bg-destructive/20",
				outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
				ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
				link: "text-primary underline-offset-4 hover:underline",
				/* EIC site tags (pair with the tag-sm / tag-md sizes) */
				/** surface-100 fill: project card chips. */
				"tag-sunken": `${tag} border-line bg-surface-100 focus-visible:border-line`,
				/** surface-200 fill: post tags. */
				"tag-raised": `${tag} border-line bg-surface-200 focus-visible:border-line`,
				/** No fill, line-strong border, 13px: software lists. */
				"tag-outline": `${tag} border-line-strong bg-transparent text-[13px] leading-5 focus-visible:border-line-strong`,
				/* EIC site status: dot plus word */
				/** Green: Ongoing, Active, Recruiting. */
				"status-success": `${status} text-success`,
				/** Grey: Archived. */
				"status-muted": `${status} text-ink-muted`,
			},
			size: {
				default: "",
				/** Tag chip: 4px by 8px padding. */
				"tag-sm": "px-2 py-1",
				/** Larger tag chip: 6px by 10px padding (post tags, software). */
				"tag-md": "px-2.5 py-1.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
	export type BadgeSize = VariantProps<typeof badgeVariants>["size"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = "default",
		size = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
		size?: BadgeSize;
	} = $props();
</script>

<svelte:element
	this={href ? "a" : "span"}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant, size }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
