<!--
	The post edit form for /admin/posts/new and /admin/posts/[id]: title, URL, excerpt, the
	Markdown editor, and the Publishing and Details panels. Posts to `?/save` (and `?/delete`).

	- "Save draft" and "Publish" / "Schedule" / "Update post" choose the status; Ctrl/Cmd+S and
	  Enter in a text box save with the Status in the sidebar.
	- The URL follows the title until it is edited. Publishing without a date publishes now; a
	  future date schedules the post (Bangkok time).
	- A copy of every field is kept in this browser while there are unsaved changes, and offered
	  back ("Restore unsaved changes") when the page opens again. Leaving with unsaved changes asks
	  first.
	- If someone else saved the post meanwhile, saving stops and offers to replace their version.
-->
<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-exclamation-point';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { POST_CATEGORY_LABELS, POST_CATEGORY_OPTIONS, labelFor } from '#lib/content/labels.ts';
	import type { PostCategory, PostStatus } from '#lib/server/db/schema.ts';
	import AdminButton from '../AdminButton.svelte';
	import ConfirmDelete from '../ConfirmDelete.svelte';
	import FormField from '../FormField.svelte';
	import ImageField from '../ImageField.svelte';
	import PageHeader from '../PageHeader.svelte';
	import Panel from '../Panel.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import TagsInput from '../TagsInput.svelte';
	import ToggleRow from '../ToggleRow.svelte';
	import { AdminForm } from '../form.svelte.ts';
	import { timeAgo } from '../sections/time.ts';
	import { hintClass, inputClass, monoInputClass, selectTriggerClass, titleInputClass } from '../styles.ts';
	import { clearDraft, draftKey, readDraft, writeDraft, type LocalDraft } from './draft.ts';
	import MarkdownEditor, { type EditorMode } from './MarkdownEditor.svelte';
	import {
		LIMITS,
		STATE_LABELS,
		bangkokParts,
		formatWhen,
		parseBangkok,
		postState,
		slugify,
		timeUntil
	} from './post-fields.ts';

	/** The post as the server sends it (see posts.server.ts EditorPost). */
	export type EditorPostData = {
		id: string | null;
		slug: string;
		title: string;
		excerpt: string;
		body: string;
		category: PostCategory;
		authorName: string;
		status: PostStatus;
		publishedAt: Date | null;
		coverUrl: string;
		coverAlt: string;
		coverCaption: string;
		tags: string[];
		projectId: string;
		featured: boolean;
		updatedAt: Date | null;
		updatedBy: string | null;
	};

	type Props = {
		data: {
			post: EditorPostData;
			options: {
				projects: { id: string; title: string }[];
				authors: string[];
				featured: { id: string; title: string } | null;
			};
			now: Date;
		};
	};

	let { data }: Props = $props();

	const isNew = $derived(!data.post.id);

	/* ---------------------------------------------------------------------------------------- */
	/* Fields                                                                                    */
	/* ---------------------------------------------------------------------------------------- */

	type Fields = {
		title: string;
		slug: string;
		excerpt: string;
		body: string;
		category: PostCategory;
		authorName: string;
		status: PostStatus;
		publishDate: string;
		publishTime: string;
		coverUrl: string;
		coverAlt: string;
		coverCaption: string;
		tags: string[];
		projectId: string;
		featured: boolean;
	};

	function fieldsFrom(post: EditorPostData): Fields {
		const when = bangkokParts(post.publishedAt);
		return {
			title: post.title,
			slug: post.slug,
			excerpt: post.excerpt,
			body: post.body,
			category: post.category,
			authorName: post.authorName,
			status: post.status,
			publishDate: when.date,
			publishTime: when.time,
			coverUrl: post.coverUrl,
			coverAlt: post.coverAlt,
			coverCaption: post.coverCaption,
			tags: [...post.tags],
			projectId: post.projectId,
			featured: post.featured
		};
	}

	/** Stable text of the fields, to compare versions. */
	const snapshot = (f: Fields) => JSON.stringify($state.snapshot(f));

	/** The URL keeps following the title for new posts and for drafts whose URL still matches it. */
	const followsTitle = (post: EditorPostData) => !post.id || (post.status === 'draft' && post.slug === slugify(post.title));

	let f = $state<Fields>(untrack(() => fieldsFrom(data.post)));
	let slugTouched = $state(untrack(() => !followsTitle(data.post)));

	const saved = $derived(snapshot(fieldsFrom(data.post)));
	const current = $derived(snapshot(f));
	const dirty = $derived(current !== saved);

	let now = $state(untrack(() => new Date(data.now)));
	onMount(() => {
		now = new Date();
		const timer = setInterval(() => (now = new Date()), 30_000);
		return () => clearInterval(timer);
	});

	function ontitleinput() {
		if (!slugTouched) f.slug = slugify(f.title);
	}

	function onsluginput() {
		// Lower case and hyphens while typing (same length, so the cursor stays put).
		f.slug = f.slug.toLowerCase().replace(/[\s_]/g, '-');
		slugTouched = f.slug !== '';
		if (!slugTouched) f.slug = slugify(f.title);
	}

	function onslugblur() {
		const clean = f.slug
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, LIMITS.slug);
		if (clean !== f.slug) f.slug = clean;
		if (!clean) {
			slugTouched = false;
			f.slug = slugify(f.title);
		}
	}

	/* ---------------------------------------------------------------------------------------- */
	/* State of the post                                                                         */
	/* ---------------------------------------------------------------------------------------- */

	/** What readers see now (from the saved post). */
	const savedState = $derived(postState(data.post.status, data.post.publishedAt, now));
	const plannedAt = $derived.by(() => {
		const value = parseBangkok(f.publishDate, f.publishTime);
		return value instanceof Date ? value : null;
	});
	const dateInvalid = $derived(parseBangkok(f.publishDate, f.publishTime) === 'invalid');
	const plannedFuture = $derived(plannedAt !== null && plannedAt.getTime() > now.getTime());
	const wasPublished = $derived(data.post.status === 'published');

	const primaryLabel = $derived(wasPublished ? 'Update post' : plannedFuture ? 'Schedule' : 'Publish');
	const draftLabel = $derived(wasPublished ? 'Move to drafts' : 'Save draft');

	const dateHint = $derived.by(() => {
		if (dateInvalid) return 'Use a real date and time.';
		if (!plannedAt) return f.status === 'published' ? 'Empty publishes it the moment you save.' : 'Empty means the moment you publish.';
		if (plannedFuture) {
			return f.status === 'published'
				? `Goes live ${formatWhen(plannedAt)} (${timeUntil(plannedAt, now)}).`
				: `Planned for ${formatWhen(plannedAt)}. Schedule it to go live then.`;
		}
		return f.status === 'published' ? `Live since ${formatWhen(plannedAt)}.` : 'A past date shows the post as written then.';
	});

	const projectLabel = $derived(data.options.projects.find((p) => p.id === f.projectId)?.title ?? 'None');
	const otherFeatured = $derived(
		data.options.featured && data.options.featured.id !== data.post.id ? data.options.featured : null
	);
	const featuredHint = $derived(
		f.featured && otherFeatured
			? `Replaces “${otherFeatured.title}” as the big card on the Blog page.`
			: 'The big card at the top of the Blog page. One post at a time.'
	);

	const excerptCount = $derived(f.excerpt.length);
	const publicUrl = $derived(`/blog/${data.post.slug}`);

	/* ---------------------------------------------------------------------------------------- */
	/* Local copy                                                                                */
	/* ---------------------------------------------------------------------------------------- */

	const key = $derived(draftKey(data.post.id));
	let offer = $state<LocalDraft<Fields> | null>(null);
	let localSavedAt = $state<number | null>(null);

	onMount(() => {
		const draft = readDraft<Fields>(key);
		if (!draft) return;
		const serverTime = data.post.updatedAt ? new Date(data.post.updatedAt).getTime() : 0;
		const values = { ...fieldsFrom(data.post), ...draft.values };
		if (draft.savedAt > serverTime && snapshot(values) !== saved) offer = { ...draft, values };
		else clearDraft(key);
	});

	function keepLocal() {
		if (offer) return; // Don't overwrite a copy the editor hasn't decided about.
		if (!dirty) {
			if (localSavedAt) {
				clearDraft(key);
				localSavedAt = null;
			}
			return;
		}
		const savedAt = Date.now();
		const base = data.post.updatedAt ? new Date(data.post.updatedAt).toISOString() : null;
		if (writeDraft(key, { savedAt, base, values: $state.snapshot(f) as Fields })) localSavedAt = savedAt;
	}

	onMount(() => {
		const timer = setInterval(keepLocal, 3000);
		const onhide = () => keepLocal();
		window.addEventListener('pagehide', onhide);
		return () => {
			clearInterval(timer);
			window.removeEventListener('pagehide', onhide);
		};
	});

	function restore() {
		if (!offer) return;
		f = structuredClone($state.snapshot(offer.values)) as Fields;
		slugTouched = f.slug !== slugify(f.title) || !followsTitle(data.post);
		offer = null;
		toast.success('Restored your unsaved changes.', { description: 'Save to keep them.' });
	}

	function discard() {
		offer = null;
		clearDraft(key);
		localSavedAt = null;
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Saving                                                                                    */
	/* ---------------------------------------------------------------------------------------- */

	let formEl: HTMLFormElement | undefined = $state();
	let editor: MarkdownEditor | undefined = $state();
	let editorMode = $state<EditorMode>('write');
	let uploadingBody = $state(false);
	let uploadingCover = $state(false);
	const uploading = $derived(uploadingBody || uploadingCover);

	let submittedWith = $state<string | null>(null);
	let submittedSnapshot = '';
	let overwrite = $state(false);
	let conflict = $state<{ by: string; at: string } | null>(null);
	let bypass = false;

	const save = new AdminForm({
		onSubmit: ({ submitter, cancel }) => {
			if (uploading) {
				toast.error('Wait for the upload to finish, then save.');
				cancel();
				return false;
			}
			submittedWith = (submitter as HTMLButtonElement | null)?.value || 'save';
			submittedSnapshot = current;
		},
		onSuccess: async (result) => {
			conflict = null;
			overwrite = false;
			clearDraft(key);
			localSavedAt = null;
			const id = typeof result?.id === 'string' ? result.id : null;
			if (isNew && id) {
				bypass = true;
				await goto(`/admin/posts/${id}`, { replace: true });
				return;
			}
			await tick();
			// Take the saved (cleaned) values, unless the editor kept typing while it saved.
			if (current === submittedSnapshot) {
				f = fieldsFrom(data.post);
				slugTouched = !followsTitle(data.post);
			}
		},
		onFailure: async (result, status) => {
			overwrite = false;
			if (status === 409 && result?.conflict && typeof result.conflict === 'object') {
				conflict = result.conflict as { by: string; at: string };
				return;
			}
			await tick();
			if (save.errors.body) {
				editor?.focus();
				return;
			}
			formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		}
	});

	const pendingWith = (value: string) => save.pending && submittedWith === value;

	function onkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's') {
			event.preventDefault();
			if (!save.pending) formEl?.requestSubmit();
		}
	}

	async function overwriteAndSave() {
		overwrite = true;
		await tick();
		const button = submittedWith && submittedWith !== 'save' ? formEl?.querySelector<HTMLButtonElement>(`button[value="${submittedWith}"]`) : null;
		formEl?.requestSubmit(button ?? undefined);
	}

	function setNow() {
		const parts = bangkokParts(new Date());
		f.publishDate = parts.date;
		f.publishTime = parts.time;
	}

	function clearDate() {
		f.publishDate = '';
		f.publishTime = '';
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Leaving                                                                                   */
	/* ---------------------------------------------------------------------------------------- */

	let leaveOpen = $state(false);
	let leaving: { url: URL; delta?: number } | null = null;

	beforeNavigate((navigation) => {
		if (bypass || !dirty) return;
		// The post was deleted: nothing left to save.
		if (navigation.to?.url.pathname === '/admin/posts' && navigation.to.url.searchParams.has('deleted')) return;
		keepLocal();
		if (navigation.willUnload) {
			// Reload, closing the tab or another site: the browser asks.
			navigation.cancel();
			return;
		}
		if (!navigation.to) return;
		navigation.cancel();
		leaving = { url: navigation.to.url, delta: navigation.type === 'popstate' ? navigation.delta : undefined };
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

	const savedLabel = $derived.by(() => {
		if (dirty) {
			return localSavedAt ? `Unsaved · copy kept on this device ${timeAgo(localSavedAt, now, { lower: true })}` : 'Unsaved changes';
		}
		if (!data.post.updatedAt) return 'Not saved yet';
		return `Saved ${timeAgo(data.post.updatedAt, now, { lower: true })}`;
	});

	const authorListId = $props.id();
</script>

<svelte:window {onkeydown} />

<form
	bind:this={formEl}
	method="POST"
	action="?/save"
	use:enhance={save.submit}
	class="contents"
	novalidate
>
	<!-- Enter in a text box saves with the sidebar's status (never "Move to drafts"). -->
	<button type="submit" name="intent" value="save" class="sr-only" tabindex="-1" aria-hidden="true">Save</button>
	<input type="hidden" name="baseUpdatedAt" value={data.post.updatedAt ? new Date(data.post.updatedAt).toISOString() : ''} />
	{#if !slugTouched}<input type="hidden" name="slugAuto" value="on" />{/if}
	{#if overwrite}<input type="hidden" name="overwrite" value="on" />{/if}

	<PageHeader
		back={{ label: 'Posts', href: '/admin/posts' }}
		title={isNew ? 'New post' : 'Edit post'}
		documentTitle={isNew ? 'New post' : `Edit: ${data.post.title}`}
		size="md"
	>
		{#snippet badge()}
			{#if !isNew}
				<StatusBadge
					status={savedState}
					label={STATE_LABELS[savedState]}
					tone={savedState === 'published' ? 'success' : 'neutral'}
					dot={savedState === 'scheduled'}
				/>
			{/if}
			{#if dirty}<span class="text-xs text-ink-muted">Unsaved changes</span>{/if}
		{/snippet}
		{#snippet actions()}
			{#if !isNew}
				{#if savedState === 'published'}
					<AdminButton variant="outline" href={publicUrl} external>View post</AdminButton>
				{:else}
					<Popover.Root>
						<Popover.Trigger>
							{#snippet child({ props })}
								<AdminButton {...props} variant="outline">View post</AdminButton>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="w-80 border border-line bg-surface-200" align="end">
							<div class="flex gap-3">
								{#if savedState === 'scheduled'}
									<CalendarClockIcon class="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
								{:else}
									<EyeOffIcon class="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
								{/if}
								<div class="flex flex-col gap-2 text-sm leading-[22px]">
									{#if savedState === 'scheduled'}
										<p class="m-0 font-medium text-ink">Not public until {formatWhen(data.post.publishedAt)}</p>
										<p class="m-0 text-ink-muted">Scheduled posts open at <span class="font-mono text-[13px]">{publicUrl}</span> on their publish date.</p>
									{:else}
										<p class="m-0 font-medium text-ink">Drafts aren't public</p>
										<p class="m-0 text-ink-muted">Publish the post to open it at <span class="font-mono text-[13px] break-all">{publicUrl}</span>.</p>
									{/if}
									<p class="m-0 text-ink-muted">The Preview tab shows exactly how it will look.</p>
									<AdminButton variant="outline" size="sm" class="self-start" onclick={() => (editorMode = 'preview')}>Show the preview</AdminButton>
								</div>
							</div>
						</Popover.Content>
					</Popover.Root>
				{/if}
			{/if}
			<AdminButton
				type="submit"
				name="intent"
				value="draft"
				variant="outline"
				pending={pendingWith('draft')}
				disabled={save.pending}
			>
				{draftLabel}
			</AdminButton>
			<AdminButton type="submit" name="intent" value="publish" pending={pendingWith('publish')} disabled={save.pending}>
				{primaryLabel}
			</AdminButton>
		{/snippet}
	</PageHeader>

	{#if offer}
		<Alert.Root class="border-line-strong bg-surface-200">
			<RotateCcwIcon aria-hidden="true" />
			<Alert.Title class="font-medium">You have unsaved changes from {formatWhen(new Date(offer.savedAt))}</Alert.Title>
			<Alert.Description class="text-ink-muted">
				<p class="m-0">They were kept on this device{isNew ? '' : ' and are newer than the saved post'}.</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<AdminButton size="sm" onclick={restore}>Restore unsaved changes</AdminButton>
					<AdminButton size="sm" variant="outline" onclick={discard}>Discard</AdminButton>
				</div>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if conflict}
		<Alert.Root class="border-brand-text/60 bg-brand/10">
			<TriangleAlertIcon aria-hidden="true" class="text-brand-text" />
			<Alert.Title class="font-medium">{conflict.by} saved this post {timeAgo(conflict.at, now, { lower: true })}</Alert.Title>
			<Alert.Description class="text-ink-muted">
				<p class="m-0">Your version is still here. Saving it replaces theirs; reloading shows theirs (your text stays on this device).</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<AdminButton size="sm" variant="danger" pending={save.pending} onclick={overwriteAndSave}>Save mine anyway</AdminButton>
					<AdminButton size="sm" variant="outline" onclick={() => { keepLocal(); bypass = true; location.reload(); }}>Reload</AdminButton>
				</div>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="flex flex-wrap items-start gap-6">
		<div class="flex min-w-0 flex-[999_1_520px] flex-col gap-[18px]">
			<FormField label="Title" error={save.errors.title}>
				{#snippet children(attrs)}
					<Input
						{...attrs}
						name="title"
						bind:value={f.title}
						oninput={ontitleinput}
						maxlength={LIMITS.title}
						autocomplete="off"
						placeholder="What happened, in plain words"
						class={titleInputClass}
					/>
				{/snippet}
			</FormField>

			<div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
				<FormField
					label="URL"
					error={save.errors.slug}
					hint={slugTouched
						? wasPublished
							? 'Changing the URL of a published post breaks links to it.'
							: 'Clear it to follow the title again.'
						: 'Follows the title until you edit it.'}
				>
					{#snippet children(attrs)}
						<InputGroup.Root class="h-11 rounded-sm border-line-strong bg-surface-100 shadow-none dark:bg-surface-100">
							<InputGroup.Addon class="pr-0 font-mono text-[13px] text-ink-muted">/blog/</InputGroup.Addon>
							<InputGroup.Input
								{...attrs}
								name="slug"
								bind:value={f.slug}
								oninput={onsluginput}
								onblur={onslugblur}
								maxlength={LIMITS.slug}
								autocomplete="off"
								autocapitalize="off"
								spellcheck={false}
								placeholder={f.title ? 'post' : 'made-from-the-title'}
								class="pl-0.5 font-mono text-[13px] md:text-[13px]"
							/>
						</InputGroup.Root>
					{/snippet}
				</FormField>
				<FormField
					label="Excerpt"
					error={save.errors.excerpt}
					hint="{excerptCount} of {LIMITS.excerpt} characters. Shown on cards and in search results{excerptCount > LIMITS.excerptIdeal ? '; search engines cut it near 160' : ''}."
				>
					{#snippet children(attrs)}
						<Input
							{...attrs}
							name="excerpt"
							bind:value={f.excerpt}
							maxlength={LIMITS.excerpt}
							placeholder="One sentence that makes people want to read it"
							class={inputClass}
						/>
					{/snippet}
				</FormField>
			</div>

			<MarkdownEditor
				bind:this={editor}
				bind:value={f.body}
				bind:mode={editorMode}
				bind:uploading={uploadingBody}
				name="body"
				figureStart={2}
				error={save.errors.body}
				{savedLabel}
			/>
		</div>

		<aside class="flex min-w-0 flex-[1_1_300px] flex-col gap-4" aria-label="Post settings">
			<Panel title="Publishing" size="sm" padding="sm">
				<FormField label="Status" error={save.errors.status}>
					{#snippet children(attrs)}
						<Select.Root type="single" name="status" bind:value={f.status}>
							<Select.Trigger id={attrs.id} aria-describedby={attrs['aria-describedby']} aria-invalid={attrs['aria-invalid']} class={selectTriggerClass}>
								{f.status === 'published' ? (plannedFuture ? 'Published (scheduled)' : 'Published') : 'Draft'}
							</Select.Trigger>
							<Select.Content class="border border-line bg-surface-200">
								<Select.Item value="draft" label="Draft" class="min-h-10" />
								<Select.Item value="published" label="Published" class="min-h-10" />
							</Select.Content>
						</Select.Root>
					{/snippet}
				</FormField>

				<fieldset class="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
					<legend class="mb-1.5 p-0 text-[13px] leading-5 font-medium text-ink">Publish date</legend>
					<div class="grid grid-cols-2 gap-2">
						<Input
							type="date"
							name="publishDate"
							bind:value={f.publishDate}
							aria-label="Publish date (Bangkok)"
							aria-invalid={save.errors.publishDate || dateInvalid ? 'true' : undefined}
							aria-describedby="{authorListId}-date-hint"
							class="{monoInputClass} px-2.5"
						/>
						<Input
							type="time"
							name="publishTime"
							bind:value={f.publishTime}
							aria-label="Publish time (Bangkok)"
							aria-describedby="{authorListId}-date-hint"
							class="{monoInputClass} px-2.5"
						/>
					</div>
					{#if save.errors.publishDate}
						<p class="m-0 text-xs leading-[18px] text-brand-text">{save.errors.publishDate}</p>
					{/if}
					<p id="{authorListId}-date-hint" class={['m-0', hintClass, plannedFuture && f.status === 'published' && 'text-ink']}>
						{dateHint} Bangkok time.
					</p>
					<div class="-ml-3 flex gap-1">
						<AdminButton variant="ghost" size="sm" onclick={setNow}>Set to now</AdminButton>
						{#if f.publishDate}
							<AdminButton variant="ghost" size="sm" onclick={clearDate}>Clear</AdminButton>
						{/if}
					</div>
				</fieldset>

				<FormField label="Author" optional error={save.errors.authorName} hint="A team or a person. Pick a suggestion or type a name.">
					{#snippet children(attrs)}
						<Input
							{...attrs}
							name="authorName"
							bind:value={f.authorName}
							list="{authorListId}-authors"
							maxlength={LIMITS.author}
							autocomplete="off"
							placeholder="A team or a person"
							class={inputClass}
						/>
					{/snippet}
				</FormField>
				<datalist id="{authorListId}-authors">
					{#each data.options.authors as author (author)}<option value={author}></option>{/each}
				</datalist>

				<ToggleRow name="featured" label="Featured" hint={featuredHint} bind:checked={f.featured} divided />
			</Panel>

			<Panel title="Details" size="sm" padding="sm">
				<FormField label="Category" error={save.errors.category}>
					{#snippet children(attrs)}
						<Select.Root type="single" name="category" bind:value={f.category}>
							<Select.Trigger id={attrs.id} aria-describedby={attrs['aria-describedby']} aria-invalid={attrs['aria-invalid']} class={selectTriggerClass}>
								{labelFor(POST_CATEGORY_LABELS, f.category)}
							</Select.Trigger>
							<Select.Content class="border border-line bg-surface-200">
								{#each POST_CATEGORY_OPTIONS as option (option.value)}
									<Select.Item value={option.value} label={option.label} class="min-h-10" />
								{/each}
							</Select.Content>
						</Select.Root>
					{/snippet}
				</FormField>

				<FormField label="Tags" optional error={save.errors.tags} hint="Enter or comma after each tag.">
					{#snippet children(attrs)}
						<TagsInput {...attrs} name="tags" bind:tags={f.tags} max={20} placeholder="Add a tag" />
					{/snippet}
				</FormField>

				<ImageField
					label="Cover image"
					name="cover"
					folder="posts"
					aspect="16 / 10"
					hint="16:10 · empty shows the image slot"
					error={save.errors.cover}
					qualityOption
					bind:url={f.coverUrl}
					bind:alt={f.coverAlt}
					bind:uploading={uploadingCover}
				/>
				<!-- The cover slot is always on the post (a placeholder until there is a photo), so its caption is too. -->
				<FormField label="Cover caption" optional error={save.errors.coverCaption} hint="Shown under the cover as Fig. 01.">
					{#snippet children(attrs)}
						<Input {...attrs} name="coverCaption" bind:value={f.coverCaption} maxlength={LIMITS.caption} class={inputClass} />
					{/snippet}
				</FormField>

				<FormField label="Linked project" optional error={save.errors.projectId} hint="The post shows on the project's page.">
					{#snippet children(attrs)}
						<Select.Root type="single" name="projectId" value={f.projectId || 'none'} onValueChange={(v) => (f.projectId = v === 'none' ? '' : v)}>
							<Select.Trigger id={attrs.id} aria-describedby={attrs['aria-describedby']} aria-invalid={attrs['aria-invalid']} class={selectTriggerClass}>
								{projectLabel}
							</Select.Trigger>
							<Select.Content class="max-h-72 border border-line bg-surface-200">
								<Select.Item value="none" label="None" class="min-h-10" />
								{#each data.options.projects as project (project.id)}
									<Select.Item value={project.id} label={project.title} class="min-h-10" />
								{/each}
							</Select.Content>
						</Select.Root>
					{/snippet}
				</FormField>
			</Panel>

			{#if data.post.id}
				<ConfirmDelete
					action="?/delete"
					id={data.post.id}
					title="Delete this post?"
					description={`“${data.post.title}” disappears from the blog straight away. This can't be undone.`}
					triggerLabel="Delete post"
				/>
			{/if}
		</aside>
	</div>
</form>

<AlertDialog.Root bind:open={leaveOpen}>
	<AlertDialog.Content class="border border-line bg-surface-200 ring-0">
		<AlertDialog.Header>
			<AlertDialog.Title class="font-display text-lg font-semibold">Leave without saving?</AlertDialog.Title>
			<AlertDialog.Description class="text-sm leading-[22px] text-ink-muted">
				Your changes are not saved. A copy stays on this device, so you can restore it when you open the post again.
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
