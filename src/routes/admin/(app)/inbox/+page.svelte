<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import MailCheckIcon from '@lucide/svelte/icons/mail-check';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { MESSAGE_TOPIC_LABELS, labelFor } from '#lib/content/labels.ts';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import ConfirmDelete from '#lib/components/admin/ConfirmDelete.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Panel from '#lib/components/admin/Panel.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { AdminForm } from '#lib/components/admin/form.svelte.ts';
	import { formatDateTime, isoString, timeAgo } from '#lib/components/admin/sections/time.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	type Message = (typeof data.messages)[number];
	type Filter = 'all' | 'unread' | 'archived';
	const FILTERS: { value: Filter; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'unread', label: 'Unread' },
		{ value: 'archived', label: 'Archived' }
	];

	let now = $state(untrack(() => data.now));
	$effect(() => {
		now = new Date();
		const timer = setInterval(() => (now = new Date()), 30_000);
		return () => clearInterval(timer);
	});

	/* Filter tabs, kept in the URL (?filter=unread) so a reload or a link keeps them. */
	const filter = $derived.by((): Filter => {
		const value = page.url.searchParams.get('filter');
		return value === 'unread' || value === 'archived' ? value : 'all';
	});
	const isUnread = (m: Message) => !m.readAt && !m.archived;
	const counts = $derived({
		all: data.messages.filter((m) => !m.archived).length,
		unread: data.messages.filter(isUnread).length,
		archived: data.messages.filter((m) => m.archived).length
	});
	const visible = $derived(
		data.messages.filter((m) => (filter === 'archived' ? m.archived : filter === 'unread' ? isUnread(m) : !m.archived))
	);

	function setFilter(value: string) {
		const url = new URL(page.url.href);
		if (value === 'all') url.searchParams.delete('filter');
		else url.searchParams.set('filter', value);
		void goto(url, { replace: true, reset: false });
	}

	/* The open message. Kept as a snapshot too, so the sheet can finish closing after a delete. */
	let sheetOpen = $state(false);
	let currentId = $state<string | null>(null);
	let snapshot = $state<Message | null>(null);
	const current = $derived(data.messages.find((m) => m.id === currentId) ?? snapshot);

	let readForm: HTMLFormElement | undefined = $state();
	let readId = $state('');
	const markRead = new AdminForm({ success: false });

	async function openMessage(message: Message) {
		currentId = message.id;
		snapshot = message;
		sheetOpen = true;
		if (!message.readAt) {
			readId = message.id;
			await tick();
			readForm?.requestSubmit();
		}
	}

	function onRowClick(event: MouseEvent, message: Message) {
		if ((event.target as HTMLElement).closest('a, button')) return;
		void openMessage(message);
	}

	function returnFocus(event: Event) {
		event.preventDefault();
		const id = currentId;
		if (!id) return;
		document.querySelector<HTMLElement>(`[data-message-button="${id}"]`)?.focus();
	}

	function closeSheet() {
		sheetOpen = false;
	}
	const unreadForm = new AdminForm({ onSuccess: closeSheet });
	const archiveForm = new AdminForm({ onSuccess: closeSheet });

	const excerpt = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 160);
	const topicLabel = (topic: string) => labelFor(MESSAGE_TOPIC_LABELS, topic);

	// The address comes from a public form: only plain addresses become mailto links, so
	// nothing like "a@b.c?bcc=..." can add recipients or headers.
	const PLAIN_EMAIL = /^[^\s@<>()[\]\\,;:"?&=#%]+@[^\s@<>()[\]\\,;:"?&=#%]+\.[^\s@<>()[\]\\,;:"?&=#%]+$/;
	const canReply = (m: Message) => PLAIN_EMAIL.test(m.email);

	function replyHref(m: Message): string {
		// Short quote: some mail clients cut mailto links at about 2000 characters.
		const quoted = m.body.length > 300 ? `${m.body.slice(0, 300)}...` : m.body;
		const body = `\n\n\nOn ${formatDateTime(m.createdAt)}, ${m.name} wrote:\n${quoted
			.split('\n')
			.map((line) => `> ${line}`)
			.join('\n')}`;
		const subject = `Re: ${topicLabel(m.topic)} · EIC Chula`;
		return `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
	}

	const EMPTY = {
		all: { icon: InboxIcon, title: 'No messages yet', description: 'Messages sent with the contact form on the About page show up here.' },
		unread: { icon: MailCheckIcon, title: 'All caught up', description: 'Every message has been read.' },
		archived: { icon: ArchiveIcon, title: 'Nothing archived', description: 'Archive a message to move it out of the inbox without deleting it.' }
	} as const;
	const empty = $derived(EMPTY[filter]);
</script>

<PageHeader
	breadcrumb={[{ label: 'Library' }, { label: 'Inbox' }]}
	title="Inbox"
	description="Messages from the contact form on the About page. Open one to read it and reply by email."
/>

<form bind:this={readForm} method="POST" action="?/read" use:enhance={markRead.submit} hidden>
	<input type="hidden" name="id" value={readId} />
</form>

<Tabs.Root value={filter} onValueChange={setFilter} class="gap-4">
	<Tabs.List
		aria-label="Filter messages"
		class="h-auto gap-1 self-start rounded-[8px] border border-line bg-surface-000 p-1"
	>
		{#each FILTERS as item (item.value)}
			<Tabs.Trigger
				value={item.value}
				class="h-9 flex-none rounded-sm px-3.5 text-sm font-medium text-ink-muted hover:text-ink data-active:border-transparent data-active:bg-surface-300 data-active:text-ink data-active:shadow-none dark:text-ink-muted dark:data-active:border-transparent dark:data-active:bg-surface-300"
			>
				{item.label}
				<span class="font-mono text-xs opacity-60">{counts[item.value]}</span>
			</Tabs.Trigger>
		{/each}
	</Tabs.List>

	<Tabs.Content value={filter} class="flex flex-col gap-3">
		{#if visible.length}
			<Panel padding="none">
				<Table.Root class="table-fixed">
					<Table.Header>
						<Table.Row class="border-0 hover:bg-transparent">
							<Table.Head class="w-7 px-0 pl-4 sm:pl-[18px]"><span class="sr-only">Status</span></Table.Head>
							<Table.Head class="text-label h-10 px-2 text-[11px] font-medium text-ink-muted sm:w-[210px]">From</Table.Head>
							<Table.Head class="text-label hidden h-10 w-[150px] px-2 text-[11px] font-medium text-ink-muted lg:table-cell">
								Topic
							</Table.Head>
							<Table.Head class="text-label hidden h-10 px-2 text-[11px] font-medium text-ink-muted sm:table-cell">
								Message
							</Table.Head>
							<Table.Head class="text-label h-10 w-[108px] px-2 pr-4 text-right text-[11px] font-medium text-ink-muted sm:w-[120px] sm:pr-[18px]">
								Received
							</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each visible as message (message.id)}
							{@const unread = !message.readAt}
							<Table.Row
								class="cursor-pointer border-0 border-t border-line hover:bg-surface-300/40"
								onclick={(event: MouseEvent) => onRowClick(event, message)}
							>
								<Table.Cell class="px-0 py-3 pl-4 align-top sm:pl-[18px] sm:align-middle">
									{#if unread}
										<span class="mt-1.5 block size-2 rounded-full bg-brand-text sm:mt-0" aria-hidden="true"></span>
									{/if}
								</Table.Cell>
								<Table.Cell class="px-2 py-3 whitespace-normal">
									<button
										type="button"
										data-message-button={message.id}
										class="-mx-1 -my-2 flex min-h-11 w-[calc(100%+0.5rem)] min-w-0 flex-col items-start justify-center rounded-sm px-1 py-1 text-left"
										onclick={() => openMessage(message)}
									>
										<span class={['w-full truncate text-sm text-ink', unread ? 'font-semibold' : 'font-normal']}>
											{#if unread}<span class="sr-only">Unread: </span>{/if}{message.name}
										</span>
										<span class="w-full truncate text-xs leading-[18px] text-ink-muted lg:hidden">{topicLabel(message.topic)}</span>
										<span class={['w-full truncate text-[13px] leading-5 sm:hidden', unread ? 'text-ink' : 'text-ink-muted']}>
											{excerpt(message.body)}
										</span>
									</button>
								</Table.Cell>
								<Table.Cell class="hidden truncate px-2 py-3 text-sm text-ink-muted lg:table-cell">
									{topicLabel(message.topic)}
								</Table.Cell>
								<Table.Cell class={['hidden truncate px-2 py-3 text-sm sm:table-cell', unread ? 'text-ink' : 'text-ink-muted']}>
									{excerpt(message.body)}
								</Table.Cell>
								<Table.Cell class="truncate px-2 py-3 pr-4 text-right align-top text-[13px] text-ink-muted sm:pr-[18px] sm:align-middle">
									<time datetime={isoString(message.createdAt)} title={formatDateTime(message.createdAt)}>
										{timeAgo(message.createdAt, now)}
									</time>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Panel>
			{#if data.messages.length >= data.limit}
				<p class="m-0 text-[13px] text-ink-muted">Showing the newest {data.limit} messages.</p>
			{/if}
		{:else}
			<EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
		{/if}
	</Tabs.Content>
</Tabs.Root>

<Sheet.Root bind:open={sheetOpen}>
	<Sheet.Content
		side="right"
		class="w-full gap-0 border-line bg-surface-200 p-0 data-[side=right]:w-full sm:data-[side=right]:max-w-lg"
		onCloseAutoFocus={returnFocus}
	>
		{#if current}
			<Sheet.Header class="gap-2 border-b border-line p-5 pr-14">
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-label text-brand-text">{topicLabel(current.topic)}</span>
					{#if current.archived}<StatusBadge status="archived" />{/if}
				</div>
				<Sheet.Title class="font-display text-xl leading-7 font-semibold tracking-[-0.01em] text-ink">
					{current.name}
				</Sheet.Title>
				<Sheet.Description class="flex flex-col gap-0.5 text-[13px] leading-5 text-ink-muted">
					{#if canReply(current)}
						<a href="mailto:{current.email}" class="w-fit break-all text-brand-text hover:text-ink">{current.email}</a>
					{:else}
						<span class="break-all">{current.email}</span>
					{/if}
					<span>
						Sent <time datetime={isoString(current.createdAt)}>{formatDateTime(current.createdAt)}</time>
					</span>
				</Sheet.Description>
			</Sheet.Header>

			<div class="min-h-0 flex-1 overflow-y-auto p-5">
				<p class="m-0 text-[15px] leading-[26px] [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">{current.body}</p>
			</div>

			<Sheet.Footer class="flex-row flex-wrap items-center gap-2 border-t border-line p-4">
				{#if canReply(current)}
					<AdminButton href={replyHref(current)}>Reply by email</AdminButton>
				{/if}
				<form method="POST" action="?/unread" use:enhance={unreadForm.submit}>
					<input type="hidden" name="id" value={current.id} />
					<AdminButton type="submit" variant="outline" pending={unreadForm.pending}>Mark unread</AdminButton>
				</form>
				<form method="POST" action={current.archived ? '?/unarchive' : '?/archive'} use:enhance={archiveForm.submit}>
					<input type="hidden" name="id" value={current.id} />
					<AdminButton type="submit" variant="outline" pending={archiveForm.pending}>
						{current.archived ? 'Move to inbox' : 'Archive'}
					</AdminButton>
				</form>
				<div class="ml-auto">
					<ConfirmDelete
						action="?/delete"
						id={current.id}
						title="Delete this message?"
						description="The message from {current.name} is removed for good. Archive it instead to keep a copy."
						confirmLabel="Delete message"
						success="Message deleted."
						ondeleted={closeSheet}
					>
						{#snippet trigger(props)}
							<AdminButton {...props} variant="danger-text" class="px-2">Delete</AdminButton>
						{/snippet}
					</ConfirmDelete>
				</div>
			</Sheet.Footer>
		{/if}
	</Sheet.Content>
</Sheet.Root>
