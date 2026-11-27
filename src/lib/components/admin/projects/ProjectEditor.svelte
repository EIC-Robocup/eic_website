<!--
	The project editor (AdminProjectEdit design), for /admin/projects/new (`mode="create"`,
	posts to ?/create) and /admin/projects/[id] (`mode="edit"`, posts to ?/save and ?/delete).

	Holds the whole project as a draft in $state; the same validator as the action
	(project-form.ts) shows field errors once you try to save, and blocks sending while
	something is wrong or still uploading. Ctrl/Cmd+S saves. Leaving with unsaved changes asks
	first. Render it inside {#key id} so each project gets a fresh draft.
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Kbd from '#lib/components/ui/kbd/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import {
		PROJECT_CATEGORY_LABELS,
		PROJECT_CATEGORY_OPTIONS,
		PROJECT_STATUS_LABELS,
		PROJECT_STATUS_OPTIONS,
		labelFor
	} from '#lib/content/labels.ts';
	import AdminButton from '../AdminButton.svelte';
	import ConfirmDelete from '../ConfirmDelete.svelte';
	import FormField from '../FormField.svelte';
	import ImageField from '../ImageField.svelte';
	import ListEditor from '../ListEditor.svelte';
	import PageHeader from '../PageHeader.svelte';
	import Panel from '../Panel.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import TagsInput from '../TagsInput.svelte';
	import ToggleRow from '../ToggleRow.svelte';
	import { AdminForm } from '../form.svelte.ts';
	import { formatDateTime, isoString, timeAgo } from '../sections/time.ts';
	import { stableStringify } from '../sections/values.ts';
	import { hintClass, inputClass, monoInputClass, rowLabelClass, selectTriggerClass, textareaClass } from '../styles.ts';
	import GalleryEditor from './GalleryEditor.svelte';
	import PaperField from './PaperField.svelte';
	import { LIMITS, slugify, validateProject, type ProjectDraft } from './project-form.ts';
	import type { ProjectPart, ProjectSystem } from '#lib/server/db/schema.ts';

	type Props = {
		mode: 'create' | 'edit';
		/** The project as saved (or the blank one). The editor keeps its own copy. */
		project: ProjectDraft;
		/** Edit mode: the row id. */
		id?: string | null;
		/** Edit mode: what the site shows now. */
		saved?: { slug: string; title: string; published: boolean; featured: boolean } | null;
		updatedAt?: Date | string | null;
		/** Slugs other projects use. */
		takenSlugs: string[];
		/** The project featured on the home page now, when it is another one. */
		featuredOther: { id: string; title: string } | null;
		/** Posts linked to this project (they stay when it is deleted). */
		linkedPosts?: number;
		now?: Date | string;
	};

	let {
		mode,
		project,
		id = null,
		saved = null,
		updatedAt = null,
		takenSlugs,
		featuredOther,
		linkedPosts = 0,
		now: serverNow
	}: Props = $props();

	const SLUG_TAKEN = 'Another project already uses this address. Pick another one.';
	const clone = (value: ProjectDraft): ProjectDraft => structuredClone($state.snapshot(value)) as ProjectDraft;

	let draft: ProjectDraft = $state(untrack(() => clone(project)));
	/** The slug follows the title until someone edits it (always edited for saved projects). */
	let slugEdited = $state(untrack(() => mode === 'edit' || Boolean(project.slug)));
	/** Show field errors once someone has tried to save. */
	let attempted = $state(false);
	let serverErrors = $state<Record<string, string>>({});
	let serverSnapshot = $state('');
	let submittedSnapshot = '';
	let formEl: HTMLFormElement | undefined = $state();
	let coverUploading = $state(false);
	let galleryUploading = $state(false);
	let paperUploading = $state(false);
	let systemsList: { add: () => Promise<void> } | undefined = $state();
	let partsList: { add: () => Promise<void> } | undefined = $state();

	let now = $state(untrack(() => (serverNow ? new Date(serverNow) : new Date())));
	$effect(() => {
		const timer = setInterval(() => (now = new Date()), 30_000);
		return () => clearInterval(timer);
	});

	const draftJson = $derived(stableStringify(draft));
	const dirty = $derived(draftJson !== stableStringify(project));
	const uploading = $derived(coverUploading || galleryUploading || paperUploading);
	const taken = $derived(new Set(takenSlugs));

	const liveErrors = $derived.by(() => {
		const { errors } = validateProject(draft);
		const slug = draft.slug.trim().toLowerCase();
		if (!errors.slug && slug && taken.has(slug)) errors.slug = SLUG_TAKEN;
		return errors;
	});
	const errors = $derived.by((): Record<string, string> => {
		const fromServer = draftJson === serverSnapshot ? serverErrors : {};
		if (attempted) return { ...fromServer, ...liveErrors };
		// Before the first save, only say when the address is taken (that is news, not nagging).
		return liveErrors.slug === SLUG_TAKEN ? { slug: SLUG_TAKEN } : {};
	});
	const errorCount = $derived(Object.keys(liveErrors).length);

	/* Slug: follows the title until edited; tidied when you leave the field. */
	function onTitleInput(event: Event) {
		if (!slugEdited) draft.slug = slugify((event.currentTarget as HTMLInputElement).value);
	}
	function onSlugInput(event: Event) {
		slugEdited = (event.currentTarget as HTMLInputElement).value.trim() !== '';
	}
	function onSlugBlur() {
		const tidy = slugify(draft.slug);
		if (tidy && tidy !== draft.slug) draft.slug = tidy;
	}

	const slugHint = $derived.by(() => {
		const path = `/projects/${draft.slug.trim() || 'your-project'}`;
		if (mode === 'edit' && saved && draft.slug.trim() !== saved.slug) {
			return `Changing it breaks links to /projects/${saved.slug}.`;
		}
		return slugEdited ? `The page lives at ${path}.` : `Made from the title until you edit it: ${path}.`;
	});

	async function focusFirstError() {
		await tick();
		const target = document.querySelector<HTMLElement>(
			'form[data-project-editor] [aria-invalid="true"], form[data-project-editor] [data-invalid]'
		);
		if (!target) return;
		const coverAlt = target.matches('[data-cover]') ? document.getElementById('cover-alt') : null;
		const el = coverAlt ?? target;
		el.scrollIntoView({ block: 'center', behavior: 'smooth' });
		el.focus({ preventScroll: true });
	}

	const save = new AdminForm({
		// A string, so it shows before the redirect to the new project's page.
		success: untrack(() => mode) === 'create' ? 'Project created.' : undefined,
		onSubmit: () => {
			attempted = true;
			if (uploading) {
				toast.error('Wait for the uploads to finish, then save.');
				return false;
			}
			if (errorCount) {
				toast.error(errorCount === 1 ? 'One field needs a fix before saving.' : `${errorCount} fields need a fix before saving.`);
				void focusFirstError();
				return false;
			}
			submittedSnapshot = draftJson;
		},
		onSuccess: () => {
			attempted = false;
			serverErrors = {};
			now = new Date();
			// Take the saved (cleaned) values, unless the editor kept typing while it saved.
			if (stableStringify(draft) === submittedSnapshot) draft = clone(project);
		},
		onFailure: () => {
			serverErrors = { ...save.errors };
			serverSnapshot = draftJson;
			void focusFirstError();
		}
	});

	/* "Ctrl S", or "⌘ S" on Apple devices (set after hydration so server and browser agree). */
	let modKey = $state('Ctrl');
	$effect(() => {
		if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) modKey = '⌘';
	});

	function onkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's') {
			event.preventDefault();
			if (!save.pending) formEl?.requestSubmit();
		}
	}

	/* Ask before leaving with unsaved changes. Redirects after create and delete are `goto`s. */
	let leaveOpen = $state(false);
	let leaving: { url: URL; delta?: number } | null = null;
	let bypass = false;

	beforeNavigate((navigation) => {
		if (bypass || !dirty || save.pending || navigation.type === 'goto') return;
		if (navigation.willUnload) {
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

	const headerTitle = $derived(draft.title.trim() || saved?.title || 'New project');
	const deleteDescription = $derived(
		[
			'It disappears from the website straight away.',
			linkedPosts === 1
				? 'The post linked to it stays on the blog, without a project.'
				: linkedPosts > 1
					? `The ${linkedPosts} posts linked to it stay on the blog, without a project.`
					: '',
			"This can't be undone."
		]
			.filter(Boolean)
			.join(' ')
	);

	const rowError = (list: string, index: number, field: string) => errors[`${list}.${index}.${field}`];
	const newSystem = (): ProjectSystem => ({ title: '', description: '' });
	const newPart = (): ProjectPart => ({ qty: '1', part: '', note: '' });
	const errorText = 'm-0 text-xs leading-[18px] text-brand-text';
</script>

<svelte:window {onkeydown} />

<form
	bind:this={formEl}
	method="POST"
	action={mode === 'create' ? '?/create' : '?/save'}
	use:enhance={save.submit}
	class="contents"
	novalidate
	data-project-editor
>
	<PageHeader
		back={{ label: 'Projects', href: '/admin/projects' }}
		title={headerTitle}
		size="md"
		documentTitle={mode === 'create' ? 'New project' : `Edit ${saved?.title ?? 'project'}`}
	>
		{#snippet badge()}
			{#if mode === 'edit' && saved}
				<StatusBadge status={saved.published ? 'published' : 'hidden'} />
				{#if saved.featured}<StatusBadge label="Featured" />{/if}
			{:else}
				<StatusBadge label="Not saved yet" />
			{/if}
		{/snippet}
		{#snippet actions()}
			{#if dirty}
				<span class="inline-flex items-center gap-1.5 text-xs text-ink-muted" role="status">
					<span class="size-1.5 rounded-full bg-brand-text" aria-hidden="true"></span>Unsaved changes
				</span>
			{/if}
			{#if mode === 'edit' && saved?.published}
				<AdminButton variant="outline" href="/projects/{saved.slug}" external>View on site</AdminButton>
			{/if}
			<AdminButton type="submit" pending={save.pending} pendingLabel="Saving">
				{mode === 'create' ? 'Create project' : 'Save project'}
			</AdminButton>
		{/snippet}
	</PageHeader>

	<div class="flex flex-wrap items-start gap-6">
		<div class="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
			<Panel title="Basics">
				<FormField label="Title" error={errors.title}>
					{#snippet children(attrs)}
						<Input
							{...attrs}
							name="title"
							bind:value={draft.title}
							oninput={onTitleInput}
							class={inputClass}
							maxlength={LIMITS.title + 40}
							placeholder="e.g. Walkie 5"
							autocomplete="off"
						/>
					{/snippet}
				</FormField>
				<FormField label="Page address" error={errors.slug} hint={slugHint}>
					{#snippet children(attrs)}
						<InputGroup.Root class="h-11 rounded-sm border-line-strong bg-surface-100 shadow-none dark:bg-surface-100">
							<InputGroup.Addon class="pr-0 pl-3 font-mono text-[13px] text-ink-muted">/projects/</InputGroup.Addon>
							<InputGroup.Input
								{...attrs}
								name="slug"
								bind:value={draft.slug}
								oninput={onSlugInput}
								onblur={onSlugBlur}
								class="h-full pl-0.5 font-mono text-[13px] md:text-[13px]"
								maxlength={LIMITS.slug + 20}
								autocomplete="off"
								autocapitalize="off"
								spellcheck="false"
							/>
						</InputGroup.Root>
					{/snippet}
				</FormField>
				<div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3.5">
					<FormField label="Category" error={errors.category}>
						{#snippet children(attrs)}
							<Select.Root type="single" name="category" bind:value={draft.category}>
								<Select.Trigger {...attrs} class={selectTriggerClass}>
									{labelFor(PROJECT_CATEGORY_LABELS, draft.category) || 'Pick one'}
								</Select.Trigger>
								<Select.Content class="border border-line bg-surface-200">
									{#each PROJECT_CATEGORY_OPTIONS as option (option.value)}
										<Select.Item value={option.value} label={option.label} class="min-h-10" />
									{/each}
								</Select.Content>
							</Select.Root>
						{/snippet}
					</FormField>
					<FormField label="Status" error={errors.status}>
						{#snippet children(attrs)}
							<Select.Root type="single" name="status" bind:value={draft.status}>
								<Select.Trigger {...attrs} class={selectTriggerClass}>
									{labelFor(PROJECT_STATUS_LABELS, draft.status) || 'Pick one'}
								</Select.Trigger>
								<Select.Content class="border border-line bg-surface-200">
									{#each PROJECT_STATUS_OPTIONS as option (option.value)}
										<Select.Item value={option.value} label={option.label} class="min-h-10" />
									{/each}
								</Select.Content>
							</Select.Root>
						{/snippet}
					</FormField>
					<FormField label="Year" error={errors.year}>
						{#snippet children(attrs)}
							<Input {...attrs} name="year" bind:value={draft.year} inputmode="numeric" maxlength={4} placeholder="2026" class={monoInputClass} />
						{/snippet}
					</FormField>
					<FormField label="Until" optional error={errors.yearEnd} hint="For projects that ran several years.">
						{#snippet children(attrs)}
							<Input {...attrs} name="yearEnd" bind:value={draft.yearEnd} inputmode="numeric" maxlength={4} placeholder="2028" class={monoInputClass} />
						{/snippet}
					</FormField>
				</div>
				<FormField label="Tagline" optional error={errors.tagline} hint="The short line under the title, e.g. Listens. Navigates. Grasps.">
					{#snippet children(attrs)}
						<Input {...attrs} name="tagline" bind:value={draft.tagline} class={inputClass} maxlength={LIMITS.tagline + 40} />
					{/snippet}
				</FormField>
				<FormField label="Summary" optional error={errors.summary} hint="One or two sentences for cards and search results.">
					{#snippet children(attrs)}
						<Textarea {...attrs} name="summary" bind:value={draft.summary} rows={3} class={textareaClass} maxlength={LIMITS.summary + 100} />
					{/snippet}
				</FormField>
			</Panel>

			<Panel title="Result" description="The facts table and the big numeral on the project page.">
				<div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3.5">
					<FormField label="Event" optional error={errors.event}>
						{#snippet children(attrs)}
							<Input {...attrs} name="event" bind:value={draft.event} class={inputClass} placeholder="RoboCup@Home 2026" />
						{/snippet}
					</FormField>
					<FormField label="Place" optional error={errors.place}>
						{#snippet children(attrs)}
							<Input {...attrs} name="place" bind:value={draft.place} class={inputClass} placeholder="Incheon, Korea" />
						{/snippet}
					</FormField>
					<FormField label="Result" optional error={errors.result}>
						{#snippet children(attrs)}
							<Input {...attrs} name="result" bind:value={draft.result} class={inputClass} placeholder="6th of 24 teams" />
						{/snippet}
					</FormField>
					<FormField label="Team size" optional error={errors.teamSize}>
						{#snippet children(attrs)}
							<Input {...attrs} name="teamSize" bind:value={draft.teamSize} inputmode="numeric" maxlength={3} placeholder="41" class={monoInputClass} />
						{/snippet}
					</FormField>
				</div>
				<Separator class="bg-line" />
				<div class="flex flex-col gap-0.5">
					<h3 class="m-0 text-sm leading-5 font-medium text-ink">Highlight</h3>
					<p class={['m-0', hintClass]}>The big numeral beside the hero photo. Leave it empty to show none.</p>
				</div>
				<div class="grid gap-3.5 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
					<FormField label="Value" error={errors.highlightValue}>
						{#snippet children(attrs)}
							<Input {...attrs} name="highlightValue" bind:value={draft.highlightValue} class={inputClass} placeholder="6th" />
						{/snippet}
					</FormField>
					<FormField label="Label" error={errors.highlightLabel}>
						{#snippet children(attrs)}
							<Input {...attrs} name="highlightLabel" bind:value={draft.highlightLabel} class={inputClass} placeholder="RoboCup@Home 2026 · Incheon" />
						{/snippet}
					</FormField>
					<FormField label="Handwritten note" error={errors.highlightNote}>
						{#snippet children(attrs)}
							<Input {...attrs} name="highlightNote" bind:value={draft.highlightNote} class={inputClass} placeholder="of 24 teams!" />
						{/snippet}
					</FormField>
				</div>
			</Panel>

			<Panel title="Cover" description="On cards and at the top of the project page. Empty shows the crop marked placeholder.">
				<div class="grid gap-4 md:grid-cols-2">
					<div data-cover data-invalid={errors.cover ? '' : undefined} tabindex="-1" class="min-w-0 outline-none">
						<ImageField
							id="cover"
							name="cover"
							folder="projects"
							label="Cover photo"
							aspect="4 / 3"
							qualityOption
							bind:url={draft.coverUrl}
							bind:alt={draft.coverAlt}
							bind:uploading={coverUploading}
							error={errors.cover}
						/>
					</div>
					<FormField label="Caption" optional error={errors.coverCaption} hint="The mono line under the hero photo.">
						{#snippet children(attrs)}
							<Textarea {...attrs} name="coverCaption" bind:value={draft.coverCaption} rows={3} class={textareaClass} placeholder="Walkie 4 at RoboCup@Home 2026, Incheon." />
						{/snippet}
					</FormField>
				</div>
			</Panel>

			<Panel title="Gallery" description="Photos at the bottom of the project page. An empty slot with a caption shows as a placeholder.">
				<GalleryEditor bind:items={draft.gallery} name="gallery" folder="projects" {errors} bind:uploading={galleryUploading} />
				{#if errors.gallery}<p class={errorText} data-invalid>{errors.gallery}</p>{/if}
			</Panel>

			<Panel title="How it works" description="The numbered systems on the project page.">
				{#snippet actions()}
					<AdminButton variant="ghost" size="sm" disabled={draft.systems.length >= LIMITS.systems} onclick={() => systemsList?.add()}>
						+ Add system
					</AdminButton>
				{/snippet}
				<ListEditor
					bind:this={systemsList}
					bind:items={draft.systems}
					name="systems"
					itemLabel="system"
					numbered
					max={LIMITS.systems}
					addPosition="none"
					create={newSystem}
					rowClass="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-[minmax(150px,0.8fr)_minmax(0,1.4fr)]"
				>
					{#snippet header()}<span>System</span><span>One line description</span>{/snippet}
					{#snippet row(item, index)}
						{@const titleError = rowError('systems', index, 'title')}
						{@const descriptionError = rowError('systems', index, 'description')}
						<div class="flex min-w-0 flex-col gap-1">
							<span class="{rowLabelClass} sm:hidden" aria-hidden="true">System</span>
							<Input
								bind:value={item.title}
								aria-label="System {index + 1} name"
								aria-invalid={titleError ? 'true' : undefined}
								class={inputClass}
								placeholder="7 DOF arms"
								maxlength={LIMITS.systemTitle + 20}
							/>
							{#if titleError}<p class={errorText}>{titleError}</p>{/if}
						</div>
						<div class="flex min-w-0 flex-col gap-1">
							<span class="{rowLabelClass} sm:hidden" aria-hidden="true">One line description</span>
							<Input
								bind:value={item.description}
								aria-label="System {index + 1} one line description"
								aria-invalid={descriptionError ? 'true' : undefined}
								class={inputClass}
								placeholder="Carbon fiber, AK series actuators."
								maxlength={LIMITS.systemDescription + 40}
							/>
							{#if descriptionError}<p class={errorText}>{descriptionError}</p>{/if}
						</div>
					{/snippet}
					{#snippet empty()}
						<p class="m-0 rounded-sm border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-muted">
							No systems yet. Add the three or four ideas that make it work.
						</p>
					{/snippet}
				</ListEditor>
				{#if errors.systems}<p class={errorText} data-invalid>{errors.systems}</p>{/if}
			</Panel>

			<Panel title="Parts and software" description="The parts list and the software beside it.">
				{#snippet actions()}
					<AdminButton variant="ghost" size="sm" disabled={draft.parts.length >= LIMITS.parts} onclick={() => partsList?.add()}>
						+ Add part
					</AdminButton>
				{/snippet}
				<ListEditor
					bind:this={partsList}
					bind:items={draft.parts}
					name="parts"
					itemLabel="part"
					numbered
					max={LIMITS.parts}
					addPosition="none"
					create={newPart}
					rowClass="grid min-w-0 flex-1 grid-cols-[64px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[64px_minmax(0,1.3fr)_minmax(0,1fr)]"
				>
					{#snippet header()}<span>Qty</span><span>Part</span><span>Note</span>{/snippet}
					{#snippet row(item, index)}
						{@const qtyError = rowError('parts', index, 'qty')}
						{@const partError = rowError('parts', index, 'part')}
						{@const noteError = rowError('parts', index, 'note')}
						<div class="flex min-w-0 flex-col gap-1">
							<span class="{rowLabelClass} sm:hidden" aria-hidden="true">Qty</span>
							<Input
								bind:value={item.qty}
								aria-label="Part {index + 1} quantity"
								aria-invalid={qtyError ? 'true' : undefined}
								class="{monoInputClass} px-2.5"
								maxlength={LIMITS.partQty + 8}
							/>
							{#if qtyError}<p class={errorText}>{qtyError}</p>{/if}
						</div>
						<div class="flex min-w-0 flex-col gap-1">
							<span class="{rowLabelClass} sm:hidden" aria-hidden="true">Part</span>
							<Input
								bind:value={item.part}
								aria-label="Part {index + 1} name"
								aria-invalid={partError ? 'true' : undefined}
								class={inputClass}
								placeholder="Omni wheel Ø152"
								maxlength={LIMITS.partName + 20}
							/>
							{#if partError}<p class={errorText}>{partError}</p>{/if}
						</div>
						<div class="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
							<span class="{rowLabelClass} sm:hidden" aria-hidden="true">Note</span>
							<Input
								bind:value={item.note}
								aria-label="Part {index + 1} note"
								aria-invalid={noteError ? 'true' : undefined}
								class={inputClass}
								placeholder="Direct drive"
								maxlength={LIMITS.partNote + 20}
							/>
							{#if noteError}<p class={errorText}>{noteError}</p>{/if}
						</div>
					{/snippet}
					{#snippet empty()}
						<p class="m-0 rounded-sm border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-muted">
							No parts yet. Robots list their main parts here; software projects can skip it.
						</p>
					{/snippet}
				</ListEditor>
				{#if errors.parts}<p class={errorText} data-invalid>{errors.parts}</p>{/if}
				<Separator class="bg-line" />
				<FormField label="Software" optional error={errors.software} hint="Press Enter after each one, e.g. ROS 2, Nav2, MoveIt 2.">
					{#snippet children(attrs)}
						<TagsInput {...attrs} name="software" bind:tags={draft.software} max={LIMITS.software} maxLength={LIMITS.tag} placeholder="Add software" />
					{/snippet}
				</FormField>
			</Panel>
		</div>

		<aside class="flex min-w-0 flex-[1_1_300px] flex-col gap-4" aria-label="Project settings">
			<Panel title="Visibility" size="sm" padding="sm">
				<ToggleRow name="published" label="Show on website" hint="Listed on Projects" bind:checked={draft.published} />
				<ToggleRow name="featured" label="Feature on home page" hint="Big card under the numbers" bind:checked={draft.featured} divided />
				{#if draft.featured && featuredOther}
					<p class={['-mt-1 m-0', hintClass]}>Only one project is featured. Saving replaces {featuredOther.title}.</p>
				{/if}
				{#if draft.featured && !draft.published}
					<p class="-mt-1 m-0 text-xs leading-[18px] text-brand-text">Switch on Show on website too, or the home page has no featured project.</p>
				{/if}
				<ToggleRow name="showGallery" label="Show gallery" hint="Hidden until photos are added" bind:checked={draft.showGallery} divided />
			</Panel>

			<Panel title="Links" size="sm" padding="sm">
				<FormField
					label="Card link"
					optional
					error={errors.linkUrl}
					hint={`Cards open this instead of the project page, e.g. a GitHub repository. Empty opens ${draft.slug.trim() ? `/projects/${draft.slug.trim()}` : 'the project page'}.`}
				>
					{#snippet children(attrs)}
						<Input {...attrs} name="linkUrl" bind:value={draft.linkUrl} inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://..." class={monoInputClass} />
					{/snippet}
				</FormField>
				<FormField label="Code repository" optional error={errors.repoUrl}>
					{#snippet children(attrs)}
						<Input {...attrs} name="repoUrl" bind:value={draft.repoUrl} type="url" autocomplete="off" spellcheck="false" placeholder="https://github.com/..." class={monoInputClass} />
					{/snippet}
				</FormField>
				<PaperField label="Team description paper" name="paperUrl" bind:value={draft.paperUrl} error={errors.paperUrl} bind:uploading={paperUploading} />
				<FormField label="Tags" optional error={errors.tags} hint="Chips on the project card. Press Enter after each one.">
					{#snippet children(attrs)}
						<TagsInput {...attrs} name="tags" bind:tags={draft.tags} max={LIMITS.tags} maxLength={LIMITS.tag} />
					{/snippet}
				</FormField>
			</Panel>

			{#if mode === 'edit' && id && saved}
				<Panel title="Project" size="sm" padding="sm">
					<p class="m-0 text-[13px] leading-5 text-ink-muted">
						{#if updatedAt}
							Last saved <time datetime={isoString(updatedAt)} title={formatDateTime(updatedAt)}>{timeAgo(updatedAt, now, { lower: true })}</time>.
						{/if}
						Press <Kbd.Group><Kbd.Root>{modKey}</Kbd.Root><Kbd.Root>S</Kbd.Root></Kbd.Group> to save.
					</p>
					<Separator class="bg-line" />
					<ConfirmDelete
						action="?/delete"
						{id}
						title="Delete {saved.title}?"
						description={deleteDescription}
						triggerLabel="Delete project"
						confirmLabel="Delete project"
					/>
				</Panel>
			{:else}
				<p class={['m-0 px-1', hintClass]}>
					New projects start hidden and go to the top of the list. Press
					<Kbd.Group><Kbd.Root>{modKey}</Kbd.Root><Kbd.Root>S</Kbd.Root></Kbd.Group> to save.
				</p>
			{/if}
		</aside>
	</div>
</form>

<AlertDialog.Root bind:open={leaveOpen}>
	<AlertDialog.Content class="border border-line bg-surface-200 ring-0">
		<AlertDialog.Header>
			<AlertDialog.Title class="font-display text-lg font-semibold">Leave without saving?</AlertDialog.Title>
			<AlertDialog.Description class="text-sm leading-[22px] text-ink-muted">
				Your changes to this project are not saved yet. If you leave, they are lost.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				class="h-11 rounded-sm border-line-strong bg-transparent px-4 hover:border-ink dark:border-line-strong dark:bg-transparent dark:hover:bg-transparent"
			>
				Keep editing
			</AlertDialog.Cancel>
			<AdminButton variant="danger" onclick={leave}>Leave without saving</AdminButton>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
