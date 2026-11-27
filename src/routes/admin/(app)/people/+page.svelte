<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import StarIcon from '@lucide/svelte/icons/star';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import { PERSON_KIND_LABELS, displayRole } from '#lib/content/labels.ts';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Panel from '#lib/components/admin/Panel.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { AdminForm } from '#lib/components/admin/form.svelte.ts';
	import PersonAvatar from '#lib/components/admin/people/PersonAvatar.svelte';
	import PersonSheet from '#lib/components/admin/people/PersonSheet.svelte';
	import TeamsDialog from '#lib/components/admin/people/TeamsDialog.svelte';
	import { emptyPerson, type PersonDraft } from '#lib/components/admin/people/person-form.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	type Person = (typeof data.people)[number];
	type Team = (typeof data.teams)[number];

	const teamById = $derived(new Map<string, Team>(data.teams.map((t) => [t.id, t])));
	const teamOf = (p: Person) => (p.teamId ? (teamById.get(p.teamId) ?? null) : null);
	const roleOf = (p: Person) => (p.kind === 'advisor' && !p.role?.trim() ? 'Advisor' : displayRole(p.role, teamOf(p)?.name));

	/* Groups: the filter pills, and the order of the "Everyone" list (as on the People page). */
	type Group = { value: string; label: string; match: (p: Person) => boolean; reorderable: boolean };

	const teamGroup = (team: Team): Group => ({
		value: team.slug,
		label: team.name,
		match: (p) => p.kind === 'member' && p.teamId === team.id,
		reorderable: true
	});
	const groups = $derived.by((): Group[] => {
		const leading = data.teams.filter((t) => t.isGroup).map(teamGroup);
		const rest = data.teams.filter((t) => !t.isGroup).map(teamGroup);
		return [
			...leading,
			{ value: 'advisors', label: 'Advisors', match: (p) => p.kind === 'advisor', reorderable: true },
			...rest,
			{ value: 'no-team', label: 'No team', match: (p) => p.kind === 'member' && !p.teamId, reorderable: true },
			{ value: 'alumni', label: 'Alumni', match: (p) => p.kind === 'alumni', reorderable: true }
		];
	});
	const hiddenGroup: Group = { value: 'hidden', label: 'Hidden', match: (p) => !p.visible, reorderable: false };
	const everyone: Group = { value: 'all', label: 'Everyone', match: () => true, reorderable: false };

	/** Everyone in group order, then sort order and name within each group. */
	const ordered = $derived.by(() => {
		const rank = (p: Person) => groups.findIndex((g) => g.match(p));
		return data.people
			.map((p, i) => ({ p, i, r: rank(p) }))
			.sort((a, b) => a.r - b.r || a.i - b.i)
			.map(({ p }) => p);
	});

	const counts = $derived(
		Object.fromEntries([everyone, hiddenGroup, ...groups].map((g) => [g.value, data.people.filter(g.match).length]))
	);
	const pills = $derived(
		[everyone, ...groups.filter((g) => g.value !== 'no-team' || counts['no-team'] > 0), hiddenGroup].map((g) => ({
			value: g.value,
			label: g.label
		}))
	);

	/* Filter and search, kept in the URL (?group=ai&q=tan) for reloads and Back. */
	let group = $state(untrack(() => page.url.searchParams.get('group') ?? 'all'));
	let query = $state(untrack(() => page.url.searchParams.get('q') ?? ''));
	const current = $derived(
		[everyone, hiddenGroup, ...groups].find((g) => g.value === group) ?? everyone
	);

	let syncTimer: ReturnType<typeof setTimeout> | undefined;
	function syncUrl(delay = 0) {
		clearTimeout(syncTimer);
		syncTimer = setTimeout(() => {
			const url = new URL(page.url.href);
			const q = query.trim();
			if (q) url.searchParams.set('q', q);
			else url.searchParams.delete('q');
			if (current.value !== 'all') url.searchParams.set('group', current.value);
			else url.searchParams.delete('group');
			url.searchParams.delete('add');
			url.searchParams.delete('person');
			if (url.search !== page.url.search) void goto(url, { replace: true, reset: false });
		}, delay);
	}

	function setGroup(value: string) {
		// Clicking the selected pill again keeps it selected.
		if (!value) return;
		group = value;
		syncUrl();
	}

	function clearFilters() {
		query = '';
		group = 'all';
		syncUrl();
	}

	const needle = $derived(query.trim().toLowerCase());
	const rows = $derived(
		ordered.filter(
			(p) =>
				current.match(p) &&
				(!needle ||
					[p.name, p.role ?? '', teamOf(p)?.name ?? '', roleOf(p)].some((text) => text.toLowerCase().includes(needle)))
		)
	);
	const canReorder = $derived(current.reorderable && !needle);
	const orderHint = $derived(
		needle
			? 'Clear the search to change the order.'
			: current.reorderable
				? `The arrows set the order on the People page.`
				: 'Pick a team, Advisors or Alumni to change the order.'
	);

	/* The edit sheet. The draft is a fresh object each time it opens. */
	let sheetOpen = $state(false);
	let draft = $state<PersonDraft>(emptyPerson());
	let focusAfterClose: string | null = null;

	function toDraft(p: Person): PersonDraft {
		return {
			id: p.id,
			name: p.name,
			kind: p.kind,
			teamId: p.teamId ?? '',
			role: p.role ?? '',
			isLead: p.isLead,
			featured: p.featured,
			cohort: p.cohort == null ? '' : String(p.cohort),
			profileUrl: p.profileUrl ?? '',
			photoUrl: p.photoUrl ?? '',
			visible: p.visible
		};
	}

	function openPerson(p: Person) {
		draft = toDraft(p);
		focusAfterClose = `[data-person-button="${p.id}"]`;
		sheetOpen = true;
	}

	function openNew() {
		const team = data.teams.find((t) => t.slug === current.value);
		const next = emptyPerson(team?.id ?? '');
		if (current.value === 'advisors') next.kind = 'advisor';
		if (current.value === 'alumni') next.kind = 'alumni';
		draft = next;
		focusAfterClose = '[data-add-person]';
		sheetOpen = true;
	}

	function onRowClick(event: MouseEvent, p: Person) {
		if ((event.target as HTMLElement).closest('a, button, input, label')) return;
		openPerson(p);
	}

	function returnFocus(event: Event) {
		event.preventDefault();
		const target = (focusAfterClose && document.querySelector<HTMLElement>(focusAfterClose)) || document.querySelector<HTMLElement>('[data-add-person]');
		target?.focus();
	}

	/* Links from elsewhere: /admin/people?add=1 opens the empty form, ?person=<id> opens one. */
	$effect(() => {
		untrack(() => {
			const params = page.url.searchParams;
			const id = params.get('person');
			const person = id ? data.people.find((p) => p.id === id) : undefined;
			if (person) openPerson(person);
			else if (params.has('add')) openNew();
			if (params.has('add') || params.has('person')) syncUrl();
		});
	});

	/* Reordering: a hidden form that the arrow buttons submit. */
	async function focusMoved(id: string, direction: string) {
		await tick();
		const same = document.querySelector<HTMLButtonElement>(`[data-move="${id}:${direction}"]`);
		const other = document.querySelector<HTMLButtonElement>(`[data-move="${id}:${direction === 'up' ? 'down' : 'up'}"]`);
		(same && !same.disabled ? same : other)?.focus();
	}
	const move = new AdminForm({
		onSuccess: (result) => {
			if (typeof result?.moved === 'string') void focusMoved(result.moved, String(result.direction));
		}
	});

	let teamsOpen = $state(false);
	const head = 'text-label h-10 px-2 text-[11px] font-medium text-ink-muted';
	const pillClass =
		'h-9 min-w-0 rounded-sm border border-line bg-surface-200 px-3 text-[13px] font-medium text-ink shadow-none hover:border-line-strong hover:bg-surface-200 hover:text-ink data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-ink-on-light data-[state=on]:hover:bg-ink';
</script>

<PageHeader breadcrumb={[{ label: 'Content' }, { label: 'People' }]} title="People">
	{#snippet actions()}
		<AdminButton variant="outline" onclick={() => (teamsOpen = true)}>Manage teams</AdminButton>
		<AdminButton data-add-person onclick={openNew}>Add person</AdminButton>
	{/snippet}
</PageHeader>

<form id="move-form" method="POST" action="?/move" use:enhance={move.submit} hidden></form>

{#if data.people.length}
	<div class="flex flex-col gap-3">
		<ToggleGroup.Root
			type="single"
			bind:value={() => current.value, setGroup}
			spacing={1}
			aria-label="Filter by team"
			class="w-full flex-wrap gap-1.5"
		>
			{#each pills as pill (pill.value)}
				<ToggleGroup.Item value={pill.value} class={pillClass}>
					{pill.label}
					<span class="font-mono text-[11px]">{counts[pill.value] ?? 0}</span>
				</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
		<InputGroup.Root class="h-11 w-full rounded-sm border-line-strong bg-surface-100 shadow-none sm:w-[320px] dark:bg-surface-100">
			<InputGroup.Addon class="pl-3">
				<SearchIcon class="size-4 text-ink-muted" aria-hidden="true" />
			</InputGroup.Addon>
			<InputGroup.Input
				type="search"
				bind:value={query}
				oninput={() => syncUrl(300)}
				placeholder="Search by name, role or team"
				aria-label="Search people"
				class="h-full"
			/>
		</InputGroup.Root>
	</div>

	{#if rows.length}
		<Panel padding="none">
			<Table.Root class="table-fixed">
				<Table.Header>
					<Table.Row class="border-0 hover:bg-transparent">
						<Table.Head class="{head} pl-4 sm:pl-[18px]">Name</Table.Head>
						<Table.Head class="{head} hidden lg:table-cell">Role</Table.Head>
						<Table.Head class="{head} hidden w-[160px] md:table-cell">Team</Table.Head>
						<Table.Head class="{head} hidden w-[104px] sm:table-cell">Listed as</Table.Head>
						<Table.Head class="{head} hidden w-[96px] sm:table-cell">On site</Table.Head>
						{#if canReorder}
							<Table.Head class="{head} w-[88px] pr-4 text-right sm:w-[100px] sm:pr-[18px]">Order</Table.Head>
						{/if}
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each rows as person, index (person.id)}
						{@const team = teamOf(person)}
						{@const role = roleOf(person)}
						<Table.Row
							class="cursor-pointer border-0 border-t border-line hover:bg-surface-300/40"
							onclick={(event: MouseEvent) => onRowClick(event, person)}
						>
							<Table.Cell class="py-2 pr-2 pl-4 whitespace-normal sm:pl-[18px]">
								<button
									type="button"
									data-person-button={person.id}
									class="-mx-1 -my-1 flex min-h-11 w-[calc(100%+0.5rem)] min-w-0 items-center gap-2.5 rounded-sm px-1 py-1 text-left"
									onclick={() => openPerson(person)}
								>
									<PersonAvatar name={person.name} photoUrl={person.photoUrl} />
									<span class="flex min-w-0 flex-1 flex-col">
										<span class="flex min-w-0 items-center gap-1.5">
											<span class="truncate text-sm font-semibold text-ink">{person.name}</span>
											{#if person.featured}
												<StarIcon class="size-3.5 shrink-0 fill-current text-ink-muted" aria-hidden="true" />
												<span class="sr-only">(on the home page)</span>
											{/if}
										</span>
										<span class="truncate text-xs leading-[18px] lg:hidden">
											<span class={person.isLead ? 'text-brand-text' : 'text-ink-muted'}>{role}</span>
											{#if team && !role.startsWith(team.name)}<span class="text-ink-muted md:hidden"> · {team.name}</span>{/if}
											{#if !person.visible}<span class="text-ink-muted sm:hidden"> · Hidden</span>{/if}
										</span>
									</span>
								</button>
							</Table.Cell>
							<Table.Cell class={['hidden truncate px-2 py-2 text-sm lg:table-cell', person.isLead ? 'text-brand-text' : 'text-ink-muted']}>
								{role}
							</Table.Cell>
							<Table.Cell class="hidden truncate px-2 py-2 text-sm text-ink-muted md:table-cell">
								{person.kind === 'advisor' ? 'Advisors' : (team?.name ?? 'No team')}
							</Table.Cell>
							<Table.Cell class="hidden px-2 py-2 sm:table-cell">
								<Badge variant="tag-sunken" size="tag-sm" class="text-ink-muted">{PERSON_KIND_LABELS[person.kind]}</Badge>
							</Table.Cell>
							<Table.Cell class="hidden px-2 py-2 sm:table-cell">
								<StatusBadge status={person.visible ? 'visible' : 'hidden'} />
							</Table.Cell>
							{#if canReorder}
								<Table.Cell class="px-2 py-2 pr-3 sm:pr-[14px]">
									<div class="flex items-center justify-end gap-0.5">
										<AdminButton
											type="submit"
											form="move-form"
											name="target"
											value="{person.id}:up"
											variant="ghost"
											size="icon-sm"
											data-move="{person.id}:up"
											aria-label="Move {person.name} up"
											disabled={index === 0}
										>
											<ArrowUpIcon aria-hidden="true" />
										</AdminButton>
										<AdminButton
											type="submit"
											form="move-form"
											name="target"
											value="{person.id}:down"
											variant="ghost"
											size="icon-sm"
											data-move="{person.id}:down"
											aria-label="Move {person.name} down"
											disabled={index === rows.length - 1}
										>
											<ArrowDownIcon aria-hidden="true" />
										</AdminButton>
									</div>
								</Table.Cell>
							{/if}
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-[13px] text-ink-muted sm:px-[18px]">
				<span role="status">Showing {rows.length} of {data.people.length}</span>
				<span>{orderHint}</span>
			</div>
		</Panel>
	{:else if needle}
		<EmptyState icon={SearchXIcon} title="Nobody matches" description="Try another name, or search everyone.">
			{#snippet actions()}
				<AdminButton variant="outline" onclick={clearFilters}>Clear search</AdminButton>
			{/snippet}
		</EmptyState>
	{:else}
		<EmptyState
			icon={UsersIcon}
			title={current.value === 'hidden'
				? 'Nobody is hidden'
				: current.value === 'alumni'
					? 'No alumni yet'
					: `Nobody in ${current.label} yet`}
			description={current.value === 'hidden'
				? 'Everyone is shown on the People page. Turn off Show on the People page to hide someone.'
				: current.value === 'alumni'
					? 'Set a former member to Alumni to keep them listed after they leave.'
					: 'Add someone, or pick another group.'}
		>
			{#snippet actions()}
				{#if current.value !== 'hidden'}<AdminButton onclick={openNew}>Add person</AdminButton>{/if}
			{/snippet}
		</EmptyState>
	{/if}
{:else}
	<EmptyState icon={UsersIcon} title="No people yet" description="Add the advisors and the team. They show on the People page.">
		{#snippet actions()}
			<AdminButton onclick={openNew}>Add person</AdminButton>
		{/snippet}
	</EmptyState>
{/if}

<PersonSheet
	bind:open={sheetOpen}
	bind:draft
	teams={data.teams}
	onsaved={(id) => (focusAfterClose = `[data-person-button="${id}"]`)}
	ondeleted={() => (focusAfterClose = '[data-add-person]')}
	onclosefocus={returnFocus}
/>

<TeamsDialog bind:open={teamsOpen} teams={data.teams} />
