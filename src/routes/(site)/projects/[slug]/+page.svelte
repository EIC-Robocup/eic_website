<script lang="ts">
	import ButtonLink from '#lib/components/site/ButtonLink.svelte';
	import Figure from '#lib/components/site/Figure.svelte';
	import HeroBand from '#lib/components/site/HeroBand.svelte';
	import ImageSlot from '#lib/components/site/ImageSlot.svelte';
	import Note from '#lib/components/site/Note.svelte';
	import PostCard from '#lib/components/site/PostCard.svelte';
	import SectionHeader from '#lib/components/site/SectionHeader.svelte';
	import SectionLabel from '#lib/components/site/SectionLabel.svelte';
	import Seo from '#lib/components/site/Seo.svelte';
	import StatusBadge from '#lib/components/site/StatusBadge.svelte';
	import Tag from '#lib/components/site/Tag.svelte';
	import TitleBlock from '#lib/components/site/TitleBlock.svelte';
	import { pad2 } from '#lib/components/site/format.ts';
	import { splitPlacement } from '#lib/content/labels.ts';
	import { capitalise, spell } from '../project-meta.ts';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const p = $derived(data.project);
	const slotKind = $derived(p.category === 'software' ? 'Screenshot' : 'Photo');

	const highlight = $derived.by(() => {
		if (!p.highlight) return null;
		const split = splitPlacement(p.highlight.value);
		// "6th" gets the big numeral with a small suffix; longer text ("Finalist") is set smaller.
		const big = split.numeric && !split.rest.trim() && split.number.length <= 3;
		return { ...p.highlight, big, number: split.number, suffix: split.suffix };
	});

	const showSystems = $derived(p.systems.length > 0);
	const showParts = $derived(p.parts.length > 0 || p.software.length > 0);
	const showGallery = $derived(p.gallery.length > 0);
	const showRelated = $derived(p.related.length > 0);

	// Sections are numbered in the order shown, and alternate page and deep bands.
	const order = $derived.by(() => {
		let n = 0;
		let band = 0;
		const next = (shown: boolean, numbered = true) =>
			shown ? { no: numbered ? ++n : 0, deep: band++ % 2 === 1 } : { no: 0, deep: false };
		return {
			systems: next(showSystems),
			parts: next(showParts),
			gallery: next(showGallery),
			related: next(showRelated, false)
		};
	});

	const systemsTitle = $derived.by(() => {
		const n = p.systems.length;
		const thing = p.category === 'robot' ? 'robot' : p.category === 'software' ? 'stack' : 'project';
		return `${capitalise(spell(n))} system${n === 1 ? '' : 's'}, one ${thing}.`;
	});
</script>

<Seo
	title={p.title}
	description={p.summary || p.tagline || null}
	image={p.coverUrl}
	imageAlt={p.coverAlt}
/>

<!-- Line icons for the "How it works" cards, reused in order. -->
{#snippet systemIcon(i: number)}
	<svg
		width="56"
		height="56"
		viewBox="0 0 56 56"
		fill="none"
		stroke="var(--eic-ink)"
		stroke-width="1.6"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		class="shrink-0"
	>
		{#if i % 4 === 0}
			<path d="M4 28 h6 l4 -10 l6 20 l5 -14 l4 8 h5" />
			<circle cx="44" cy="28" r="7" stroke="var(--eic-brand)" />
			<circle cx="44" cy="28" r="2" fill="var(--eic-brand)" stroke="none" />
		{:else if i % 4 === 1}
			<path d="M8 48 L20 32 L30 36 L44 14" />
			<circle cx="20" cy="32" r="3" />
			<circle cx="30" cy="36" r="3" />
			<path d="M44 14 l6 -2 M44 14 l2 6" stroke="var(--eic-brand)" />
		{:else if i % 4 === 2}
			<path d="M6 46 A22 22 0 0 1 50 46 M15 46 A13 13 0 0 1 41 46" />
			<path d="M28 46 L40 22" stroke="var(--eic-brand)" />
			<circle cx="40" cy="22" r="2.5" fill="var(--eic-brand)" stroke="none" />
		{:else}
			<circle cx="28" cy="28" r="17" />
			<circle cx="28" cy="28" r="5" />
			<circle cx="28" cy="28" r="23" stroke="var(--eic-brand)" stroke-dasharray="5 4" />
		{/if}
	</svg>
{/snippet}

<HeroBand circle={{ cx: 260, cy: 300, r: 260 }} height={900} labelledby="project-title">
	<div class="site-container flex flex-col gap-5 pt-8 sm:pt-10">
		<nav aria-label="Breadcrumb">
			<ol class="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-sm text-ink-muted">
				<li class="flex items-center gap-2">
					<a
						href="/projects"
						class="inline-flex min-h-11 items-center text-ink-muted underline underline-offset-4 transition-colors duration-150 hover:text-ink sm:min-h-0"
						>Projects</a
					>
					<span aria-hidden="true">/</span>
				</li>
				<li><span aria-current="page" class="text-ink">{p.title}</span></li>
			</ol>
		</nav>
		<div class="flex flex-wrap items-end justify-between gap-6">
			<div class="flex min-w-0 flex-col gap-4">
				<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
					<StatusBadge status={p.status} />
					{#if p.meta}<span class="text-label text-ink-muted">{p.meta}</span>{/if}
				</div>
				<h1
					id="project-title"
					class="m-0 font-display text-[clamp(64px,9vw,132px)] leading-[0.86] font-semibold tracking-[-0.045em] break-words"
				>
					{p.title}
				</h1>
				{#if p.tagline}
					<p
						class="m-0 font-display text-[22px] leading-7 font-semibold tracking-[-0.01em] text-ink-muted sm:text-[26px] sm:leading-8"
					>
						{p.tagline}
					</p>
				{:else if p.summary}
					<p class="m-0 max-w-[36em] text-[19px] leading-[30px] text-ink-muted">{p.summary}</p>
				{/if}
			</div>
			<TitleBlock dwg={p.title.toUpperCase()} sheet="03" />
		</div>
	</div>
	<div class="site-container flex flex-wrap items-start gap-8 pt-8 pb-12">
		<Figure
			src={p.coverUrl}
			alt={p.coverAlt || p.title}
			label="{slotKind} · {p.coverAlt || p.title}"
			aspect="4 / 3"
			fig={1}
			caption={p.coverCaption}
			iconSize={36}
			eager
			class="flex-[999_1_620px]"
		/>
		<aside aria-label="Project facts" class="flex min-w-0 flex-[1_1_280px] flex-col gap-5">
			{#if highlight}
				<div class="relative flex flex-col gap-1.5">
					<p
						class={[
							'm-0 font-display leading-[0.9] font-medium text-brand',
							highlight.big
								? 'text-[112px] tracking-[-0.05em]'
								: 'text-[56px] tracking-[-0.03em] break-words'
						]}
					>
						{#if highlight.big}{highlight.number}<span
								class="align-top text-[36px] tracking-normal">{highlight.suffix}</span
							>{:else}{highlight.value}{/if}
					</p>
					{#if highlight.label}
						<span class="text-label text-ink-muted">{highlight.label}</span>
					{/if}
					{#if highlight.note && highlight.big}
						<div class="absolute top-1 right-0">
							<Note text={highlight.note} arrow="down-left" rot={-6} />
						</div>
					{/if}
				</div>
			{/if}
			{#if p.facts.length}
				<dl class="m-0 flex flex-col border border-line-strong">
					{#each p.facts as fact (fact.key)}
						<div class="grid grid-cols-[104px_minmax(0,1fr)] border-b border-line">
							<dt class="text-label border-r border-line p-3.5 text-ink-muted">{fact.key}</dt>
							<dd class="m-0 px-3.5 py-3 text-[15px] leading-[22px] font-medium break-words">
								{fact.value}
							</dd>
						</div>
					{/each}
				</dl>
			{/if}
			{#if p.repo || p.paperUrl}
				<div class="flex flex-col gap-2">
					{#if p.repo}
						<ButtonLink href={p.repo.href} variant="light" class="w-full">{p.repo.label}</ButtonLink>
					{/if}
					{#if p.paperUrl}
						<ButtonLink href={p.paperUrl} variant="outline" class="w-full"
							>Team description paper</ButtonLink
						>
					{/if}
				</div>
			{/if}
		</aside>
	</div>
</HeroBand>

{#if showSystems}
	<section
		aria-labelledby="systems-title"
		class={['py-16 md:py-24', order.systems.deep && 'bg-surface-000']}
	>
		<div class="site-container flex flex-col gap-8">
			<SectionHeader
				no={order.systems.no}
				label="How it works"
				title={systemsTitle}
				id="systems-title"
			/>
			<!-- Each card draws hairlines on its right and bottom; the frame clips the outer ones. -->
			<div class="overflow-hidden rounded-lg border border-line">
				<ul
					class="m-0 -mr-px -mb-px grid list-none grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] p-0"
				>
					{#each p.systems as system, i (i)}
						<li
							class="bg-surface-100 p-6 shadow-[inset_-1px_0_0_var(--eic-line),inset_0_-1px_0_var(--eic-line)] sm:p-7"
						>
							<article class="flex flex-col gap-3.5">
								{@render systemIcon(i)}
								<span class="text-label text-brand-text">{pad2(i + 1)}</span>
								<h3 class="m-0 font-display text-[21px] leading-[26px] font-semibold">
									{system.title}
								</h3>
								{#if system.description}
									<p class="m-0 text-[15px] leading-[23px] text-ink-muted">{system.description}</p>
								{/if}
							</article>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>
{/if}

{#if showParts}
	<section
		aria-labelledby="parts-title"
		class={['py-16 md:py-24', order.parts.deep && 'bg-surface-000']}
	>
		<div class="site-container flex flex-wrap gap-12">
			<div class="flex min-w-0 flex-[1_1_300px] flex-col gap-5 sm:max-w-[400px]">
				<SectionLabel no={order.parts.no} label="Parts list" />
				<h2
					id="parts-title"
					class="m-0 font-display text-[clamp(40px,4.4vw,56px)] leading-none font-semibold tracking-[-0.025em]"
				>
					What's inside
				</h2>
				{#if p.partsPhoto}
					<ImageSlot
						src={p.partsPhoto.url || null}
						alt={p.partsPhoto.alt || p.partsPhoto.caption}
						label="Photo · {p.partsPhoto.caption || p.partsPhoto.alt}"
						rounded
					/>
				{/if}
			</div>
			<div class="min-w-0 flex-[999_1_560px]">
				{#if p.parts.length}
					<table class="w-full table-fixed border-collapse font-mono text-sm leading-5">
						<caption class="sr-only">Parts of {p.title}</caption>
						<colgroup>
							<col class="w-12 sm:w-[72px]" />
							<col class="w-12 sm:w-16" />
							<col class="w-[45%]" />
							<col />
						</colgroup>
						<thead>
							<tr class="text-left text-xs tracking-[0.08em] text-ink-muted">
								<th scope="col" class="pr-4 pb-3.5 font-normal">ITEM</th>
								<th scope="col" class="pr-4 pb-3.5 font-normal">QTY</th>
								<th scope="col" class="pr-4 pb-3.5 font-normal">PART</th>
								<th scope="col" class="pb-3.5 font-normal">NOTE</th>
							</tr>
						</thead>
						<tbody>
							{#each p.parts as part, i (i)}
								<tr class="border-t border-line align-baseline">
									<td class="py-3.5 pr-4 text-brand-text">{pad2(i + 1)}</td>
									<td class="py-3.5 pr-4">{part.qty}</td>
									<th scope="row" class="py-3.5 pr-4 text-left font-normal break-words text-ink"
										>{part.part}</th
									>
									<td class="py-3.5 break-words text-ink-muted">{part.note}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
				{#if p.software.length}
					<ul
						aria-label="Software"
						class="m-0 flex list-none flex-wrap gap-2 border-t border-line p-0 pt-6"
					>
						{#each p.software as item, i (i)}
							<li><Tag label={item} tone="outline" size="md" /></li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</section>
{/if}

{#if showGallery}
	<section
		aria-labelledby="gallery-title"
		class={['py-16 md:py-24', order.gallery.deep && 'bg-surface-000']}
	>
		<div class="site-container flex flex-col gap-8">
			<SectionHeader
				no={order.gallery.no}
				label="Gallery"
				title="In the lab"
				id="gallery-title"
			/>
			<ul
				class="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-5 p-0 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-4"
			>
				{#each p.gallery as photo, i (i)}
					<li class="min-w-0">
						<Figure
							src={photo.url || null}
							alt={photo.alt || photo.caption}
							label="Photo"
							aspect="4 / 3"
							fig={i + 2}
							caption={photo.caption}
							iconSize={28}
						/>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

{#if showRelated}
	<section
		aria-labelledby="related-title"
		class={['py-16 md:py-24', order.related.deep && 'bg-surface-000']}
	>
		<div class="site-container flex flex-col gap-8">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<h2
					id="related-title"
					class="m-0 font-display text-[clamp(32px,3.4vw,44px)] leading-[1.05] font-semibold tracking-[-0.02em]"
				>
					Read more
				</h2>
				<a
					href="/blog"
					class="text-[15px] font-medium whitespace-nowrap text-brand-text no-underline transition-colors duration-150 hover:text-ink"
					>All posts →</a
				>
			</div>
			<ul
				class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-6 p-0"
			>
				{#each p.related as post (post.id)}
					<li class="flex min-w-0 flex-col">
						<PostCard {post} variant="row" class="grow" />
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}
