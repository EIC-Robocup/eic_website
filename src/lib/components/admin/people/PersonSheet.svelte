<!--
	The right side panel for adding or editing one person: headshot, name, Listed as
	(Member, Advisor, Alumni), team, role, lead, cohort, profile link, and whether they show on
	the People page and the home page. Save posts to `?/save`; Remove asks first and posts to
	`?/delete`. The page owns the draft: it sets a fresh object each time the panel opens.

	<PersonSheet bind:open bind:draft teams={data.teams} onclosefocus={returnFocus} />
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { PERSON_KIND_OPTIONS, displayRole, initials } from '#lib/content/labels.ts';
	import type { PersonKind } from '#lib/server/db/schema.ts';
	import AdminButton from '../AdminButton.svelte';
	import ConfirmDelete from '../ConfirmDelete.svelte';
	import FormField from '../FormField.svelte';
	import ImageField from '../ImageField.svelte';
	import ToggleRow from '../ToggleRow.svelte';
	import { AdminForm } from '../form.svelte.ts';
	import { inputClass, labelClass, monoInputClass, selectTriggerClass } from '../styles.ts';
	import { PERSON_MAX, isPersonKind, validatePerson, type PersonDraft } from './person-form.ts';

	type TeamOption = { id: string; name: string };

	type Props = {
		open: boolean;
		/** The person being edited; `id` is '' when adding. Bindable: the fields edit it. */
		draft: PersonDraft;
		teams: TeamOption[];
		/** After a save, with the person's id. */
		onsaved?: (id: string) => void;
		ondeleted?: () => void;
		/** Where focus goes when the panel closes (call `event.preventDefault()` to take over). */
		onclosefocus?: (event: Event) => void;
	};

	let { open = $bindable(false), draft = $bindable(), teams, onsaved, ondeleted, onclosefocus }: Props = $props();

	const isNew = $derived(!draft.id);
	const formId = 'person-form';
	let formEl: HTMLFormElement | undefined = $state();
	let uploading = $state(false);

	/* Errors show after the first save attempt and update as the editor fixes them. */
	let attempted = $state(false);
	$effect.pre(() => {
		void draft;
		attempted = false;
	});
	const errors = $derived(attempted ? validatePerson(draft).errors : {});

	async function focusFirstError() {
		await tick();
		formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}

	const save = new AdminForm({
		onSubmit: () => {
			attempted = true;
			if (Object.keys(validatePerson(draft).errors).length) {
				toast.error('Check the highlighted fields.');
				void focusFirstError();
				return false;
			}
		},
		onSuccess: (data) => {
			open = false;
			if (typeof data?.id === 'string') onsaved?.(data.id);
		},
		onFailure: () => void focusFirstError()
	});

	const teamName = $derived(teams.find((t) => t.id === draft.teamId)?.name ?? null);
	const defaultRole = $derived(
		draft.kind === 'advisor' ? 'Advisor' : displayRole('', teamName) || (draft.kind === 'alumni' ? 'Alumni' : 'Member')
	);
	const roleHint = $derived(
		draft.kind === 'advisor'
			? 'Leave empty to show “Advisor”.'
			: teamName
				? `Leave empty for members to show “${teamName} team”.`
				: 'Leave empty for members to show their team name.'
	);
	const shownRole = $derived(draft.role.trim() || defaultRole);
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="right"
		class="w-full gap-0 border-line bg-surface-200 p-0 data-[side=right]:w-full sm:data-[side=right]:max-w-[440px]"
		onCloseAutoFocus={onclosefocus}
	>
		<Sheet.Header class="gap-1 border-b border-line p-5 pr-14">
			<Sheet.Title class="font-display text-lg leading-6 font-semibold tracking-[-0.01em] text-ink">
				{isNew ? 'Add person' : 'Edit person'}
			</Sheet.Title>
			<Sheet.Description class="text-[13px] leading-5 text-ink-muted">
				{#if draft.name.trim()}
					On the site: {draft.name.trim()} ·
					<span class={draft.isLead ? 'text-brand-text' : undefined}>{shownRole}</span>
				{:else}
					Shown on the People page with their team.
				{/if}
			</Sheet.Description>
		</Sheet.Header>

		{#key draft}
			<form
				bind:this={formEl}
				id={formId}
				method="POST"
				action="?/save"
				use:enhance={save.submit}
				novalidate
				class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5"
			>
				<input type="hidden" name="id" value={draft.id} />

				<ImageField
					variant="avatar"
					name="photo"
					folder="people"
					label="Headshot"
					initials={initials(draft.name) || '+'}
					hint="Square, at least 400px. Empty shows initials."
					bind:url={draft.photoUrl}
					alt={draft.name}
					error={errors.photo}
					bind:uploading
				/>

				<FormField label="Full name" error={errors.name}>
					{#snippet children(attrs)}
						<Input
							{...attrs}
							name="name"
							bind:value={draft.name}
							maxlength={PERSON_MAX.name}
							autocomplete="off"
							required
							class={inputClass}
						/>
					{/snippet}
				</FormField>

				<div class="flex flex-col gap-1.5">
					<span id="person-kind-label" class={labelClass}>Listed as</span>
					<ToggleGroup.Root
						type="single"
						bind:value={
							() => draft.kind,
							(value: string) => {
								if (isPersonKind(value)) draft.kind = value as PersonKind;
							}
						}
						aria-labelledby="person-kind-label"
						spacing={1}
						class="w-full gap-1 rounded-[8px] border border-line bg-surface-100 p-1"
					>
						{#each PERSON_KIND_OPTIONS as option (option.value)}
							<ToggleGroup.Item
								value={option.value}
								class="h-9 flex-1 rounded-[5px] px-3 text-[13px] font-medium text-ink-muted hover:bg-transparent hover:text-ink data-[state=on]:bg-surface-300 data-[state=on]:text-ink"
							>
								{option.label}
							</ToggleGroup.Item>
						{/each}
					</ToggleGroup.Root>
					<input type="hidden" name="kind" value={draft.kind} />
				</div>

				{#if draft.kind !== 'advisor'}
					<FormField
						label="Team"
						error={errors.teamId}
						hint={draft.kind === 'alumni' ? 'The team they were in.' : undefined}
					>
						{#snippet children(attrs)}
							<Select.Root
								type="single"
								name="teamId"
								bind:value={() => draft.teamId || 'none', (value: string) => (draft.teamId = value === 'none' ? '' : value)}
							>
								<Select.Trigger {...attrs} class={selectTriggerClass}>{teamName ?? 'No team'}</Select.Trigger>
								<Select.Content class="border border-line bg-surface-200">
									{#each teams as team (team.id)}
										<Select.Item value={team.id} label={team.name} class="min-h-10" />
									{/each}
									<Select.Item value="none" label="No team" class="min-h-10 text-ink-muted" />
								</Select.Content>
							</Select.Root>
						{/snippet}
					</FormField>
				{/if}

				<FormField label="Role" optional error={errors.role} hint={roleHint}>
					{#snippet children(attrs)}
						<Input
							{...attrs}
							name="role"
							bind:value={draft.role}
							maxlength={PERSON_MAX.role}
							placeholder={defaultRole}
							autocomplete="off"
							class={inputClass}
						/>
					{/snippet}
				</FormField>

				<ToggleRow name="isLead" label="Lead" hint="Shows the role in red, as for team leaders." bind:checked={draft.isLead} />

				<div class="grid grid-cols-[104px_minmax(0,1fr)] gap-3">
					<FormField label="Cohort" optional error={errors.cohort}>
						{#snippet children(attrs)}
							<Input
								{...attrs}
								name="cohort"
								bind:value={draft.cohort}
								inputmode="numeric"
								maxlength={4}
								placeholder="2026"
								autocomplete="off"
								class={monoInputClass}
							/>
						{/snippet}
					</FormField>
					<FormField label="Profile link" optional error={errors.profileUrl}>
						{#snippet children(attrs)}
							<Input
								{...attrs}
								name="profileUrl"
								bind:value={draft.profileUrl}
								type="url"
								inputmode="url"
								placeholder="https://"
								autocomplete="off"
								spellcheck="false"
								class={monoInputClass}
							/>
						{/snippet}
					</FormField>
				</div>

				<div class="flex flex-col gap-3.5 rounded-lg border border-line bg-surface-100/50 p-3.5">
					<ToggleRow
						name="visible"
						label="Show on the People page"
						hint="Turn off to hide them without removing."
						bind:checked={draft.visible}
					/>
					<ToggleRow
						name="featured"
						label="Show on the home page"
						hint="In the People strip on the home page."
						bind:checked={draft.featured}
						divided
					/>
				</div>
			</form>
		{/key}

		<Sheet.Footer class="flex-row flex-wrap gap-2.5 border-t border-line p-5">
			<AdminButton
				type="submit"
				form={formId}
				class="min-w-32 flex-1"
				pending={save.pending}
				pendingLabel="Saving"
				disabled={uploading}
			>
				{isNew ? 'Add person' : 'Save'}
			</AdminButton>
			{#if !isNew}
				<ConfirmDelete
					action="?/delete"
					id={draft.id}
					title="Remove {draft.name || 'this person'}?"
					description="They disappear from the People page straight away. To keep them as a former member, set Listed as to Alumni instead. This can't be undone."
					triggerLabel="Remove"
					confirmLabel="Remove"
					variant="outline"
					ondeleted={() => {
						open = false;
						ondeleted?.();
					}}
				/>
			{/if}
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
