<!--
	One icon button of the Markdown editor's toolbar: a 36px ghost shadcn Button with a tooltip
	that names it and shows its shortcut (shadcn Kbd). Extra props (for example the props a
	DropdownMenu.Trigger hands its child) are merged onto the button.

	<ToolButton label="Bold" icon={BoldIcon} keys={['Ctrl', 'B']} onclick={bold} />
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import { mergeProps } from 'bits-ui';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Kbd, KbdGroup } from '#lib/components/ui/kbd/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		/** Accessible name and tooltip text. */
		label: string;
		icon: Component<{ class?: string; 'aria-hidden'?: 'true' }>;
		/** Shortcut keys shown in the tooltip, e.g. ['Ctrl', 'B']. */
		keys?: string[];
		/** `aria-keyshortcuts`, e.g. "Control+B Meta+B". */
		shortcut?: string;
		/** For toggles (Fullscreen): announced as pressed. */
		pressed?: boolean;
		disabled?: boolean;
		tabindex?: number;
		onclick?: (event: MouseEvent) => void;
		class?: string;
		[key: string]: unknown;
	};

	let {
		label,
		icon: Icon,
		keys,
		shortcut,
		pressed,
		disabled = false,
		tabindex,
		onclick,
		class: className,
		...rest
	}: Props = $props();

	// Keep the textarea's focus and selection when a tool is clicked with the mouse.
	function onmousedown(event: MouseEvent) {
		event.preventDefault();
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button
				{...mergeProps(props, rest, { onmousedown, onclick })}
				type="button"
				variant="ghost"
				size="icon"
				data-tool=""
				{tabindex}
				{disabled}
				aria-label={label}
				aria-keyshortcuts={shortcut}
				aria-pressed={pressed === undefined ? undefined : pressed}
				class={cn(
					'size-9 rounded-sm text-ink-muted hover:bg-surface-300 hover:text-ink aria-pressed:bg-surface-300 aria-pressed:text-ink dark:hover:bg-surface-300 [&_svg]:size-[17px]',
					className
				)}
			>
				<Icon aria-hidden="true" />
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content side="bottom" sideOffset={4}>
		{label}
		{#if keys?.length}
			<KbdGroup>
				{#each keys as key (key)}<Kbd>{key}</Kbd>{/each}
			</KbdGroup>
		{/if}
	</Tooltip.Content>
</Tooltip.Root>
