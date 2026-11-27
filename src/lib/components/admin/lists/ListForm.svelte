<!--
	One list on the Lists admin page: a Panel with the list's title, hint and "+ Add" button,
	the rows (the children snippet), and a footer with the unsaved-changes status and the
	list's own Save button. Saving posts the whole list as JSON (`rows`) to `action`; the
	server inserts, updates and deletes to match, in one transaction.

	- The same checks as the server run first; field errors are keyed like
	  `achievements.2.year` and passed to the children snippet.
	- Saving a list that drops saved rows asks first ("Remove 2 achievements?").
	- After any save the page data refreshes; this list resets to what the server holds only
	  when that changed, so unsaved edits in the other lists are kept.

	<ListForm list="sponsors" bind:rows bind:dirty server={data.lists.sponsors} title="Sponsors" ...>
		{#snippet children(errors)}<ListEditor bind:items={rows} ... />{/snippet}
	</ListForm>
-->
<script lang="ts" generics="K extends ListKey">
	import { tick, untrack, type Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import AdminButton from '../AdminButton.svelte';
	import Panel from '../Panel.svelte';
	import { AdminForm } from '../form.svelte.ts';
	import { LIST_MAX, VALIDATORS, normalizeRows, type Errors, type ListKey, type ListRows } from './rows.ts';

	type Props = {
		list: K;
		/** The editor's rows. Bindable; reset from `server` after a save changes it. */
		rows: ListRows[K][];
		/** The rows as the server holds them (from the page load). */
		server: ListRows[K][];
		title: string;
		description?: string;
		/** Singular and plural nouns: "achievement", "achievements". */
		noun: [string, string];
		/** Text of the add button in the header. */
		addLabel: string;
		onadd: () => void;
		/** True while the rows differ from the server. Bindable, for the page's leave prompt. */
		dirty?: boolean;
		/** Hold saving while a file uploads. */
		uploading?: boolean;
		/** A line under the header, e.g. "Hidden on the About page". */
		notice?: Snippet;
		/** The rows. Gets the field errors to show (after the first save attempt). */
		children: Snippet<[Errors]>;
		id?: string;
		class?: string;
	};

	let {
		list,
		rows = $bindable(),
		server,
		title,
		description,
		noun,
		addLabel,
		onadd,
		dirty = $bindable(false),
		uploading = false,
		notice,
		children,
		id,
		class: className
	}: Props = $props();

	let formEl: HTMLFormElement | undefined = $state();

	/* What the server holds, to tell unsaved changes apart and to reset after a save. */
	let baseline = $state(untrack(() => normalizeRows(list, server)));
	$effect(() => {
		const next = normalizeRows(list, server);
		if (next === untrack(() => baseline)) return;
		baseline = next;
		rows = $state.snapshot(server) as ListRows[K][];
		attempted = false;
	});
	$effect(() => {
		dirty = normalizeRows(list, rows) !== baseline;
	});

	/* Errors show after the first save attempt and update as the editor fixes them. */
	let attempted = $state(false);
	const checked = $derived(VALIDATORS[list](rows));
	const errors = $derived<Errors>(attempted ? checked.errors : {});

	const savedIds = $derived(new Set(server.map((row) => row.id).filter(Boolean)));
	const removedCount = $derived.by(() => {
		const kept = new Set(rows.map((row) => row.id));
		let count = 0;
		for (const id of savedIds) if (!kept.has(id)) count += 1;
		return count;
	});

	async function focusFirstError() {
		await tick();
		formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}

	let confirmOpen = $state(false);
	let confirmed = false;

	const save = new AdminForm({
		onSubmit: () => {
			attempted = true;
			if (checked.message) {
				toast.error(checked.message);
				return false;
			}
			if (Object.keys(checked.errors).length) {
				toast.error('Check the highlighted fields.');
				void focusFirstError();
				return false;
			}
			if (removedCount > 0 && !confirmed) {
				confirmOpen = true;
				return false;
			}
			confirmed = false;
		},
		onFailure: () => void focusFirstError()
	});

	function confirmRemove() {
		confirmed = true;
		confirmOpen = false;
		formEl?.requestSubmit();
	}

	const count = $derived(rows.length);
	const max = $derived(LIST_MAX[list]);
	const saveLabel = $derived(`Save ${noun[1]}`);
</script>

<form
	bind:this={formEl}
	method="POST"
	action="?/{list}"
	use:enhance={save.submit}
	class={['contents', className]}
	novalidate
>
	<Panel {id} {title} {description} stacked>
		{#snippet actions()}
			<AdminButton variant="outline" size="sm" data-list-add disabled={count >= max} onclick={onadd}>{addLabel}</AdminButton>
		{/snippet}
		{@render notice?.()}
		{@render children(errors)}
		<div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
			<p class="m-0 flex items-center gap-2 text-[13px] text-ink-muted" role="status">
				{#if uploading}
					Waiting for the upload to finish.
				{:else if dirty}
					<span class="size-1.5 rounded-full bg-brand-text" aria-hidden="true"></span>
					Unsaved changes
				{:else}
					{count === 1 ? `1 ${noun[0]}` : `${count} ${noun[1]}`}, all saved
				{/if}
			</p>
			<AdminButton type="submit" pending={save.pending} pendingLabel="Saving" disabled={uploading}>
				{saveLabel}
			</AdminButton>
		</div>
		<input type="hidden" name="rows" value={JSON.stringify(rows)} />
	</Panel>
</form>

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content class="border border-line bg-surface-200 ring-0">
		<AlertDialog.Header>
			<AlertDialog.Title class="font-display text-lg font-semibold">
				Remove {removedCount === 1 ? `1 ${noun[0]}` : `${removedCount} ${noun[1]}`}?
			</AlertDialog.Title>
			<AlertDialog.Description class="text-sm leading-[22px] text-ink-muted">
				Saving removes {removedCount === 1 ? 'it' : 'them'} from the site within a minute. This can't be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				class="h-11 rounded-sm border-line-strong bg-transparent px-4 hover:border-ink dark:border-line-strong dark:bg-transparent dark:hover:bg-transparent"
			>
				Keep editing
			</AlertDialog.Cancel>
			<AdminButton onclick={confirmRemove}>Save and remove</AdminButton>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
