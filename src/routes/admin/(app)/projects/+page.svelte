<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import FolderKanbanIcon from '@lucide/svelte/icons/folder-kanban';
	import ImageIcon from '@lucide/svelte/icons/image';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import StarIcon from '@lucide/svelte/icons/star';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import {
		PROJECT_CATEGORY_FILTER_LABELS,
		PROJECT_CATEGORY_LABELS,
		PROJECT_STATUS_LABELS,
		PROJECT_STATUS_TONES,
		TONE_CLASSES,
		labelFor
	} from '#lib/content/labels.ts';
	import { optimizedSrc } from '#lib/image.ts';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Panel from '#lib/components/admin/Panel.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { AdminForm } from '#lib/components/admin/form.svelte.ts';
	import { yearLabel } from '#lib/components/admin/projects/project-form.ts';
	import { formatDateTime, isoString, timeAgo } from '#lib/components/admin/sections/time.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	type Row = (typeof data.projects)[number];
	type Category = 'all' | Row['category'];
	const CATEGORIES = Object.keys(PROJECT_CATEGORY_LABELS) as Row['category'][];
	const isCategory = (v: string | null): v is Row['category'] => CATEGORIES.includes(v as Row['category']);

	let now = $state(untrack(() => data.now));
	$effect(() => {
		now = new Date();
		const timer = setInterval(() => (now = new Date()), 30_000);
		return () => clearInterval(timer);
	});

	// A message from an action that redirected here (deleting a project).
	$effect(() => {
		if (data.flash) toast.success(data.flash);
	});

	/* Search and category, kept in the URL (?q=walkie&category=robot) for reloads and Back. */
	let query = $state(untrack(() => page.url.searchParams.get('q') ?? ''));
	let category = $state<Category>(
		untrack(() => {
			const value = page.url.searchParams.get('category');
			return isCategory(value) ? value : 'all';
		})
	);

	let syncTimer: ReturnType<typeof setTimeout> | undefined;
	function syncUrl(delay = 0) {
		clearTimeout(syncTimer);
		syncTimer = setTimeout(() => {
			const url = new URL(page.url.href);
			const q = query.trim();
			if (q) url.searchParams.set('q', q);
			else url.searchParams.delete('q');
			if (category !== 'all') url.searchParams.set('category', category);
			else url.searchParams.delete('category');
			if (url.search !== page.url.search) void goto(url, { replace: true, reset: false });
		}, delay);
	}

	function setCategory(value: string) {
		category = isCategory(value) ? value : 'all';
		syncUrl();
	}

	function clearFilters() {
		query = '';
		category = 'all';
		syncUrl();
	}

	const needle = $derived(query.trim().toLowerCase());
	const filtered = $derived(category !== 'all' || needle !== '');
	const visible = $derived(
		data.projects.filter(
			(p) =>
				(category === 'all' || p.category === category) &&
				(!needle ||
					[p.title, p.slug, p.event ?? '', ...p.tags].some((text) => text.toLowerCase().includes(needle)))
		)
	);
	const counts = $derived(
		Object.fromEntries([
			['all', data.projects.length],
			...CATEGORIES.map((c) => [c, data.projects.filter((p) => p.category === c).length])
		]) as Record<Category, number>
	);
	const filters = $derived<{ value: Category; label: string }[]>([
		{ value: 'all', label: 'All' },
		...CATEGORIES.filter((c) => counts[c] > 0 || category === c).map((c) => ({
			value: c,
			label: PROJECT_CATEGORY_FILTER_LABELS[c]
		}))
	]);

	/* Reordering and featuring: one small form each; the row buttons submit them. */
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
	const feature = new AdminForm({
		onSuccess: async (result) => {
			if (typeof result?.featured !== 'string') return;
			await tick();
			document.querySelector<HTMLButtonElement>(`[data-feature="${result.featured}"]`)?.focus();
		}
	});

	function onRowClick(event: MouseEvent, project: Row) {
		if ((event.target as HTMLElement).closest('a, button, input, label')) return;
		void goto(`/admin/projects/${project.id}`);
	}

	const meta = (p: Row) =>
		[labelFor(PROJECT_CATEGORY_LABELS, p.category), yearLabel(p.year, p.yearEnd)].filter(Boolean).join(' · ');
	const head = 'text-label h-10 px-2 text-[11px] font-medium text-ink-muted';
</script>

<PageHeader
	breadcrumb={[{ label: 'Content' }, { label: 'Projects' }]}
	title="Projects"
	description="Robots, software and research on the Projects page, in the order shown here."
>
	{#snippet actions()}
		<AdminButton href="/admin/projects/new">New project</AdminButton>
	{/snippet}
</PageHeader>

<form id="move-form" method="POST" action="?/move" use:enhance={move.submit} hidden></form>
<form id="feature-form" method="POST" action="?/feature" use:enhance={feature.submit} hidden></form>

{#if data.projects.length}
	<div class="flex flex-wrap items-center justify-between gap-3">
		<ToggleGroup.Root
			type="single"
			value={category}
			onValueChange={setCategory}
			aria-label="Filter by category"
			class="flex-wrap gap-1 rounded-[8px] border border-line bg-surface-000 p-1"
		>
			{#each filters as item (item.value)}
				<ToggleGroup.Item
					value={item.value}
					class="h-9 rounded-sm px-3.5 text-sm font-medium text-ink-muted hover:bg-transparent hover:text-ink data-[state=on]:bg-surface-300 data-[state=on]:text-ink"
				>
					{item.label}
					<span class="font-mono text-xs">{counts[item.value]}</span>
				</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
		<InputGroup.Root class="h-11 w-full rounded-sm border-line-strong bg-surface-100 shadow-none sm:w-[280px] dark:bg-surface-100">
			<InputGroup.Addon class="pl-3">
				<SearchIcon class="size-4 text-ink-muted" aria-hidden="true" />
			</InputGroup.Addon>
			<InputGroup.Input
				type="search"
				bind:value={query}
				oninput={() => syncUrl(300)}
				placeholder="Search projects"
				aria-label="Search projects"
				class="h-full"
			/>
		</InputGroup.Root>
	</div>

	{#if visible.length}
		<Panel padding="none">
			<Table.Root class="table-fixed">
				<Table.Header>
					<Table.Row class="border-0 hover:bg-transparent">
						<Table.Head class="w-[60px] px-0 pl-4 sm:w-[84px] sm:pl-[18px]"><span class="sr-only">Cover</span></Table.Head>
						<Table.Head class={head}>Title</Table.Head>
						<Table.Head class="{head} hidden w-[110px] lg:table-cell">Category</Table.Head>
						<Table.Head class="{head} hidden w-[110px] lg:table-cell">Year</Table.Head>
						<Table.Head class="{head} hidden w-[118px] sm:table-cell">Status</Table.Head>
						<Table.Head class="{head} hidden w-[106px] sm:table-cell">On site</Table.Head>
						<Table.Head class="{head} w-[52px] text-center"><span class="sr-only sm:not-sr-only">Home</span></Table.Head>
						<Table.Head class="{head} hidden w-[110px] xl:table-cell">Updated</Table.Head>
						<Table.Head class="{head} w-[88px] pr-4 text-right sm:w-[100px] sm:pr-[18px]">Order</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each visible as project, index (project.id)}
						<Table.Row
							class="cursor-pointer border-0 border-t border-line hover:bg-surface-300/40"
							onclick={(event: MouseEvent) => onRowClick(event, project)}
						>
							<Table.Cell class="px-0 py-2.5 pl-4 sm:pl-[18px]">
								{#if project.coverUrl}
									<img
										src={optimizedSrc(project.coverUrl, 320)}
										alt=""
										loading="lazy"
										class="h-9 w-12 rounded-[4px] border border-line bg-surface-100 object-cover sm:h-[42px] sm:w-14"
									/>
								{:else}
									<span class="flex h-9 w-12 items-center justify-center rounded-[4px] border border-dashed border-line-strong text-line-strong sm:h-[42px] sm:w-14" aria-hidden="true">
										<ImageIcon class="size-4" strokeWidth={1.5} />
									</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="px-2 py-2.5 whitespace-normal">
								<a
									href="/admin/projects/{project.id}"
									class="line-clamp-2 text-sm font-semibold break-words text-ink no-underline hover:text-brand-text sm:block sm:truncate"
								>
									{project.title}
								</a>
								<span class="hidden truncate font-mono text-xs leading-[18px] text-ink-muted sm:block">/projects/{project.slug}</span>
								<span class="block truncate text-xs leading-[18px] text-ink-muted lg:hidden">
									{meta(project)}{#if !project.published}<span class="sm:hidden"> · Hidden</span>{/if}
								</span>
							</Table.Cell>
							<Table.Cell class="hidden truncate px-2 py-2.5 text-sm text-ink-muted lg:table-cell">
								{labelFor(PROJECT_CATEGORY_LABELS, project.category)}
							</Table.Cell>
							<Table.Cell class="hidden truncate px-2 py-2.5 font-mono text-xs text-ink-muted lg:table-cell">
								{yearLabel(project.year, project.yearEnd) || 'No year'}
							</Table.Cell>
							<Table.Cell class="hidden px-2 py-2.5 sm:table-cell">
								{@const tone = TONE_CLASSES[PROJECT_STATUS_TONES[project.status]]}
								<span class={['inline-flex items-center gap-2 text-[13px]', tone.text]}>
									<span class={['size-1.5 shrink-0 rounded-full', tone.dot]} aria-hidden="true"></span>
									{labelFor(PROJECT_STATUS_LABELS, project.status)}
								</span>
							</Table.Cell>
							<Table.Cell class="hidden px-2 py-2.5 sm:table-cell">
								<StatusBadge status={project.published ? 'published' : 'hidden'} />
							</Table.Cell>
							<Table.Cell class="px-1 py-2.5 text-center">
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<AdminButton
												{...props}
												type="submit"
												form="feature-form"
												name="target"
												value="{project.id}:{project.featured ? 'off' : 'on'}"
												variant="ghost"
												size="icon"
												data-feature={project.id}
												aria-pressed={project.featured}
												aria-label={project.featured
													? `${project.title} is featured on the home page. Stop featuring it`
													: `Feature ${project.title} on the home page`}
											>
												<StarIcon
													aria-hidden="true"
													class={project.featured ? 'fill-current text-ink' : 'text-line-strong'}
												/>
											</AdminButton>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>{project.featured ? 'Featured on the home page' : 'Feature on the home page'}</Tooltip.Content>
								</Tooltip.Root>
							</Table.Cell>
							<Table.Cell class="hidden truncate px-2 py-2.5 text-[13px] text-ink-muted xl:table-cell">
								<time datetime={isoString(project.updatedAt)} title={formatDateTime(project.updatedAt)}>
									{timeAgo(project.updatedAt, now)}
								</time>
							</Table.Cell>
							<Table.Cell class="px-2 py-2.5 pr-3 sm:pr-[14px]">
								<div class="flex items-center justify-end gap-0.5">
									<AdminButton
										type="submit"
										form="move-form"
										name="target"
										value="{project.id}:up"
										variant="ghost"
										size="icon-sm"
										data-move="{project.id}:up"
										aria-label="Move {project.title} up"
										disabled={filtered || index === 0}
									>
										<ArrowUpIcon aria-hidden="true" />
									</AdminButton>
									<AdminButton
										type="submit"
										form="move-form"
										name="target"
										value="{project.id}:down"
										variant="ghost"
										size="icon-sm"
										data-move="{project.id}:down"
										aria-label="Move {project.title} down"
										disabled={filtered || index === visible.length - 1}
									>
										<ArrowDownIcon aria-hidden="true" />
									</AdminButton>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Panel>
		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-ink-muted">
			<span role="status">Showing {visible.length} of {data.projects.length}</span>
			<span>
				{#if filtered}
					Clear the search and filter to change the order.
				{:else}
					The star picks the one project featured on the home page.
				{/if}
			</span>
		</div>
	{:else}
		<EmptyState icon={SearchXIcon} title="No projects match" description="Try another word, or show every category.">
			{#snippet actions()}
				<AdminButton variant="outline" onclick={clearFilters}>Clear filters</AdminButton>
			{/snippet}
		</EmptyState>
	{/if}
{:else}
	<EmptyState icon={FolderKanbanIcon} title="No projects yet" description="Add the first robot, software project or research paper.">
		{#snippet actions()}
			<AdminButton href="/admin/projects/new">New project</AdminButton>
		{/snippet}
	</EmptyState>
{/if}
