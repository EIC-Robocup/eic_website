<script lang="ts">
	import ButtonLink from '#lib/components/site/ButtonLink.svelte';
	import Figure from '#lib/components/site/Figure.svelte';
	import HeroBand from '#lib/components/site/HeroBand.svelte';
	import HeroEyebrow from '#lib/components/site/HeroEyebrow.svelte';
	import ImageSlot from '#lib/components/site/ImageSlot.svelte';
	import Note from '#lib/components/site/Note.svelte';
	import PersonCard from '#lib/components/site/PersonCard.svelte';
	import PostCard from '#lib/components/site/PostCard.svelte';
	import ProjectCard from '#lib/components/site/ProjectCard.svelte';
	import SectionHeader from '#lib/components/site/SectionHeader.svelte';
	import SectionLabel from '#lib/components/site/SectionLabel.svelte';
	import Seo from '#lib/components/site/Seo.svelte';
	import StatusBadge from '#lib/components/site/StatusBadge.svelte';
	import TitleBlock from '#lib/components/site/TitleBlock.svelte';
	import { fill } from '#lib/content/sections.ts';
	import { splitArrow } from './projects/project-meta.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const hero = $derived(data.sections.hero.data);
	// Resolved in the load: typed values and numbers counted from the database.
	const stats = $derived(data.stats);
	const featuredCopy = $derived(data.sections.featured.data);
	const stories = $derived(data.sections.stories.data);
	const peopleCopy = $derived(data.sections.people.data);
	const join = $derived(data.sections.join);

	const featured = $derived(data.featured);
	const chips = $derived(featuredCopy.chips.filter((c) => c.trim()));
	const cta = $derived(
		featured ? splitArrow(fill(featuredCopy.cta, { title: featured.title })) : null
	);

	const showFeatured = $derived(Boolean(featured) || data.older.length > 0);
	const showStories = $derived(data.sections.stories.enabled && data.posts.length > 0);
	const showPeople = $derived(data.sections.people.enabled && data.people.length > 0);

	// Section numbers follow the sections actually shown.
	const no = $derived.by(() => {
		let n = 0;
		return {
			featured: showFeatured ? ++n : 0,
			stories: showStories ? ++n : 0,
			people: showPeople ? ++n : 0
		};
	});

	const seoDescription = $derived(
		[hero.headline, hero.subline].map((s) => s.trim()).filter(Boolean).join(' ')
	);
</script>

<Seo description={seoDescription} image={hero.image.url || null} imageAlt={hero.image.alt} />

<!-- Line icons for the featured card's chips, reused in order. -->
{#snippet chipIcon(i: number)}
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="var(--eic-brand-text)"
		stroke-width="1.6"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		class="shrink-0"
	>
		{#if i % 4 === 0}
			<path d="M2 12 h3 l2 -6 l4 12 l3 -9 l2 4 h6" />
		{:else if i % 4 === 1}
			<path d="M4 20 L9 13 L14 15 L20 6" /><circle cx="9" cy="13" r="1.6" /><circle
				cx="14"
				cy="15"
				r="1.6"
			/>
		{:else if i % 4 === 2}
			<path d="M3 19 A9 9 0 0 1 21 19 M7 19 A5 5 0 0 1 17 19" /><circle cx="12" cy="19" r="1.4" />
		{:else}
			<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path
				d="M12 4 v2 M12 18 v2 M4 12 h2 M18 12 h2"
			/>
		{/if}
	</svg>
{/snippet}

<HeroBand circle={{ cx: 300, cy: 380, r: 300 }} height={760} labelledby="home-title">
	<div
		class="site-container flex flex-wrap items-center gap-x-14 gap-y-10 pt-10 pb-7 sm:pt-16"
	>
		<div class="flex min-w-0 flex-[1_1_420px] flex-col gap-[26px]">
			<HeroEyebrow label={hero.label} sublabel={hero.sublabel} />
			<h1
				id="home-title"
				class="m-0 font-display text-[clamp(52px,6.6vw,96px)] leading-[0.92] font-semibold tracking-[-0.04em]"
			>
				{hero.headline}
			</h1>
			{#if hero.subline}
				<p class="m-0 text-[19px] leading-[30px] text-ink-muted">{hero.subline}</p>
			{/if}
			{#if hero.primaryCta.label || hero.secondaryCta.label}
				<div class="flex flex-wrap gap-3">
					{#if hero.primaryCta.label && hero.primaryCta.href}
						<ButtonLink href={hero.primaryCta.href}>{hero.primaryCta.label}</ButtonLink>
					{/if}
					{#if hero.secondaryCta.label && hero.secondaryCta.href}
						<ButtonLink href={hero.secondaryCta.href} variant="outline"
							>{hero.secondaryCta.label}</ButtonLink
						>
					{/if}
				</div>
			{/if}
		</div>
		<Figure
			src={hero.image.url || null}
			alt={hero.image.alt}
			label={hero.imageLabel}
			aspect="16 / 11"
			fig={1}
			caption={hero.caption}
			eager
			class="flex-[1_1_460px]"
			note={hero.note ? heroNote : undefined}
		/>
		{#snippet heroNote()}
			<Note text={hero.note} arrow="right" rot={-6} />
		{/snippet}
	</div>
	{#snippet titleBlock()}
		<TitleBlock dwg="HOME" sheet="01" />
	{/snippet}
</HeroBand>

{#if stats.length}
	<section aria-label="In numbers" class="site-container pt-16 pb-16 md:pt-[88px] md:pb-24">
		<!-- Each cell draws hairlines on its right and bottom; the frame clips the outer ones,
		     so a short last row leaves no grey gaps. -->
		<div class="overflow-hidden rounded-lg border border-line">
			<ul
				class="m-0 -mr-px -mb-px grid list-none grid-cols-2 p-0 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
			>
				{#each stats as stat, i (i)}
					<li
						class="flex min-w-0 flex-col gap-2.5 bg-surface-100 p-5 shadow-[inset_-1px_0_0_var(--eic-line),inset_0_-1px_0_var(--eic-line)] sm:p-7"
					>
						<span
							class={[
								'font-display text-[clamp(34px,10vw,52px)] leading-none font-medium tracking-[-0.035em] break-words',
								i === 0 ? 'text-brand-text' : 'text-ink'
							]}>{stat.value}</span
						>
						{#if stat.label}
							<!-- Each "·" part stays together when it fits, so narrow cells wrap at the dots. -->
							{@const parts = stat.label.split(' · ')}
							<span class="text-label text-ink-muted"
								>{#each parts as part, j (j)}{#if j > 0}{' '}{/if}<span class="inline-block max-w-full"
										>{part}{#if j < parts.length - 1}&nbsp;·{/if}</span
									>{/each}</span
							>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

{#if showFeatured}
	<section
		aria-labelledby="featured-title"
		class={[
			'site-container flex flex-col gap-8 pb-16 md:pb-28',
			!stats.length && 'pt-16 md:pt-24'
		]}
	>
		<SectionHeader
			no={no.featured}
			label={featuredCopy.eyebrow}
			title={featured?.title ?? 'Projects'}
			id="featured-title"
			link={{ label: 'All projects →', href: '/projects' }}
		/>
		{#if featured}
			<a
				href={featured.href}
				rel={featured.external ? 'noopener noreferrer' : undefined}
				aria-labelledby={cta?.text ? 'featured-cta' : 'featured-title'}
				aria-describedby={featured.tagline ? 'featured-tagline' : undefined}
				class="group @container flex flex-row flex-wrap overflow-hidden rounded-lg border border-line bg-surface-200 text-ink no-underline transition-colors duration-150 hover:border-ink"
			>
				<ImageSlot
					src={featured.coverUrl}
					alt={featured.coverAlt ?? ''}
					label="{featured.category === 'software' ? 'Screenshot' : 'Photo'} · {featured.title}"
					aspect="4 / 3"
					class="min-w-0 flex-[1_1_560px]"
					sizes="(min-width: 1264px) 720px, (min-width: 944px) calc(50vw + 88px), 100vw"
				/>
				<div
					class="flex min-w-0 flex-[1_1_320px] flex-col justify-between gap-7 border-t border-line p-5 sm:p-9 @min-[880px]:border-t-0 @min-[880px]:border-l"
				>
					<div class="flex flex-col gap-3.5">
						<div class="flex flex-wrap items-center gap-x-3.5 gap-y-2">
							<StatusBadge status={featured.status} />
							{#if featured.meta}<span class="text-label text-ink-muted">{featured.meta}</span>{/if}
						</div>
						{#if featured.tagline}
							<p
								id="featured-tagline"
								class="m-0 font-display text-[26px] leading-[30px] font-semibold tracking-[-0.015em] sm:text-[30px] sm:leading-[34px]"
							>
								{featured.tagline}
							</p>
						{/if}
					</div>
					{#if chips.length}
						<ul
							class="m-0 grid list-none grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line p-0"
						>
							{#each chips as chip, i (i)}
								<li
									class={[
										'flex min-w-0 items-center gap-2.5 bg-surface-100 px-3 py-3 text-sm font-medium sm:px-3.5',
										chips.length % 2 === 1 && i === chips.length - 1 && 'col-span-2'
									]}
								>
									{@render chipIcon(i)}<span class="min-w-0">{chip}</span>
								</li>
							{/each}
						</ul>
					{/if}
					{#if cta?.text}
						<span
							class="text-[15px] font-medium whitespace-nowrap text-brand-text transition-colors duration-150 group-hover:text-ink"
							><span id="featured-cta">{cta.text}</span>{#if cta.arrow}{' '}<span aria-hidden="true"
									>{cta.arrow}</span
								>{/if}</span
						>
					{/if}
				</div>
			</a>
		{/if}
		{#if data.older.length}
			<ul
				class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-6 p-0"
			>
				{#each data.older as project (project.slug)}
					<li class="flex min-w-0 flex-col">
						<ProjectCard {project} variant="compact" headingLevel={3} class="grow" />
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

{#if showStories}
	<section aria-labelledby="stories-title" class="bg-surface-000 py-16 md:py-[104px]">
		<div class="site-container flex flex-col gap-8">
			<SectionHeader
				no={no.stories}
				label={stories.eyebrow}
				title={stories.heading}
				id="stories-title"
				link={{ label: 'All posts →', href: '/blog' }}
			/>
			<ul
				class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-6 p-0"
			>
				{#each data.posts as post (post.id)}
					<li class="flex min-w-0 flex-col">
						<PostCard {post} showAuthor={false} class="grow" />
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

{#if showPeople}
	<section
		aria-labelledby="people-title"
		class="site-container flex flex-wrap items-center gap-12 py-16 md:py-[104px]"
	>
		<div class="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
			<SectionLabel no={no.people} label={peopleCopy.eyebrow} />
			<h2
				id="people-title"
				class="m-0 font-display text-[clamp(40px,4.4vw,56px)] leading-none font-semibold tracking-[-0.025em] text-balance"
			>
				{fill(peopleCopy.heading, { count: data.peopleCount })}
			</h2>
			{#if peopleCopy.cta.label && peopleCopy.cta.href}
				<ButtonLink href={peopleCopy.cta.href} variant="outline" class="self-start"
					>{peopleCopy.cta.label}</ButtonLink
				>
			{/if}
		</div>
		<ul
			class="m-0 grid min-w-0 flex-[1_1_560px] list-none grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-x-5 gap-y-8 p-0"
		>
			{#each data.people as person (person.id)}
				<li class="min-w-0 break-words">
					<PersonCard {person} size="sm" href="/people" highlightLead={false} />
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if join.enabled}
	<section
		aria-labelledby="join-title"
		class="relative overflow-hidden bg-brand text-on-brand"
	>
		<svg
			aria-hidden="true"
			viewBox="0 0 420 420"
			class="pointer-events-none absolute -right-20 -bottom-20 size-[300px] sm:size-[420px]"
		>
			<g fill="none" stroke="#ffffff">
				<circle cx="420" cy="420" r="90" stroke-opacity="0.5" />
				<circle cx="420" cy="420" r="170" stroke-opacity="0.38" />
				<circle cx="420" cy="420" r="250" stroke-opacity="0.28" stroke-dasharray="2 6" />
				<circle cx="420" cy="420" r="330" stroke-opacity="0.2" />
			</g>
		</svg>
		<div class="relative site-container flex flex-col items-start gap-7 py-16 md:py-24">
			{#if join.data.eyebrow}<span class="text-label text-on-brand">{join.data.eyebrow}</span>{/if}
			<h2
				id="join-title"
				class="m-0 max-w-[9em] font-display text-[clamp(44px,5.4vw,76px)] leading-[0.96] font-semibold tracking-[-0.035em]"
			>
				{join.data.heading}
			</h2>
			{#if (join.data.primaryCta.label && join.data.primaryCta.href) || (join.data.secondaryCta.label && join.data.secondaryCta.href)}
				<div class="flex flex-wrap gap-3">
					{#if join.data.primaryCta.label && join.data.primaryCta.href}
						<ButtonLink href={join.data.primaryCta.href} variant="on-brand"
							>{join.data.primaryCta.label}</ButtonLink
						>
					{/if}
					{#if join.data.secondaryCta.label && join.data.secondaryCta.href}
						<ButtonLink href={join.data.secondaryCta.href} variant="on-brand-outline"
							>{join.data.secondaryCta.label}</ButtonLink
						>
					{/if}
				</div>
			{/if}
		</div>
	</section>
{/if}
