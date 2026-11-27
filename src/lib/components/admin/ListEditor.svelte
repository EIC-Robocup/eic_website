<!--
	Repeatable rows for lists of objects (numbers on the home page, systems and parts of a
	project, gallery images...). You render each row's fields; it adds the Move up, Move down
	and Remove buttons, an Add button, a numbered label if asked, and a hidden JSON field.

	<script lang="ts">
		let systems = $state(structuredClone(data.project.systems));
	</script>

	<ListEditor bind:items={systems} name="systems" itemLabel="system" numbered max={8}
		create={() => ({ title: '', description: '' })}>
		{#snippet row(item, index)}
			<Input class={inputClass} aria-label="System {index + 1} name" bind:value={item.title} />
			<Input class={inputClass} aria-label="System {index + 1} description" bind:value={item.description} />
		{/snippet}
	</ListEditor>

	On the server: `readJson(form, 'systems')` from form-data.ts, then validate each item.
	`items` must be $state (or bound from $state) so edits inside rows are tracked.
-->
<script lang="ts" generics="T extends object">
	import { tick, type Snippet } from 'svelte';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import XIcon from '@lucide/svelte/icons/x';
	import AdminButton from './AdminButton.svelte';

	type Props = {
		/** The rows. Bindable; pass $state so field edits are reactive. */
		items: T[];
		/** Fields of one row. `item` is the row object, so `bind:value={item.title}` works. */
		row: Snippet<[item: T, index: number]>;
		/** A new, empty row for the Add button. */
		create: () => T;
		/** Submits the rows as JSON in a hidden field with this name. */
		name?: string;
		/** Singular noun for buttons and labels: "Add part", "Remove part 3". */
		itemLabel?: string;
		/** Text of the Add button. Defaults to "+ Add {itemLabel}". */
		addLabel?: string;
		/** Most rows allowed. */
		max?: number;
		/** Fewest rows allowed (Remove is disabled at this count). */
		min?: number;
		/** Show "01", "02"... in red mono before each row. */
		numbered?: boolean;
		/** Show the Move up and Move down buttons. */
		reorderable?: boolean;
		/** Where the Add button goes. Use `none` and call `add()` (bind:this) to put it in a Panel header. */
		addPosition?: 'bottom' | 'none';
		/**
		 * Column headings above the rows, laid out like the row snippet. Shown from `sm` up
		 * (see `headerClass`); below that, label each field in the row with `rowLabelClass`.
		 */
		header?: Snippet;
		/** Where the header row shows. Default `hidden sm:flex`; use a container query for rows that do. */
		headerClass?: string;
		/** Shown when there are no rows. */
		empty?: Snippet;
		/** Classes for each row's field area, e.g. "grid gap-2.5 sm:grid-cols-[140px_1fr]". */
		rowClass?: string;
		/** After every add, remove or move. */
		onchange?: (items: T[]) => void;
		class?: string;
	};

	let {
		items = $bindable(),
		row,
		create,
		name,
		itemLabel = 'item',
		addLabel,
		max = Infinity,
		min = 0,
		numbered = false,
		reorderable = true,
		addPosition = 'bottom',
		header,
		headerClass = 'hidden sm:flex',
		empty,
		rowClass = 'grid min-w-0 flex-1 gap-2.5 sm:auto-cols-fr sm:grid-flow-col',
		onchange,
		class: className
	}: Props = $props();

	let list: HTMLElement | undefined = $state();
	let addButton: HTMLElement | null = $state(null);
	let announcement = $state('');

	// Stable keys for rows, so moving a row moves its DOM (and focus) with it.
	const keys = new WeakMap<object, number>();
	let nextKey = 0;
	function keyOf(item: T): number {
		let key = keys.get(item);
		if (key === undefined) {
			key = nextKey++;
			keys.set(item, key);
		}
		return key;
	}

	const canAdd = $derived(items.length < max);
	const pad = (n: number) => String(n).padStart(2, '0');

	function changed() {
		onchange?.(items);
	}

	/** Add an empty row at the end and focus its first field. */
	export async function add() {
		if (!canAdd) return;
		items.push(create());
		changed();
		announcement = `Added ${itemLabel} ${items.length}`;
		await tick();
		const rows = list?.querySelectorAll<HTMLElement>('[data-list-row]');
		rows?.[rows.length - 1]?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
	}

	async function remove(index: number) {
		if (items.length <= min) return;
		items.splice(index, 1);
		changed();
		announcement = `Removed ${itemLabel} ${index + 1}`;
		await tick();
		const rows = list?.querySelectorAll<HTMLElement>('[data-list-row]');
		const target = rows?.[Math.min(index, (rows?.length ?? 1) - 1)];
		(target?.querySelector<HTMLElement>('[data-remove]') ?? addButton)?.focus();
	}

	async function move(index: number, by: -1 | 1, event: MouseEvent) {
		const to = index + by;
		if (to < 0 || to >= items.length) return;
		const [item] = items.splice(index, 1);
		items.splice(to, 0, item);
		changed();
		announcement = `Moved ${itemLabel} to position ${to + 1}`;
		// Keep focus on the same button of the moved row (or the other one at the ends).
		const which = (event.currentTarget as HTMLElement).dataset.move;
		await tick();
		const moved = list?.querySelectorAll<HTMLElement>('[data-list-row]')[to];
		const same = moved?.querySelector<HTMLButtonElement>(`[data-move="${which}"]`);
		const other = moved?.querySelector<HTMLButtonElement>(`[data-move="${which === 'up' ? 'down' : 'up'}"]`);
		(same && !same.disabled ? same : other)?.focus();
	}
</script>

<div class={['flex min-w-0 flex-col gap-2.5', className]}>
	{#if header && items.length}
		<div class={['items-center gap-2', headerClass]} aria-hidden="true">
			{#if numbered}<span class="w-7 shrink-0"></span>{/if}
			<div class={['text-label min-w-0 flex-1 text-[11px] text-ink-muted', rowClass]}>{@render header()}</div>
			<span class={['shrink-0', reorderable ? 'w-[140px]' : 'w-11']}></span>
		</div>
	{/if}

	<ol bind:this={list} class="m-0 flex list-none flex-col gap-2.5 p-0">
		{#each items as item, index (keyOf(item))}
			<li data-list-row class="flex flex-wrap items-start gap-2 sm:flex-nowrap sm:items-center">
				{#if numbered}
					<!-- On phones, level with the field labels when there are any, else with the first field. -->
					<span class={['text-label w-7 shrink-0 text-brand-text', !header && 'pt-3.5 sm:pt-0']} aria-hidden="true">
						{pad(index + 1)}
					</span>
				{/if}
				<div
					class={[
						'min-w-0 sm:flex-1 sm:basis-auto',
						numbered ? 'basis-[calc(100%-2.25rem)]' : 'basis-full',
						rowClass
					]}
				>
					{@render row(item, index)}
				</div>
				<div class="ml-auto flex shrink-0 items-center gap-1">
					{#if reorderable}
						<AdminButton
							variant="ghost"
							size="icon"
							data-move="up"
							aria-label="Move {itemLabel} {index + 1} up"
							disabled={index === 0}
							onclick={(e: MouseEvent) => move(index, -1, e)}
						>
							<ArrowUpIcon aria-hidden="true" />
						</AdminButton>
						<AdminButton
							variant="ghost"
							size="icon"
							data-move="down"
							aria-label="Move {itemLabel} {index + 1} down"
							disabled={index === items.length - 1}
							onclick={(e: MouseEvent) => move(index, 1, e)}
						>
							<ArrowDownIcon aria-hidden="true" />
						</AdminButton>
					{/if}
					<AdminButton
						variant="ghost"
						size="icon"
						data-remove
						aria-label="Remove {itemLabel} {index + 1}"
						disabled={items.length <= min}
						onclick={() => remove(index)}
					>
						<XIcon aria-hidden="true" />
					</AdminButton>
				</div>
			</li>
		{/each}
	</ol>

	{#if !items.length}
		{#if empty}
			{@render empty()}
		{:else}
			<p class="m-0 rounded-sm border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-muted">
				No {itemLabel}s yet.
			</p>
		{/if}
	{/if}

	{#if addPosition === 'bottom'}
		<div class="flex flex-wrap items-center gap-3">
			<AdminButton bind:ref={addButton} variant="outline" size="sm" disabled={!canAdd} onclick={add}>
				{addLabel ?? `+ Add ${itemLabel}`}
			</AdminButton>
			{#if Number.isFinite(max)}
				<span class="text-xs text-ink-muted">{items.length} of {max}</span>
			{/if}
		</div>
	{/if}

	{#if name}<input type="hidden" {name} value={JSON.stringify(items)} />{/if}
	<span class="sr-only" aria-live="polite">{announcement}</span>
</div>
