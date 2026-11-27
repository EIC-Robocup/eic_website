<!--
	The Pages editor for one page: the page list, one SectionPanel per section, and a single
	"Publish changes" form that submits every section as JSON (`section.<key>`). Keeps the
	drafts in $state, compares them with what the site shows to know what is unpublished, and
	asks before leaving with unpublished changes. Rendered inside {#key data.page}, so each
	page gets fresh drafts.
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { pages, type SectionDef } from '#lib/content/sections.ts';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import { AdminForm } from '#lib/components/admin/form.svelte.ts';
	import SectionPanel from '#lib/components/admin/sections/SectionPanel.svelte';
	import { previewStat, setRowPreviewers } from '#lib/components/admin/sections/preview.ts';
	import { formatDateTime, isoString, timeAgo } from '#lib/components/admin/sections/time.ts';
	import {
		sectionErrors,
		stableStringify,
		validateSection,
		type SectionDraft
	} from '#lib/components/admin/sections/values.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// "Shows 41 people · 3 advisors" under each number, from the counts in the load.
	setRowPreviewers({
		stat: (item, index, items) => previewStat(data.siteCounts, item, index, items)
	});

	type Drafts = Record<string, SectionDraft>;

	const clone = (value: Drafts): Drafts => structuredClone($state.snapshot(value)) as Drafts;

	const pageDef = $derived(pages[data.page]);
	const sections = $derived(Object.entries(pageDef.sections as Record<string, SectionDef>));
	const title = $derived(data.page === 'site' ? pageDef.title : `${pageDef.title} page`);

	let drafts: Drafts = $state(untrack(() => clone(data.values)));
	let now = $state(untrack(() => data.now));
	/** Show field errors once someone has tried to publish. */
	let attempted = $state(false);
	let formEl: HTMLFormElement | undefined = $state();
	let submittedSnapshot = '';

	const dirty = $derived(stableStringify(drafts) !== stableStringify(data.values));
	const dirtyCount = $derived(
		sections.filter(([key]) => stableStringify(drafts[key]) !== stableStringify(data.values[key])).length
	);

	const liveErrors = $derived.by(() => {
		const out: Record<string, string> = {};
		for (const [key, def] of sections) {
			for (const [path, message] of Object.entries(validateSection(def, drafts[key]?.data))) {
				out[`${key}.${path}`] = message;
			}
		}
		return out;
	});
	const errors = $derived(attempted ? liveErrors : {});

	$effect(() => {
		const timer = setInterval(() => (now = new Date()), 30_000);
		return () => clearInterval(timer);
	});

	async function focusFirstError() {
		await tick();
		const target = document.querySelector<HTMLElement>('[data-page-editor] [aria-invalid="true"]');
		target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		target?.focus({ preventScroll: true });
	}

	const save = new AdminForm({
		onSubmit: () => {
			attempted = true;
			const count = Object.keys(liveErrors).length;
			if (count) {
				toast.error(count === 1 ? 'One field needs a fix before publishing.' : `${count} fields need a fix before publishing.`);
				void focusFirstError();
				return false;
			}
			submittedSnapshot = stableStringify(drafts);
		},
		onSuccess: () => {
			attempted = false;
			now = new Date();
			// Take the saved (cleaned) values, unless the editor kept typing while it saved.
			if (stableStringify(drafts) === submittedSnapshot) drafts = clone(data.values);
		},
		onFailure: () => {
			void focusFirstError();
		}
	});

	function onkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 's') {
			event.preventDefault();
			if (!save.pending) formEl?.requestSubmit();
		}
	}

	/* Ask before leaving with unpublished changes. */
	let leaveOpen = $state(false);
	let leaving: { url: URL; delta?: number } | null = null;
	let bypass = false;

	beforeNavigate((navigation) => {
		if (bypass || !dirty) return;
		if (navigation.willUnload) {
			// Reload, tab close or another site: the browser shows its own prompt.
			navigation.cancel();
			return;
		}
		if (!navigation.to) return;
		navigation.cancel();
		leaving = {
			url: navigation.to.url,
			delta: navigation.type === 'popstate' ? navigation.delta : undefined
		};
		leaveOpen = true;
	});

	async function leave() {
		const target = leaving;
		leaveOpen = false;
		if (!target) return;
		bypass = true;
		if (target.delta) history.go(target.delta);
		else await goto(target.url);
	}

	const pad = (n: number) => String(n).padStart(2, '0');
</script>

<svelte:window {onkeydown} />

<form
	bind:this={formEl}
	method="POST"
	action="?/publish"
	use:enhance={save.submit}
	class="contents"
	aria-label="Publish {title}"
>
	{#each sections as [key] (key)}
		<input type="hidden" name="section.{key}" value={JSON.stringify(drafts[key])} />
	{/each}

	<PageHeader breadcrumb={[{ label: 'Site' }, { label: 'Pages', href: '/admin/pages' }]} {title}>
		{#snippet actions()}
			<span class="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-muted" aria-live="polite">
				{#if dirty}
					<span class="size-1.5 rounded-full bg-brand-text" aria-hidden="true"></span>
					<span class="text-ink">
						{dirtyCount === 1 ? '1 section' : `${dirtyCount} sections`} not published
					</span>
				{:else if data.lastSaved}
					<span>
						Saved
						<time datetime={isoString(data.lastSaved)} title={formatDateTime(data.lastSaved)}
							>{timeAgo(data.lastSaved, now, { lower: true })}</time
						>
					</span>
				{:else}
					<span>Showing the default copy</span>
				{/if}
			</span>
			<AdminButton variant="outline" href={pageDef.path} external>
				{data.page === 'site' ? 'View site' : 'View page'}
			</AdminButton>
			<AdminButton
				type="submit"
				pending={save.pending}
				pendingLabel="Publishing"
				aria-keyshortcuts="Control+S Meta+S"
			>
				Publish changes
			</AdminButton>
		{/snippet}
	</PageHeader>
</form>

<div class="flex flex-wrap items-start gap-6">
	<nav
		aria-label="Pages"
		class="grid w-full min-w-0 grid-cols-2 gap-0.5 rounded-lg border border-line bg-surface-200 p-2 sm:grid-cols-3 lg:sticky lg:top-6 lg:flex lg:w-auto lg:flex-[1_1_220px] lg:flex-col"
	>
		{#each data.pageList as item (item.key)}
			{@const current = item.key === data.page}
			<AdminButton
				href="/admin/pages/{item.key}"
				variant="ghost"
				aria-current={current ? 'page' : undefined}
				class={[
					'h-auto min-h-11 w-full justify-between gap-3 px-3 py-2 text-left text-sm font-medium whitespace-normal',
					current && 'bg-surface-300 text-ink'
				].join(' ')}
			>
				<span class="min-w-0">{item.title}</span>
				<span class="hidden shrink-0 font-mono text-[11px] font-normal text-ink-muted sm:inline">
					{item.sections === 1 ? '1 section' : `${item.sections} sections`}
				</span>
			</AdminButton>
		{/each}
	</nav>

	<div data-page-editor class="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
		{#each sections as [key, def], index (key)}
			<SectionPanel
				number={pad(index + 1)}
				sectionKey={key}
				{def}
				bind:draft={drafts[key]}
				baseline={data.values[key]}
				saved={data.saved[key] ?? null}
				errors={sectionErrors(errors, key)}
				{now}
			/>
		{/each}

		<div class="flex flex-wrap items-center justify-end gap-3">
			{#if dirty}
				<span class="text-[13px] text-ink-muted">Changes show on the site within a minute of publishing.</span>
			{/if}
			<AdminButton
				type="button"
				pending={save.pending}
				pendingLabel="Publishing"
				onclick={() => formEl?.requestSubmit()}
			>
				Publish changes
			</AdminButton>
		</div>
	</div>
</div>

<AlertDialog.Root bind:open={leaveOpen}>
	<AlertDialog.Content class="border border-line bg-surface-200 ring-0">
		<AlertDialog.Header>
			<AlertDialog.Title class="font-display text-lg font-semibold">Leave without publishing?</AlertDialog.Title>
			<AlertDialog.Description class="text-sm leading-[22px] text-ink-muted">
				Your changes to the {title.toLowerCase()} are not live yet. If you leave now, they are lost.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				class="h-11 rounded-sm border-line-strong bg-transparent px-4 hover:border-ink dark:border-line-strong dark:bg-transparent dark:hover:bg-transparent"
			>
				Keep editing
			</AlertDialog.Cancel>
			<AdminButton variant="danger" onclick={leave}>Leave page</AdminButton>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
