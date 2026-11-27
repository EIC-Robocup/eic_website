<!--
	A link styled as a button: the shadcn Button (which renders an <a> when given `href`)
	with the EIC site variants and sizes.
	primary: EIC red. outline: line-strong border. light: ink fill with dark text.
	on-brand: dark fill on a red band. on-brand-outline: white border on a red band.
	Off-site http(s) links open in a new tab with rel="noopener noreferrer".
-->
<script lang="ts" module>
	export type ButtonVariant = 'primary' | 'outline' | 'light' | 'on-brand' | 'on-brand-outline';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import {
		Button,
		type ButtonProps,
		type ButtonVariant as UiVariant
	} from '#lib/components/ui/button/index.js';
	import { isExternal } from './format.ts';

	type Props = Omit<HTMLAnchorAttributes, 'href' | 'class' | 'children' | 'type'> & {
		href: string;
		variant?: ButtonVariant;
		/** 'md' is 48px tall (page buttons), 'sm' is 44px (nav, share buttons). */
		size?: 'sm' | 'md';
		/** Open in a new tab. Defaults to true for off-site http(s) links. */
		newTab?: boolean;
		class?: string;
		children: Snippet;
	};

	let {
		href,
		variant = 'primary',
		size = 'md',
		newTab,
		class: className,
		children,
		...rest
	}: Props = $props();

	const external = $derived(isExternal(href));
	const blank = $derived(newTab ?? external);

	const VARIANTS: Record<ButtonVariant, UiVariant> = {
		primary: 'brand',
		outline: 'outline-ink',
		light: 'light',
		'on-brand': 'on-brand',
		'on-brand-outline': 'on-brand-outline'
	};
</script>

<Button
	{href}
	variant={VARIANTS[variant]}
	size={size === 'md' ? 'site-lg' : 'site-md'}
	target={blank ? '_blank' : undefined}
	rel={external || blank ? 'noopener noreferrer' : undefined}
	{...rest as ButtonProps}
	class={className}
>
	{@render children()}
	{#if blank}<span class="sr-only">(opens in a new tab)</span>{/if}
</Button>
