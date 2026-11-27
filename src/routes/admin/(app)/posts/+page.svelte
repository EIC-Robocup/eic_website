<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CopyPlusIcon from '@lucide/svelte/icons/copy-plus';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import NewspaperIcon from '@lucide/svelte/icons/newspaper';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import SearchIcon from '@lucide/svelte/icons/search';
	import StarIcon from '@lucide/svelte/icons/star';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { POST_CATEGORY_LABELS, POST_CATEGORY_OPTIONS, formatDate, labelFor } from '#lib/content/labels.ts';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Panel from '#lib/components/admin/Panel.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { AdminForm } from '#lib/components/admin/form.svelte.ts';
	import { clearDraft, draftKey, readDraft } from '#lib/components/admin/posts/draft.ts';
	import { STATE_LABELS, formatWhen, postState, type PostState } from '#lib/components/admin/posts/post-fields.ts';
	import { selectTriggerClass } from '#lib/components/admin/styles.ts';
	import { timeAgo } from '#lib/components/admin/sections/time.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const PAGE_SIZE = 20;
	type Filter = 'all' | PostState;
	const FILTERS: { value: Filter; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'published', label: 'Published' },
		{ value: 'draft', label: 'Drafts' },
		{ value: 'scheduled', label: 'Scheduled' }
	];

	let now = $state(untrack(() => new Date(data.now)));
	onMount(() => {
		now = new Date();
		const timer = setInterval(() => (now = new Date()), 30_000);
		return () => clearInterval(timer);
	});

	const rows = $derived(
		data.posts
			.map((post) => ({ ...post, state: postState(post.status, post.publishedAt, now) }))
			.sort((a, b) => {
				// Drafts and scheduled posts first (most recently edited), then the blog, newest first.
				const aLive = a.state === 'published' ? 1 : 0;
				const bLive = b.state === 'published' ? 1 : 0;
				if (aLive !== bLive) return aLive - bLive;
				const at = (p: typeof a) => new Date(p.state === 'published' ? (p.publishedAt ?? p.updatedAt) : p.updatedAt).getTime();
				return at(b) - at(a);
			})
	);
	type Row = (typeof rows)[number];

	/* Filters live in the URL (?status=draft&category=research&q=walkie&page=2). */
	const status = $derived.by((): Filter => {
		const value = page.url.searchParams.get('status');
		return value === 'published' || value === 'draft' || value === 'scheduled' ? value : 'all';
	});
	const category = $derived(page.url.searchParams.get('category') ?? 'all');
	const pageNumber = $derived(Math.max(1, Number(page.url.searchParams.get('page')) || 1));
	let query = $state(untrack(() => page.url.searchParams.get('q') ?? ''));

	function setParams(changes: Record<string, string | null>) {
		const url = new URL(page.url.href);
		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === '' || value === 'all') url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		}
		if (!('page' in changes)) url.searchParams.delete('page');
		void goto(url, { replace: true, reset: false });
	}

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function onsearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => setParams({ q: query.trim() || null }), 300);
	}

	const needle = $derived(query.trim().toLowerCase());
	const matches = (row: Row) =>
		(category === 'all' || row.category === category) &&
		(!needle ||
			row.title.toLowerCase().includes(needle) ||
			row.slug.includes(needle) ||
			(row.authorName ?? '').toLowerCase().includes(needle));

	const searched = $derived(rows.filter(matches));
	const counts = $derived({
		all: searched.length,
		published: searched.filter((r) => r.state === 'published').length,
		draft: searched.filter((r) => r.state === 'draft').length,
		scheduled: searched.filter((r) => r.state === 'scheduled').length
	});
	const filtered = $derived(status === 'all' ? searched : searched.filter((r) => r.state === status));
	const pages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const currentPage = $derived(Math.min(pageNumber, pages));
	const visible = $derived(filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));
	const filtering = $derived(Boolean(needle) || category !== 'all' || status !== 'all');

	const categoryLabel = $derived(category === 'all' ? 'All categories' : labelFor(POST_CATEGORY_LABELS, category));

	function dateText(row: Row): string {
		if (row.state === 'draft') return 'Not yet';
		if (row.state === 'scheduled') return `Scheduled for ${formatDate(row.publishedAt)}`;
		return formatDate(row.publishedAt);
	}

	/* Unsaved copies kept in this browser by the editor. */
	let unsaved = $state<Set<string>>(new Set());
	onMount(() => {
		const found = new Set<string>();
		for (const post of data.posts) {
			const draft = readDraft(draftKey(post.id));
			if (draft && draft.savedAt > new Date(post.updatedAt).getTime()) found.add(post.id);
		}
		unsaved = found;

		// Back from deleting a post in the editor.
		const deleted = page.url.searchParams.get('deleted');
		if (deleted) {
			clearDraft(draftKey(deleted));
			toast.success('Post deleted.');
			void tick().then(() => setParams({ deleted: null }));
		}
	});

	/* Row actions */
	let duplicateForm: HTMLFormElement | undefined = $state();
	let duplicateId = $state('');
	const duplicate = new AdminForm({ success: 'Copy created. You are editing the copy.' });

	async function duplicatePost(id: string) {
		duplicateId = id;
		await tick();
		duplicateForm?.requestSubmit();
	}

	async function copyLink(row: Row) {
		const url = new URL(`/blog/${row.slug}`, page.url.origin).href;
		try {
			await navigator.clipboard.writeText(url);
			toast.success('Link copied.', { description: url });
		} catch {
			toast.error('Could not copy the link.', { description: url });
		}
	}

	const headClass = 'text-label h-10 px-2 text-[11px] font-medium text-ink-muted';
</script>

<PageHeader breadcrumb={[{ label: 'Content' }, { label: 'Posts' }]} title="Posts">
	{#snippet actions()}
		<AdminButton href="/admin/posts/new">New post</AdminButton>
	{/snippet}
</PageHeader>

<form bind:this={duplicateForm} method="POST" action="?/duplicate" use:enhance={duplicate.submit} hidden>
	<input type="hidden" name="id" value={duplicateId} />
</form>

<Tabs.Root value={status} onValueChange={(value) => setParams({ status: value })} class="gap-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<Tabs.List
			aria-label="Filter by status"
			class="grid h-auto w-full grid-cols-2 gap-1 rounded-[8px] border border-line bg-surface-000 p-1 group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit sm:justify-start"
		>
			{#each FILTERS as item (item.value)}
				<Tabs.Trigger
					value={item.value}
					class="h-10 flex-none rounded-sm px-2.5 text-sm sm:px-3.5 font-medium text-ink-muted hover:text-ink data-active:border-transparent data-active:bg-surface-300 data-active:text-ink data-active:shadow-none dark:text-ink-muted dark:data-active:border-transparent dark:data-active:bg-surface-300"
				>
					{item.label}
					<span class="font-mono text-xs">{counts[item.value]}</span>
				</Tabs.Trigger>
			{/each}
		</Tabs.List>

		<div class="flex w-full flex-wrap gap-3 sm:w-auto">
			<Select.Root type="single" value={category} onValueChange={(value) => setParams({ category: value })}>
				<Select.Trigger aria-label="Filter by category" class={[selectTriggerClass, 'w-full sm:w-[180px]'].join(' ')}>
					{categoryLabel}
				</Select.Trigger>
				<Select.Content class="border border-line bg-surface-200">
					<Select.Item value="all" label="All categories" class="min-h-10" />
					{#each POST_CATEGORY_OPTIONS as option (option.value)}
						<Select.Item value={option.value} label={option.label} class="min-h-10" />
					{/each}
				</Select.Content>
			</Select.Root>
			<InputGroup.Root class="h-11 w-full rounded-sm border-line-strong bg-surface-100 shadow-none sm:w-[260px] dark:bg-surface-100">
				<InputGroup.Addon><SearchIcon aria-hidden="true" class="text-ink-muted" /></InputGroup.Addon>
				<InputGroup.Input
					type="search"
					bind:value={query}
					oninput={onsearch}
					placeholder="Search posts"
					aria-label="Search posts by title, URL or author"
				/>
			</InputGroup.Root>
		</div>
	</div>

	<Tabs.Content value={status} class="flex flex-col gap-3">
		{#if !data.posts.length}
			<EmptyState icon={NewspaperIcon} title="No posts yet" description="Write the first lab note: a build log, a competition recap or a how it works.">
				{#snippet actions()}<AdminButton href="/admin/posts/new">New post</AdminButton>{/snippet}
			</EmptyState>
		{:else if !visible.length}
			<EmptyState
				icon={SearchIcon}
				compact
				title={needle ? `No posts match “${query.trim()}”` : `No ${status === 'all' ? '' : STATE_LABELS[status as PostState].toLowerCase() + ' '}posts${category === 'all' ? '' : ` in ${categoryLabel}`}`}
				description={status === 'scheduled' ? 'Publish a post with a future date to schedule it.' : 'Try another filter.'}
			>
				{#snippet actions()}
					{#if filtering}
						<AdminButton
							variant="outline"
							onclick={() => {
								query = '';
								setParams({ q: null, category: null, status: null });
							}}>Clear filters</AdminButton
						>
					{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<Panel padding="none">
				<Table.Root class="table-fixed">
					<Table.Header>
						<Table.Row class="border-0 hover:bg-transparent">
							<Table.Head class="{headClass} pl-4 sm:pl-[18px]">Title</Table.Head>
							<Table.Head class="{headClass} hidden w-[120px] md:table-cell">Category</Table.Head>
							<Table.Head class="{headClass} w-[100px] sm:w-[112px]">Status</Table.Head>
							<Table.Head class="{headClass} hidden w-[150px] lg:table-cell">Author</Table.Head>
							<Table.Head class="{headClass} hidden w-[150px] sm:table-cell">Date</Table.Head>
							<Table.Head class="w-[52px] pr-2"><span class="sr-only">Actions</span></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each visible as row (row.id)}
							<Table.Row class="relative border-0 border-t border-line hover:bg-surface-300/40 has-[a:focus-visible]:bg-surface-300/40">
								<Table.Cell class="py-3 pl-4 whitespace-normal sm:pl-[18px]">
									<a
										href="/admin/posts/{row.id}"
										class="flex min-h-6 items-center gap-1.5 text-sm font-semibold text-ink no-underline outline-none after:absolute after:inset-0 hover:text-ink focus-visible:underline"
									>
										<span class="line-clamp-2 sm:line-clamp-1">{row.title}</span>
										{#if row.featured}
											<StarIcon class="size-3.5 shrink-0 fill-current text-ink-muted" aria-hidden="true" />
											<span class="sr-only">(featured)</span>
										{/if}
									</a>
									<!-- Phones and tablets: the hidden columns, under the title. -->
									<span class="mt-0.5 block truncate text-xs leading-[18px] text-ink-muted lg:hidden">
										<span class="md:hidden">{`${labelFor(POST_CATEGORY_LABELS, row.category)} · `}</span>{row.authorName || 'No author'}<span
											class="sm:hidden">{` · ${dateText(row)}`}</span
										>
									</span>
									{#if unsaved.has(row.id)}
										<span class="mt-0.5 block text-xs leading-[18px] text-brand-text">Unsaved changes on this device</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="hidden px-2 text-sm text-ink-muted md:table-cell">{labelFor(POST_CATEGORY_LABELS, row.category)}</Table.Cell>
								<Table.Cell class="px-2">
									<StatusBadge
										status={row.state}
										label={STATE_LABELS[row.state]}
										tone={row.state === 'published' ? 'success' : 'neutral'}
										dot={row.state === 'scheduled'}
									/>
								</Table.Cell>
								<Table.Cell class="hidden truncate px-2 text-sm text-ink-muted lg:table-cell">{row.authorName || '·'}</Table.Cell>
								<Table.Cell class="hidden px-2 font-mono text-xs whitespace-normal text-ink-muted sm:table-cell">
									<span title={row.publishedAt ? formatWhen(row.publishedAt) : `Edited ${timeAgo(row.updatedAt, now, { lower: true })}`}>{dateText(row)}</span>
								</Table.Cell>
								<Table.Cell class="relative z-10 pr-2 text-right">
									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													variant="ghost"
													size="icon"
													class="size-11 rounded-sm text-ink-muted hover:bg-surface-300 hover:text-ink dark:hover:bg-surface-300"
													aria-label="Actions for {row.title}"
												>
													<EllipsisIcon aria-hidden="true" />
												</Button>
											{/snippet}
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" class="w-52 border border-line bg-surface-200">
											<DropdownMenu.Item class="min-h-10" onSelect={() => goto(`/admin/posts/${row.id}`)}>
												<PencilIcon aria-hidden="true" />Edit
											</DropdownMenu.Item>
											{#if row.state === 'published'}
												<DropdownMenu.Item class="min-h-10" onSelect={() => window.open(`/blog/${row.slug}`, '_blank', 'noopener')}>
													<ExternalLinkIcon aria-hidden="true" />View on the blog
												</DropdownMenu.Item>
												<DropdownMenu.Item class="min-h-10" onSelect={() => copyLink(row)}>
													<CopyIcon aria-hidden="true" />Copy link
												</DropdownMenu.Item>
											{/if}
											<DropdownMenu.Separator />
											<DropdownMenu.Item class="min-h-10" disabled={duplicate.pending} onSelect={() => duplicatePost(row.id)}>
												<CopyPlusIcon aria-hidden="true" />Duplicate as draft
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Panel>

			<div class="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted">
				<span aria-live="polite">
					{#if filtered.length > PAGE_SIZE}
						Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
					{:else}
						Showing {filtered.length} of {data.posts.length}
					{/if}
				</span>
				{#if pages > 1}
					<nav aria-label="Pages" class="flex gap-2">
						<AdminButton variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => setParams({ page: String(currentPage - 1) })}>
							Previous
						</AdminButton>
						<AdminButton variant="outline" size="sm" disabled={currentPage >= pages} onclick={() => setParams({ page: String(currentPage + 1) })}>
							Next
						</AdminButton>
					</nav>
				{/if}
			</div>
		{/if}
	</Tabs.Content>
</Tabs.Root>
