<!--
	The role of one editor as a Select that saves as soon as it changes (owners only).
	Goes back to the saved role if the change is refused (e.g. the last owner).
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import * as Select from '#lib/components/ui/select/index.js';
	import { EDITOR_ROLE_LABELS } from '#lib/content/labels.ts';
	import { AdminForm } from '#lib/components/admin/form.svelte.ts';
	import type { EditorRole } from '#lib/server/db/schema.ts';

	type Props = { id: string; role: EditorRole; name: string };
	let { id, role, name }: Props = $props();

	// Follows the saved role; set locally while a change is sent.
	let value = $derived<string>(role);
	let formEl: HTMLFormElement | undefined = $state();

	const save = new AdminForm({
		onFailure: () => (value = role),
		onError: () => (value = role)
	});

	async function onValueChange(next: string) {
		if (next === role) return;
		await tick();
		formEl?.requestSubmit();
	}
</script>

<form bind:this={formEl} method="POST" action="?/role" use:enhance={save.submit}>
	<input type="hidden" name="id" value={id} />
	<Select.Root type="single" name="role" bind:value {onValueChange} disabled={save.pending}>
		<Select.Trigger
			size="sm"
			aria-label="Role of {name}"
			class="h-11! w-full max-w-[124px] rounded-sm border-line-strong bg-surface-100 px-3 shadow-none dark:bg-surface-100 dark:hover:bg-surface-300"
		>
			{EDITOR_ROLE_LABELS[value as EditorRole] ?? 'Role'}
		</Select.Trigger>
		<Select.Content class="border border-line bg-surface-200">
			{#each Object.entries(EDITOR_ROLE_LABELS) as [key, label] (key)}
				<Select.Item value={key} {label} class="min-h-10" />
			{/each}
		</Select.Content>
	</Select.Root>
</form>
