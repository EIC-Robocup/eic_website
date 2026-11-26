<!--
	Project card from the Projects grid: 4:3 cover (or image slot), meta line, status,
	title and tags. The whole card is the link. `variant="compact"` is the smaller card
	of the home page's "older robots" row (meta and title only).
-->
<script lang="ts" module>
	export type ProjectCardData = {
		slug: string;
		title: string;
		category: string;
		year?: number | null;
		status: string;
		tags?: string[] | null;
		coverUrl?: string | null;
		coverAlt?: string | null;
		place?: string | null;
		/** When set the card links here instead of /projects/<slug>. */
		linkUrl?: string | null;
		/** Overrides the computed "Robot · 2026 · Place" line. */
		meta?: string | null;
	};
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js';
	import ImageSlot from './ImageSlot.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import Tag from './Tag.svelte';
	import { isExternal, projectMeta } from './format.ts';
	import { projectMorphKey } from '#lib/motion/view-transitions.ts';

	type Props = {
		project: ProjectCardData;
		headingLevel?: 2 | 3 | 4;
		variant?: 'grid' | 'compact';
		/** Load the cover eagerly (first row above the fold). */
		eager?: boolean;
		class?: string;
	};

	let { project, headingLevel = 2, variant = 'grid', eager = false, class: className }: Props =
		$props();

	const uid = $props.id();
	const href = $derived(project.linkUrl || `/projects/${project.slug}`);
	const external = $derived(isExternal(href));
	const meta = $derived(project.meta || projectMeta(project));
	const slotLabel = $derived(
		`${project.category === 'software' ? 'Screenshot' : 'Photo'} · ${project.title}`
	);
	/** The cover morphs into the project page's hero photo (only for cards that open it). */
	const morph = $derived(project.linkUrl ? null : projectMorphKey(project.slug));
	/** Grid cards: three across the 1200px column, two on tablets, one on phones. */
	const sizes = '(min-width: 1264px) 384px, (min-width: 1072px) 33vw, (min-width: 640px) 50vw, 100vw';
</script>

<a
	{href}
	rel={external ? 'noopener noreferrer' : undefined}
	aria-labelledby="{uid}-title"
	aria-describedby={meta ? `${uid}-meta` : undefined}
	data-vt-key={morph}
	class={cn(
		'group flex flex-col overflow-hidden rounded-lg border border-line bg-surface-200 text-ink no-underline transition-colors duration-150 hover:border-ink',
		className
	)}
>
	<ImageSlot
		src={project.coverUrl}
		alt={project.coverAlt ?? ''}
		label={slotLabel}
		aspect="4 / 3"
		{eager}
		{sizes}
		class={morph ? 'vt-target' : undefined}
	/>
	{#if variant === 'compact'}
		<div class="flex flex-col gap-1.5 border-t border-line px-6 py-5">
			{#if meta}<span id="{uid}-meta" class="text-label text-ink-muted">{meta}</span>{/if}
			<svelte:element
				this={`h${headingLevel}`}
				id="{uid}-title"
				class="font-display text-xl leading-[26px] font-semibold">{project.title}</svelte:element
			>
		</div>
	{:else}
		<div class="flex grow flex-col gap-3 border-t border-line px-6 pt-5 pb-6">
			<div class="flex items-center justify-between gap-3">
				<span id="{uid}-meta" class="text-label min-w-0 text-ink-muted">{meta}</span>
				<StatusBadge status={project.status} />
			</div>
			<svelte:element
				this={`h${headingLevel}`}
				id="{uid}-title"
				class="font-display text-2xl leading-[30px] font-semibold tracking-[-0.015em]"
				>{project.title}</svelte:element
			>
			{#if project.tags?.length}
				<div class="flex flex-wrap gap-1.5">
					{#each project.tags as tag, i (i)}
						<Tag label={tag} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</a>
