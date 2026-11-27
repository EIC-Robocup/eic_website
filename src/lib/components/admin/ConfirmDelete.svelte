<!--
	A delete button that asks first. Opens an alert dialog; confirming POSTs a small form
	with a hidden `id` to `action`, with toasts and a pending spinner. The action should
	call requireEditor, delete, logActivity, then `return { message: 'Post deleted.' }`
	(the dialog closes) or `redirect(303, '/admin/posts')` (the page moves on).

	<ConfirmDelete action="?/delete" id={post.id} title="Delete this post?"
		description="It is removed from the blog within a minute. This can't be undone."
		triggerLabel="Delete post" />

	<ConfirmDelete action="?/deletePerson" id={person.id} title="Remove {person.name}?" variant="outline">
		{#snippet trigger(props)}<AdminButton {...props} variant="danger" size="icon" aria-label="Remove"><TrashIcon /></AdminButton>{/snippet}
	</ConfirmDelete>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import AdminButton from './AdminButton.svelte';
	import { AdminForm } from './form.svelte.ts';

	type Props = {
		/** The form action, e.g. "?/delete" or "/admin/posts/abc?/delete". */
		action: string;
		/** Sent as the hidden `idName` field. */
		id: string;
		/** Name of the hidden id field. Default "id". */
		idName?: string;
		/** More hidden fields to send. */
		fields?: Record<string, string>;
		/** Dialog heading, e.g. "Delete this post?". */
		title: string;
		/** What happens, e.g. "It is removed from the site within a minute. This can't be undone." */
		description?: string;
		/** Text on the button that opens the dialog. */
		triggerLabel?: string;
		/** Look of the default trigger: red text (default) or a red outline. */
		variant?: 'text' | 'outline';
		/** Custom trigger. Spread `props` on a button. */
		trigger?: Snippet<[Record<string, unknown>]>;
		/** Text on the confirming button. */
		confirmLabel?: string;
		/** Toast after a successful delete when the action returns no message. */
		success?: string;
		/** Called after the action succeeds (not after a redirect). */
		ondeleted?: () => void;
		disabled?: boolean;
	};

	let {
		action,
		id,
		idName = 'id',
		fields = {},
		title,
		description = "This can't be undone.",
		triggerLabel = 'Delete',
		variant = 'text',
		trigger,
		confirmLabel = 'Delete',
		success = 'Deleted.',
		ondeleted,
		disabled = false
	}: Props = $props();

	let open = $state(false);

	const form = new AdminForm({
		success: (data) => (typeof data?.message === 'string' && data.message) || success,
		onSuccess: () => {
			open = false;
			ondeleted?.();
		}
	});
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger {disabled}>
		{#snippet child({ props })}
			{#if trigger}
				{@render trigger(props)}
			{:else}
				<AdminButton
					{...props}
					variant={variant === 'outline' ? 'danger' : 'danger-text'}
					class="self-start"
					{disabled}
				>
					{triggerLabel}
				</AdminButton>
			{/if}
		{/snippet}
	</AlertDialog.Trigger>
	<AlertDialog.Content class="border border-line bg-surface-200 ring-0">
		<AlertDialog.Header>
			<AlertDialog.Title class="font-display text-lg font-semibold">{title}</AlertDialog.Title>
			{#if description}
				<AlertDialog.Description class="text-sm leading-[22px] text-ink-muted">
					{description}
				</AlertDialog.Description>
			{/if}
		</AlertDialog.Header>
		<form method="POST" {action} use:enhance={form.submit}>
			<input type="hidden" name={idName} value={id} />
			{#each Object.entries(fields) as [key, value] (key)}
				<input type="hidden" name={key} {value} />
			{/each}
			<AlertDialog.Footer>
				<!-- type="button": inside the form, a plain <button> would submit the delete. -->
				<AlertDialog.Cancel
					type="button"
					class="h-11 rounded-sm border-line-strong bg-transparent px-4 hover:border-ink dark:border-line-strong dark:bg-transparent dark:hover:bg-transparent"
					disabled={form.pending}>Cancel</AlertDialog.Cancel
				>
				<AdminButton type="submit" pending={form.pending}>
					{confirmLabel}
				</AdminButton>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
