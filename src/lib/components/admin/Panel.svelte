<!--
	A surface-200 card with a hairline border and 10px corners: the admin's main container.
	Optional header with a red mono number ("01"), a Space Grotesk title, a hint, and actions.

	<Panel number="02" title="Numbers" description="Shown under the hero.">
		{#snippet actions()}<AdminButton variant="ghost" size="sm">+ Add number</AdminButton>{/snippet}
		...fields...
	</Panel>

	<Panel padding="none" title="Recent edits">  table rows run edge to edge  </Panel>
	<Panel size="sm" title="Publishing">  the narrower aside panels  </Panel>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title?: string;
		/** A hint beside or under the title (12/18 muted). */
		description?: string;
		/** Red mono label before the title, e.g. "01". */
		number?: string;
		/** Buttons on the right of the header. */
		actions?: Snippet;
		/** Replaces the whole header (title, description and actions). */
		header?: Snippet;
		children?: Snippet;
		/** `default` 22px padding, `sm` 18px (aside panels), `none` for tables and lists. */
		padding?: 'default' | 'sm' | 'none';
		/** `md` 18px titles (default), `sm` 16px (aside panels). */
		size?: 'md' | 'sm';
		/** Put the description under the title instead of on the right (automatic when there are actions). */
		stacked?: boolean;
		/** Heading level of the title. */
		level?: 2 | 3;
		/** The element: `section` (default), `div`, `aside` or `article`. Panels with a title are labelled by it. */
		as?: 'section' | 'div' | 'aside' | 'article';
		id?: string;
		class?: string;
	};

	let {
		title,
		description,
		number,
		actions,
		header,
		children,
		padding = 'default',
		size = 'md',
		stacked = false,
		level = 2,
		as = 'section',
		id,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const headingId = $derived(`${id ?? uid}-title`);
	const hasHeader = $derived(Boolean(header || title || actions || description));
	const isStacked = $derived(stacked || Boolean(description && actions));
	const pad = $derived(padding === 'none' ? '' : padding === 'sm' ? 'p-[18px]' : 'p-4 sm:p-[22px]');
	const gap = $derived(padding === 'sm' ? 'gap-3.5' : 'gap-4 sm:gap-[18px]');
</script>

<svelte:element
	this={as}
	{id}
	aria-labelledby={title ? headingId : undefined}
	class={[
		'flex min-w-0 flex-col rounded-lg border border-line bg-surface-200 text-ink',
		pad,
		padding !== 'none' && gap,
		padding === 'none' && 'overflow-hidden',
		className
	]}
>
	{#if hasHeader}
		<div
			class={[
				'flex flex-wrap items-center justify-between gap-x-3 gap-y-2',
				padding === 'none' && 'px-4 py-4 sm:px-[18px]'
			]}
		>
			{#if header}
				{@render header()}
			{:else}
				<div class={['flex min-w-0 gap-x-2.5 gap-y-0.5', isStacked ? 'flex-col' : 'flex-wrap items-center']}>
					{#if title}
						<div class="flex items-center gap-2.5">
							{#if number}<span class="text-label text-brand-text">{number}</span>{/if}
							<svelte:element
								this={`h${level}`}
								id={headingId}
								class={[
									'm-0 font-display font-semibold tracking-[-0.01em] text-ink',
									size === 'sm' ? 'text-base leading-6' : 'text-lg leading-6'
								]}
							>
								{title}
							</svelte:element>
						</div>
					{/if}
					{#if description && isStacked}
						<p class="m-0 text-xs leading-[18px] text-ink-muted">{description}</p>
					{/if}
				</div>
				{#if description && !isStacked}
					<p class="m-0 text-xs leading-[18px] text-ink-muted">{description}</p>
				{/if}
				{#if actions}
					<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
				{/if}
			{/if}
		</div>
	{/if}
	{@render children?.()}
</svelte:element>
