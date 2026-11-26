<script lang="ts">
	import { Separator } from '#lib/components/ui/separator/index.js';
	import FilterPills from '#lib/components/site/FilterPills.svelte';
	import Figure from '#lib/components/site/Figure.svelte';
	import HeroBand from '#lib/components/site/HeroBand.svelte';
	import HeroEyebrow from '#lib/components/site/HeroEyebrow.svelte';
	import Note from '#lib/components/site/Note.svelte';
	import ProjectCard from '#lib/components/site/ProjectCard.svelte';
	import SecNo from '#lib/components/site/SecNo.svelte';
	import SectionLabel from '#lib/components/site/SectionLabel.svelte';
	import Seo from '#lib/components/site/Seo.svelte';
	import TitleBlock from '#lib/components/site/TitleBlock.svelte';
	import { isExternal } from '#lib/components/site/format.ts';
	import { PROJECT_CATEGORY_FILTER_LABELS } from '#lib/content/labels.ts';
	import { fill } from '#lib/content/sections.ts';
	import { spell } from './project-meta.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const hero = $derived(data.sections.hero.data);
	const papers = $derived(data.sections.publications);
	const showPapers = $derived(papers.enabled && data.publications.length > 0);

	let filter = $state('all');

	const count = (category: string) => data.projects.filter((p) => p.category === category).length;

	const options = $derived([
		{ value: 'all', label: 'All', count: data.projects.length },
		{ value: 'robot', label: PROJECT_CATEGORY_FILTER_LABELS.robot, count: count('robot') },
		{ value: 'software', label: PROJECT_CATEGORY_FILTER_LABELS.software, count: count('software') },
		...(count('research') > 0
			? [{ value: 'research', label: PROJECT_CATEGORY_FILTER_LABELS.research, count: count('research') }]
			: [])
	]);

	const shown = $derived(
		filter === 'all' ? data.projects : data.projects.filter((p) => p.category === filter)
	);

	const seoDescription = $derived(
		[hero.headline, hero.subline].map((s) => s.trim()).filter(Boolean).join(' ')
	);
</script>

<Seo
	title="Projects"
	description={seoDescription}
	image={hero.image.url || null}
	imageAlt={hero.image.alt}
/>

<HeroBand circle={{ cx: 1160, cy: 320, r: 280 }} height={640} labelledby="projects-title">
	<div
		class="site-container flex flex-wrap items-center gap-x-14 gap-y-10 pt-10 pb-7 sm:pt-16"
	>
		<div class="flex min-w-0 flex-[1_1_400px] flex-col gap-[22px]">
			<HeroEyebrow
				label={hero.label}
				sublabel={fill(hero.sublabel, { count: spell(data.projects.length) })}
			/>
			<h1
				id="projects-title"
				class="m-0 font-display text-[clamp(52px,6.6vw,96px)] leading-[0.92] font-semibold tracking-[-0.04em]"
			>
				{hero.headline}
			</h1>
			{#if hero.subline}
				<p class="m-0 text-[19px] leading-[30px] text-ink-muted">{hero.subline}</p>
			{/if}
		</div>
		<Figure
			src={hero.image.url || null}
			alt={hero.image.alt}
			label={hero.imageLabel}
			aspect="16 / 10"
			fig={1}
			caption={hero.caption}
			eager
			class="flex-[1_1_460px]"
			note={hero.note ? heroNote : undefined}
		/>
		{#snippet heroNote()}
			<Note text={hero.note} arrow="right" rot={-4} />
		{/snippet}
	</div>
	{#snippet titleBlock()}
		<TitleBlock dwg="PROJECTS" sheet="02" />
	{/snippet}
</HeroBand>

<section
	aria-labelledby="builds-title"
	class="site-container flex flex-col gap-8 pt-16 pb-16 md:pt-[72px] md:pb-[104px]"
>
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<SecNo no={1} />
			<h2 id="builds-title" class="text-label m-0 text-ink-muted">Builds</h2>
			<Separator decorative class="bg-line-strong data-horizontal:w-16" />
		</div>
		{#if data.projects.length}
			<FilterPills label="Filter projects" {options} bind:value={filter} />
		{/if}
	</div>
	<p class="sr-only" aria-live="polite">
		{shown.length === 1 ? '1 project shown' : `${shown.length} projects shown`}
	</p>
	{#if shown.length}
		<ul
			class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-6 p-0"
		>
			{#each shown as project (project.slug)}
				<li class="flex min-w-0 flex-col">
					<ProjectCard {project} headingLevel={3} class="grow" />
				</li>
			{/each}
		</ul>
	{:else}
		<p class="m-0 text-ink-muted">No projects here yet.</p>
	{/if}
</section>

{#if showPapers}
	<section
		id="publications"
		aria-labelledby="papers-title"
		class="scroll-mt-20 bg-surface-000 py-16 md:py-[104px]"
	>
		<div class="site-container flex flex-wrap gap-12">
			<div class="flex min-w-0 flex-[1_1_280px] flex-col gap-5 sm:max-w-[360px]">
				<SectionLabel no={2} label={papers.data.eyebrow} />
				<h2
					id="papers-title"
					class="m-0 font-display text-[clamp(40px,4.4vw,56px)] leading-none font-semibold tracking-[-0.025em]"
				>
					{papers.data.heading}
				</h2>
			</div>
			<ul class="m-0 min-w-0 flex-[999_1_560px] list-none p-0">
				{#each data.publications as paper (paper.id)}
					<li>
						<article
							class="grid grid-cols-[64px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 border-t border-line py-[22px] sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:gap-x-6"
						>
							<span class="font-display text-2xl leading-7 font-semibold text-brand-text"
								>{paper.year}</span
							>
							<div class="flex min-w-0 flex-col gap-1">
								<h3 class="m-0 text-base leading-[25px] font-semibold">{paper.title}</h3>
								{#if paper.authors || paper.venue}
									<p class="m-0 text-sm leading-[22px] text-ink-muted">
										{[paper.authors, paper.venue].filter(Boolean).join('. ')}
									</p>
								{/if}
							</div>
							{#if paper.url}
								<a
									href={paper.url}
									target={isExternal(paper.url) ? '_blank' : undefined}
									rel={isExternal(paper.url) ? 'noopener noreferrer' : undefined}
									class="col-start-2 inline-flex min-h-11 items-center self-center justify-self-start font-mono text-[13px] tracking-[0.06em] whitespace-nowrap text-brand-text no-underline transition-colors duration-150 hover:text-ink sm:col-start-auto sm:min-h-0 sm:self-baseline"
									>PDF<span aria-hidden="true"> ↗</span><span class="sr-only"
										>, {paper.title}{isExternal(paper.url) ? ' (opens in a new tab)' : ''}</span
									></a
								>
							{/if}
						</article>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}
