<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import AchievementsEditor from '#lib/components/admin/lists/AchievementsEditor.svelte';
	import ArchiveEditor from '#lib/components/admin/lists/ArchiveEditor.svelte';
	import PublicationsEditor from '#lib/components/admin/lists/PublicationsEditor.svelte';
	import SponsorsEditor from '#lib/components/admin/lists/SponsorsEditor.svelte';
	import type { ListKey } from '#lib/components/admin/lists/rows.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const dirty = $state<Record<ListKey, boolean>>({
		achievements: false,
		archive: false,
		sponsors: false,
		publications: false
	});
	const TITLES: Record<ListKey, string> = {
		achievements: 'achievements',
		archive: 'archive photos',
		sponsors: 'sponsors',
		publications: 'publications'
	};
	const unsaved = $derived((Object.keys(dirty) as ListKey[]).filter((key) => dirty[key]));
	const unsavedText = $derived.by(() => {
		const names = unsaved.map((key) => TITLES[key]);
		if (names.length <= 1) return names[0] ?? '';
		return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	});

	/* Ask before leaving with unsaved lists. */
	let leaveOpen = $state(false);
	let leaving: { url: URL; delta?: number } | null = null;
	let bypass = false;

	beforeNavigate((navigation) => {
		if (bypass || unsaved.length === 0) return;
		if (navigation.willUnload) {
			// Reload, tab close or another site: the browser shows its own prompt.
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
		bypass = false;
	}
</script>

<PageHeader
	breadcrumb={[{ label: 'Content' }, { label: 'About page lists' }]}
	title="Achievements and lists"
	description="The timeline, archive photos and sponsors on the About page, and the papers on the Projects page. Each list saves on its own."
>
	{#snippet actions()}
		<AdminButton variant="outline" href="/about" external>View About page</AdminButton>
	{/snippet}
</PageHeader>

<AchievementsEditor server={data.lists.achievements} shown={data.shown.achievements} bind:dirty={dirty.achievements} />

<div class="flex flex-wrap items-start gap-6">
	<div class="flex min-w-0 flex-[1_1_460px] flex-col">
		<ArchiveEditor server={data.lists.archive} shown={data.shown.archive} bind:dirty={dirty.archive} />
	</div>
	<div class="flex min-w-0 flex-[1_1_360px] flex-col">
		<SponsorsEditor server={data.lists.sponsors} shown={data.shown.sponsors} bind:dirty={dirty.sponsors} />
	</div>
</div>

<PublicationsEditor server={data.lists.publications} shown={data.shown.publications} bind:dirty={dirty.publications} />

<AlertDialog.Root bind:open={leaveOpen}>
	<AlertDialog.Content class="border border-line bg-surface-200 ring-0">
		<AlertDialog.Header>
			<AlertDialog.Title class="font-display text-lg font-semibold">Leave without saving?</AlertDialog.Title>
			<AlertDialog.Description class="text-sm leading-[22px] text-ink-muted">
				Your changes to the {unsavedText} are not saved. If you leave now, they are lost.
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
