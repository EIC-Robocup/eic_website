<script lang="ts">
	import { untrack } from 'svelte';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { POST_CATEGORY_LABELS, labelFor } from '#lib/content/labels.ts';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Panel from '#lib/components/admin/Panel.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { formatDateTime, isoString, timeAgo } from '#lib/components/admin/sections/time.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	// The server's clock first (same text in SSR and hydration), then ticking in the browser.
	let now = $state(untrack(() => data.now));
	$effect(() => {
		now = new Date();
		const timer = setInterval(() => (now = new Date()), 30_000);
		return () => clearInterval(timer);
	});

	const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

	const stats = $derived.by(() => {
		const c = data.counts;
		if (!c) return [];
		const years = c.achievements.firstYear && c.achievements.lastYear;
		return [
			{ label: 'Projects', value: c.projects.total, note: `${c.projects.ongoing} ongoing`, href: '/admin/projects' },
			{
				label: 'Posts',
				value: c.posts.total,
				note: `${c.posts.published} published · ${plural(c.posts.drafts, 'draft')}`,
				href: '/admin/posts'
			},
			{
				label: 'People',
				value: c.people.total,
				note: `${plural(c.people.teams, 'team')} · ${plural(c.people.advisors, 'advisor')}`,
				href: '/admin/people'
			},
			{
				label: 'Achievements',
				value: c.achievements.count,
				note: years
					? c.achievements.firstYear === c.achievements.lastYear
						? `${c.achievements.firstYear}`
						: `${c.achievements.firstYear} to ${c.achievements.lastYear}`
					: 'None logged yet',
				href: '/admin/lists'
			}
		];
	});

	const unread = $derived(data.counts?.messages.unread ?? 0);

	const quickActions = [
		{ label: 'New project', href: '/admin/projects/new' },
		{ label: 'Edit the home page', href: '/admin/pages/home' },
		{ label: 'Add a team member', href: '/admin/people' },
		{ label: 'Log an achievement', href: '/admin/lists' }
	];
</script>

<PageHeader breadcrumb={[{ label: 'Site' }]} title="Dashboard">
	{#snippet actions()}
		<AdminButton variant="outline" href="/" external>View website</AdminButton>
		<AdminButton href="/admin/posts/new">New post</AdminButton>
	{/snippet}
</PageHeader>

{#if !data.counts}
	<Panel title="The database could not be reached" stacked>
		<p class="m-0 text-sm leading-[22px] text-ink-muted">
			The numbers and recent edits will show once the connection is back. Reload the page in a minute, or check
			<a href="/admin/settings" class="text-brand-text hover:text-ink">Site status in Settings</a>.
		</p>
	</Panel>
{:else}
	<ul class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-4">
		{#each stats as stat (stat.label)}
			<li class="min-w-0">
				<a href={stat.href} class="group block h-full rounded-lg text-ink no-underline">
					<Card.Root
						class="h-full gap-2.5 rounded-lg border border-line bg-surface-200 p-4 shadow-none ring-0 transition-colors group-hover:border-ink sm:p-5"
					>
						<span class="text-label text-ink-muted">{stat.label}</span>
						<span class="font-display text-[34px] leading-none font-medium tracking-[-0.03em] sm:text-[40px]">
							{stat.value}
						</span>
						<span class="text-[13px] leading-5 text-ink-muted">{stat.note}</span>
					</Card.Root>
				</a>
			</li>
		{/each}
	</ul>

	{#if unread > 0}
		<section
			aria-labelledby="inbox-callout"
			class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-200 px-4 py-3 sm:px-[18px]"
		>
			<div class="flex min-w-0 items-center gap-3">
				<span class="size-2 shrink-0 rounded-full bg-brand-text" aria-hidden="true"></span>
				<div class="min-w-0">
					<h2 id="inbox-callout" class="m-0 text-sm leading-5 font-semibold text-ink">
						{plural(unread, 'unread message')}
					</h2>
					<p class="m-0 text-[13px] leading-5 text-ink-muted">From the contact form on the About page.</p>
				</div>
			</div>
			<AdminButton variant="outline" size="sm" href="/admin/inbox?filter=unread">Open inbox</AdminButton>
		</section>
	{/if}
{/if}

<div class="flex flex-wrap items-start gap-6">
	<Panel title="Recent edits" padding="none" class="flex-[999_1_520px]">
		{#snippet actions()}
			<span class="text-label text-ink-muted">Newest first</span>
		{/snippet}
		{#if data.edits.length}
			<Table.Root class="table-fixed border-collapse">
				<Table.Header>
					<Table.Row class="border-0 border-t border-line hover:bg-transparent">
						<Table.Head class="text-label h-9 px-4 text-[11px] font-medium text-ink-muted sm:px-[18px]">Item</Table.Head>
						<Table.Head class="text-label hidden h-9 w-[132px] px-2 text-[11px] font-medium text-ink-muted sm:table-cell">
							Type
						</Table.Head>
						<Table.Head class="text-label hidden h-9 w-[130px] px-2 text-[11px] font-medium text-ink-muted md:table-cell">
							By
						</Table.Head>
						<Table.Head class="text-label h-9 w-[104px] px-4 text-[11px] font-medium text-ink-muted sm:w-[118px] sm:pr-[18px]">
							When
						</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.edits as edit (edit.id)}
						<Table.Row class="border-0 border-t border-line hover:bg-surface-300/40">
							<Table.Cell class="truncate px-4 py-3 text-sm sm:px-[18px]">
								{#if edit.href}
									<a href={edit.href} class="font-medium text-ink no-underline hover:underline">{edit.label}</a>
								{:else}
									<span class="font-medium">{edit.label}</span>
								{/if}
								<span class="text-ink-muted">{edit.action}</span>
								<span class="text-ink-muted sm:hidden">· {edit.type}</span>
							</Table.Cell>
							<Table.Cell class="hidden px-2 py-3 sm:table-cell">
								<StatusBadge label={edit.type} tone="neutral" />
							</Table.Cell>
							<Table.Cell class="hidden truncate px-2 py-3 text-sm text-ink-muted md:table-cell" title={edit.byEmail ?? undefined}>
								{edit.by ?? 'Someone'}
							</Table.Cell>
							<Table.Cell class="truncate px-4 py-3 text-sm text-ink-muted sm:pr-[18px]">
								<time datetime={isoString(edit.at)} title={formatDateTime(edit.at)}>{timeAgo(edit.at, now)}</time>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{:else}
			<div class="border-t border-line p-4 sm:p-[18px]">
				<EmptyState
					compact
					icon={HistoryIcon}
					title="No edits yet"
					description="Saved changes to pages, projects, posts and people show up here."
				/>
			</div>
		{/if}
	</Panel>

	<div class="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
		<Panel title="Quick actions" padding="sm" class="gap-2.5">
			<ul class="m-0 flex list-none flex-col gap-2.5 p-0">
				{#each quickActions as action, i (action.href)}
					<li>
						<AdminButton
							variant="outline"
							href={action.href}
							class="h-12 w-full justify-start gap-3 rounded-[8px] border-line bg-surface-100 px-3.5 font-medium dark:border-line dark:bg-surface-100"
						>
							<span class="font-mono text-[13px] text-brand-text" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
							{action.label}
						</AdminButton>
					</li>
				{/each}
			</ul>
		</Panel>

		<Panel title="Drafts" padding="sm">
			{#snippet actions()}
				<StatusBadge label={String(data.counts?.posts.drafts ?? data.drafts.length)} tone="neutral" />
			{/snippet}
			{#if data.drafts.length}
				<ul class="m-0 flex list-none flex-col p-0">
					{#each data.drafts as draft (draft.id)}
						<li class="border-t border-line">
							<a
								href="/admin/posts/{draft.id}"
								class="group flex min-h-11 flex-col gap-1 py-3 text-ink no-underline"
							>
								<span class="text-sm leading-5 font-semibold group-hover:underline">{draft.title}</span>
								<span class="text-xs leading-[18px] text-ink-muted">
									{labelFor(POST_CATEGORY_LABELS, draft.category)} · edited
									<time datetime={isoString(draft.updatedAt)} title={formatDateTime(draft.updatedAt)}
										>{timeAgo(draft.updatedAt, now, { lower: true })}</time
									>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="m-0 border-t border-line pt-3 text-[13px] leading-5 text-ink-muted">
					No drafts. Everything written is published.
				</p>
			{/if}
		</Panel>
	</div>
</div>
