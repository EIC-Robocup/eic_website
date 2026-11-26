<!--
	The admin panel's button: shadcn Button sized to 44px and styled like the admin designs.
	Renders an <a> when `href` is set. While `pending` it is disabled and shows a spinner.

	<AdminButton type="submit" pending={save.pending}>Save project</AdminButton>
	<AdminButton variant="outline" href="/projects/walkie-4" external>Preview</AdminButton>
	<AdminButton variant="ghost" size="sm" onclick={add}>+ Add part</AdminButton>
	<AdminButton variant="ghost" size="icon" aria-label="Remove part"><XIcon /></AdminButton>
-->
<script lang="ts" module>
	export type AdminButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'danger-text';
	export type AdminButtonSize = 'md' | 'sm' | 'icon' | 'icon-sm';
</script>

<script lang="ts">
	import { Button, type ButtonProps } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { cn } from '#lib/utils.js';

	type Props = Omit<ButtonProps, 'variant' | 'size'> & {
		/**
		 * `primary` red fill (one per region), `outline` hairline border, `ghost` muted text,
		 * `danger` red outline for destructive confirmations, `danger-text` red text only
		 * (the "Delete post" link style).
		 */
		variant?: AdminButtonVariant;
		/** `md` 44px (default), `sm` 36px, `icon` 44px square, `icon-sm` 36px square. */
		size?: AdminButtonSize;
		/** Disables the button and shows a spinner, e.g. while its form submits. */
		pending?: boolean;
		/** Text to show while pending, e.g. "Saving". Defaults to the normal label. */
		pendingLabel?: string;
		/** For links that leave the admin: opens in a new tab and adds an ↗. */
		external?: boolean;
	};

	let {
		variant = 'primary',
		size = 'md',
		pending = false,
		pendingLabel,
		external = false,
		disabled,
		href,
		class: className,
		children,
		...rest
	}: Props = $props();

	const base = {
		primary: 'default',
		outline: 'outline',
		ghost: 'ghost',
		danger: 'outline',
		'danger-text': 'ghost'
	} as const;

	const variantClass: Record<AdminButtonVariant, string> = {
		primary: 'hover:bg-brand-hover',
		outline:
			'border-line-strong bg-transparent text-ink shadow-none hover:border-ink hover:bg-transparent dark:border-line-strong dark:bg-transparent dark:hover:border-ink dark:hover:bg-transparent',
		ghost: 'text-ink-muted hover:bg-surface-300 hover:text-ink dark:hover:bg-surface-300',
		danger:
			'border-brand-text/60 bg-transparent text-brand-text shadow-none hover:border-brand-text hover:bg-brand/10 hover:text-brand-text dark:border-brand-text/60 dark:bg-transparent dark:hover:border-brand-text dark:hover:bg-brand/10',
		'danger-text':
			'px-0 text-brand-text hover:bg-transparent hover:text-ink hover:underline dark:hover:bg-transparent'
	};

	const sizeClass: Record<AdminButtonSize, string> = {
		md: 'h-11 gap-2 rounded-sm px-4',
		sm: 'h-9 gap-1.5 rounded-sm px-3',
		icon: 'size-11 rounded-sm',
		'icon-sm': 'size-9 rounded-sm'
	};
</script>

<Button
	variant={base[variant]}
	{href}
	target={href && external ? '_blank' : undefined}
	rel={href && external ? 'noopener noreferrer' : undefined}
	disabled={disabled || pending}
	aria-busy={pending || undefined}
	class={cn(sizeClass[size], variantClass[variant], className)}
	{...rest}
>
	{#if pending}
		<Spinner role="presentation" aria-hidden="true" aria-label="" />
	{/if}
	{#if pending && pendingLabel}
		{pendingLabel}
	{:else}
		{@render children?.()}
	{/if}
	{#if external}
		<span aria-hidden="true">↗</span>
		<span class="sr-only">(opens in a new tab)</span>
	{/if}
</Button>
