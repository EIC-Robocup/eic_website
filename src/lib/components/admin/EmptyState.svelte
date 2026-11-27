<!--
	For lists with nothing in them yet: a dashed box with an icon, a title, one line of
	help and an action.

	<EmptyState icon={NewspaperIcon} title="No posts yet" description="Write the first lab note.">
		{#snippet actions()}<AdminButton href="/admin/posts/new">New post</AdminButton>{/snippet}
	</EmptyState>
-->
<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		title: string;
		description?: string;
		/** A Lucide icon component, e.g. `import NewspaperIcon from '@lucide/svelte/icons/newspaper'`. */
		icon?: Component<{ class?: string; 'aria-hidden'?: 'true' }>;
		actions?: Snippet;
		/** Less padding, for empty states inside a Panel. */
		compact?: boolean;
		class?: string;
	};

	let { title, description, icon: Icon, actions, compact = false, class: className }: Props = $props();
</script>

<Empty.Root
	class={cn(
		'rounded-lg border border-dashed border-line-strong bg-surface-200/40',
		compact ? 'gap-3 p-6' : 'p-8 sm:p-12',
		className
	)}
>
	<Empty.Header>
		{#if Icon}
			<Empty.Media variant="icon" class="bg-surface-300 text-ink-muted">
				<Icon aria-hidden="true" />
			</Empty.Media>
		{/if}
		<Empty.Title class="font-display text-lg font-semibold text-ink">{title}</Empty.Title>
		{#if description}
			<Empty.Description class="text-sm leading-[22px] text-ink-muted">{description}</Empty.Description>
		{/if}
	</Empty.Header>
	{#if actions}
		<Empty.Content class="flex-row flex-wrap justify-center gap-2.5">
			{@render actions()}
		</Empty.Content>
	{/if}
</Empty.Root>
