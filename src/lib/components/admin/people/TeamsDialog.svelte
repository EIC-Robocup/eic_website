<!--
	"Manage teams": a dialog to add, rename, reorder and remove teams. A team can only be
	removed once nobody is in it. Save sends the whole list to `?/teams` (one transaction).

	<TeamsDialog bind:open teams={data.teams} />
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import AdminButton from '../AdminButton.svelte';
	import { AdminForm } from '../form.svelte.ts';
	import { hintClass, inputClass, labelClass } from '../styles.ts';
	import { PERSON_MAX, validateTeams } from './person-form.ts';

	type Team = { id: string; name: string; count: number };
	type Row = Team & { key: number };

	type Props = { open: boolean; teams: Team[] };
	let { open = $bindable(false), teams }: Props = $props();

	let rows = $state<Row[]>([]);
	let newName = $state('');
	let attempted = $state(false);
	let announcement = $state('');
	let list: HTMLElement | undefined = $state();
	let newInput: HTMLInputElement | null = $state(null);
	let nextKey = 0;

	/** Start from the saved teams each time the dialog opens. */
	function reset() {
		rows = teams.map((team) => ({ ...team, key: nextKey++ }));
		newName = '';
		attempted = false;
		announcement = '';
	}

	let wasOpen = false;
	$effect.pre(() => {
		if (open && !wasOpen) reset();
		wasOpen = open;
	});

	const checked = $derived(validateTeams(rows.map(({ id, name }) => ({ id, name }))));
	const errors = $derived(attempted ? checked.errors : {});
	const dirty = $derived(
		JSON.stringify(rows.map((r) => [r.id, r.name.trim()])) !== JSON.stringify(teams.map((t) => [t.id, t.name]))
	);

	const peopleText = (n: number) => (n === 0 ? 'Empty' : n === 1 ? '1 person' : `${n} people`);

	async function focusRow(index: number, selector: string) {
		await tick();
		list?.querySelectorAll<HTMLElement>('[data-team-row]')[index]?.querySelector<HTMLElement>(selector)?.focus();
	}

	async function addTeam() {
		const name = newName.trim().replace(/\s+/g, ' ');
		if (!name) {
			newInput?.focus();
			return;
		}
		if (rows.length >= PERSON_MAX.teams) {
			toast.error(`Keep it to ${PERSON_MAX.teams} teams or fewer.`);
			return;
		}
		rows.push({ id: '', name, count: 0, key: nextKey++ });
		newName = '';
		announcement = `Added ${name}. Save to keep it.`;
		await tick();
		newInput?.focus();
	}

	function onNewKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void addTeam();
		}
	}

	async function move(index: number, by: -1 | 1, which: 'up' | 'down') {
		const to = index + by;
		if (to < 0 || to >= rows.length) return;
		const [row] = rows.splice(index, 1);
		rows.splice(to, 0, row);
		announcement = `Moved ${row.name || 'team'} to position ${to + 1}`;
		await tick();
		const target = list?.querySelectorAll<HTMLElement>('[data-team-row]')[to];
		const same = target?.querySelector<HTMLButtonElement>(`[data-move="${which}"]`);
		const other = target?.querySelector<HTMLButtonElement>(`[data-move="${which === 'up' ? 'down' : 'up'}"]`);
		(same && !same.disabled ? same : other)?.focus();
	}

	async function remove(index: number) {
		const [row] = rows.splice(index, 1);
		announcement = `Removed ${row?.name || 'team'}. Save to apply.`;
		if (rows.length) await focusRow(Math.min(index, rows.length - 1), '[data-remove]:not(:disabled), input');
		else {
			await tick();
			newInput?.focus();
		}
	}

	const payload = () => JSON.stringify(rows.map(({ id, name }) => ({ id, name })));

	const save = new AdminForm({
		onSubmit: ({ formData }) => {
			// A name typed in "New team" but not added yet is saved too.
			const pending = newName.trim().replace(/\s+/g, ' ');
			if (pending) {
				rows.push({ id: '', name: pending, count: 0, key: nextKey++ });
				newName = '';
				formData.set('teams', payload());
			}
			attempted = true;
			if (checked.message) {
				toast.error(checked.message);
				return false;
			}
			if (Object.keys(checked.errors).length) {
				toast.error('Check the highlighted team names.');
				void tick().then(() => list?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
				return false;
			}
		},
		onSuccess: () => {
			open = false;
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 border border-line bg-surface-200 p-0 ring-0 sm:max-w-lg">
		<Dialog.Header class="gap-1 border-b border-line p-5 pr-14">
			<Dialog.Title class="font-display text-lg font-semibold">Manage teams</Dialog.Title>
			<Dialog.Description class="text-[13px] leading-5 text-ink-muted">
				Teams on the People page, in this order. A team can be removed once nobody is in it.
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/teams"
			use:enhance={save.submit}
			novalidate
			class="flex min-h-0 flex-1 flex-col"
		>
			<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
				{#if rows.length}
					<ol bind:this={list} class="m-0 flex list-none flex-col gap-2 p-0">
						{#each rows as row, index (row.key)}
							{@const error = errors[`teams.${index}.name`]}
							<li data-team-row class="flex flex-col gap-1">
								<div class="flex items-center gap-1.5">
									<Input
										bind:value={row.name}
										aria-label="Name of team {index + 1}"
										aria-invalid={error ? 'true' : undefined}
										aria-describedby="team-{row.key}-meta"
										maxlength={PERSON_MAX.teamName}
										class="{inputClass} min-w-0 flex-1"
									/>
									<span id="team-{row.key}-meta" class="hidden w-[72px] shrink-0 text-right text-xs text-ink-muted sm:block">
										{row.id ? peopleText(row.count) : 'New'}
									</span>
									<AdminButton
										variant="ghost"
										size="icon"
										data-move="up"
										aria-label="Move {row.name || 'team'} up"
										disabled={index === 0}
										onclick={() => move(index, -1, 'up')}
									>
										<ArrowUpIcon aria-hidden="true" />
									</AdminButton>
									<AdminButton
										variant="ghost"
										size="icon"
										data-move="down"
										aria-label="Move {row.name || 'team'} down"
										disabled={index === rows.length - 1}
										onclick={() => move(index, 1, 'down')}
									>
										<ArrowDownIcon aria-hidden="true" />
									</AdminButton>
									<AdminButton
										variant="ghost"
										size="icon"
										data-remove
										aria-label={row.count > 0
											? `Remove ${row.name}: move its ${peopleText(row.count).toLowerCase()} first`
											: `Remove ${row.name || 'team'}`}
										title={row.count > 0 ? `Move its ${peopleText(row.count).toLowerCase()} to another team first` : undefined}
										disabled={row.count > 0}
										onclick={() => remove(index)}
									>
										<XIcon aria-hidden="true" />
									</AdminButton>
								</div>
								<span class="text-xs text-ink-muted sm:hidden">{row.id ? peopleText(row.count) : 'New team'}</span>
								{#if error}<span class="text-xs leading-[18px] text-brand-text">{error}</span>{/if}
							</li>
						{/each}
					</ol>
				{:else}
					<p class="m-0 rounded-sm border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-muted">
						No teams yet.
					</p>
				{/if}

				<div class="flex flex-col gap-1.5 border-t border-line pt-4">
					<label for="new-team-name" class={labelClass}>New team</label>
					<div class="flex gap-2">
						<Input
							id="new-team-name"
							bind:ref={newInput}
							bind:value={newName}
							maxlength={PERSON_MAX.teamName}
							placeholder="e.g. Perception"
							autocomplete="off"
							class="{inputClass} min-w-0 flex-1"
							onkeydown={onNewKeydown}
						/>
						<AdminButton variant="outline" onclick={addTeam}>Add team</AdminButton>
					</div>
					<span class={hintClass}>New and renamed teams appear on the site after you save.</span>
				</div>
			</div>

			<input type="hidden" name="teams" value={payload()} />
			<span class="sr-only" aria-live="polite">{announcement}</span>

			<Dialog.Footer class="flex-row flex-wrap justify-end gap-2.5 border-t border-line p-5">
				<Dialog.Close>
					{#snippet child({ props })}
						<AdminButton {...props} variant="outline">Cancel</AdminButton>
					{/snippet}
				</Dialog.Close>
				<AdminButton type="submit" pending={save.pending} pendingLabel="Saving" disabled={!dirty && !newName.trim()}>
					Save teams
				</AdminButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
