<!--
	A link styled as a button.
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
	import { cn } from '#lib/utils.js';
	import { isExternal } from './format.ts';

	type Props = Omit<HTMLAnchorAttributes, 'href' | 'class' | 'children'> & {
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

	const variants: Record<ButtonVariant, string> = {
		primary: 'bg-brand text-on-brand hover:bg-brand-hover',
		outline: 'border border-line-strong text-ink hover:border-ink',
		light: 'bg-ink text-ink-on-light hover:bg-ink/85',
		'on-brand': 'bg-surface-100 text-on-brand hover:bg-black',
		'on-brand-outline':
			'border border-on-brand text-on-brand hover:bg-on-brand hover:text-ink-on-light'
	};
</script>

<a
	{href}
	target={blank ? '_blank' : undefined}
	rel={external || blank ? 'noopener noreferrer' : undefined}
	{...rest}
	class={cn(
		'inline-flex items-center justify-center gap-2 rounded-sm text-[15px] leading-5 font-medium no-underline transition-colors duration-150',
		size === 'md' ? 'min-h-12 px-[22px]' : 'min-h-11 px-[18px]',
		variants[variant],
		className
	)}
>
	{@render children()}
	{#if blank}<span class="sr-only">(opens in a new tab)</span>{/if}
</a>
