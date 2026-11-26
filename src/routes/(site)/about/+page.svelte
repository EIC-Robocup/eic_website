<script lang="ts">
	import { page } from '$app/state';
	import ButtonLink from '#lib/components/site/ButtonLink.svelte';
	import Figure from '#lib/components/site/Figure.svelte';
	import HeroBand from '#lib/components/site/HeroBand.svelte';
	import HeroEyebrow from '#lib/components/site/HeroEyebrow.svelte';
	import ImageSlot from '#lib/components/site/ImageSlot.svelte';
	import Note from '#lib/components/site/Note.svelte';
	import SectionHeader from '#lib/components/site/SectionHeader.svelte';
	import SectionLabel from '#lib/components/site/SectionLabel.svelte';
	import Seo from '#lib/components/site/Seo.svelte';
	import TitleBlock from '#lib/components/site/TitleBlock.svelte';
	import building from '#lib/components/site/assets/building-1-line.webp';
	import { isExternal, pad2 } from '#lib/components/site/format.ts';
	import AchievementsTimeline from './AchievementsTimeline.svelte';
	import ContactForm from './ContactForm.svelte';
	import GearDrawing from './GearDrawing.svelte';
	import PillarIcon from './PillarIcon.svelte';
	import { isTopic } from './contact.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const s = $derived(data.sections);
	const hero = $derived(s.hero.data);
	const join = $derived(s.join.data);
	const contact = $derived(s.contact.data);

	const pillars = $derived(
		s.pillars.enabled ? s.pillars.data.items.filter((p) => p.title || p.text) : []
	);
	const showAchievements = $derived(s.achievements.enabled && data.achievements.length > 0);
	const showArchive = $derived(s.archive.enabled && data.archive.length > 0);
	const showSponsors = $derived(s.sponsors.enabled && data.sponsors.length > 0);

	/** Section numbers follow the sections that are shown; the pillars are 01. */
	const numbers = $derived.by(() => {
		let n = 1;
		return {
			achievements: showAchievements ? ++n : 0,
			archive: showArchive ? ++n : 0,
			join: s.join.enabled ? ++n : 0,
			contact: s.contact.enabled ? ++n : 0
		};
	});

	const years = $derived(data.achievements.map((a) => a.year));
	const yearRange = $derived(
		years.length ? `${Math.min(2006, ...years)} to ${Math.max(...years)}!` : ''
	);

	/** ?topic= preselects the form's topic; the join cards link here with one. */
	const urlTopic = $derived(page.url.searchParams.get('topic'));
	const topic = $derived(isTopic(urlTopic) ? urlTopic : 'joining');

	/** Point "#contact" buttons at the form with the right topic. */
	function contactHref(href: string, topicValue: string): string {
		return href === '#contact' || href === '/about#contact'
			? `?topic=${topicValue}#contact`
			: href;
	}
	const studentsHref = $derived(contactHref(join.studentsCta.href, 'joining'));
	const partnersHref = $derived(contactHref(join.partnersCta.href, 'sponsorship'));

	const TILTS = [-2.5, 1.5, -1, 2, -2, 1];

	const seoDescription = $derived(
		[
			hero.headline,
			hero.subline,
			s.achievements.data.heading && `${s.achievements.data.heading}, how to join and how to reach us.`
		]
			.filter(Boolean)
			.join(' ')
	);

	const linkClass =
		'text-[15px] leading-[23px] font-medium text-brand-text no-underline transition-colors duration-150 hover:text-ink';
</script>

<Seo
	title="About"
	description={seoDescription}
	image={hero.image.url || null}
	imageAlt={hero.image.alt}
/>

<!-- Hero -->
<HeroBand circle={{ cx: 1180, cy: 360, r: 300 }} height={700} labelledby="about-title">
	<div class="site-container flex flex-wrap items-center gap-x-14 gap-y-10 pt-16 pb-7">
		<div class="flex min-w-0 flex-[1_1_420px] flex-col gap-[22px]">
			<HeroEyebrow label={hero.label} sublabel={hero.sublabel} />
			<h1
				id="about-title"
				class="font-display text-[clamp(52px,6.4vw,92px)] leading-[0.92] font-semibold tracking-[-0.04em] text-balance"
			>
				{hero.headline}
			</h1>
			{#if hero.subline}
				<p class="m-0 text-[19px] leading-[30px] text-ink-muted">{hero.subline}</p>
			{/if}
		</div>
		<Figure
			class="flex-[1_1_460px]"
			src={hero.image.url || null}
			alt={hero.image.alt}
			label={hero.imageLabel || 'Photo · the team'}
			aspect="16 / 10"
			caption={hero.caption}
			eager
			note={hero.note ? heroNote : undefined}
		/>
	</div>
	{#snippet titleBlock()}
		<TitleBlock dwg="ABOUT" sheet="07" />
	{/snippet}
</HeroBand>

{#snippet heroNote()}
	<Note text={hero.note} arrow="right" rot={-6} class="hidden sm:inline-flex" />
{/snippet}

<!-- 01 What we do -->
{#if pillars.length > 0}
	<section class="site-container py-16 md:py-[88px]">
		<ul
			class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-px overflow-hidden rounded-lg border border-line bg-line p-0"
		>
			{#each pillars as pillar, i (i)}
				<li class="flex flex-col gap-3.5 bg-surface-100 p-6 sm:p-8">
					<PillarIcon index={i} />
					<span class="text-label text-brand-text">{pad2(i + 1)}</span>
					<h2 class="font-display text-[26px] leading-[30px] font-semibold">{pillar.title}</h2>
					{#if pillar.text}
						<p class="m-0 text-[15px] leading-[23px] text-ink-muted">{pillar.text}</p>
					{/if}
					{#if pillar.href && pillar.linkLabel}
						{@const external = isExternal(pillar.href)}
						<a
							href={pillar.href}
							class={linkClass}
							target={external ? '_blank' : undefined}
							rel={external ? 'noopener noreferrer' : undefined}
							>{pillar.linkLabel}{#if external}<span class="sr-only"> (opens in a new tab)</span
								>{/if}</a
						>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- 02 Achievements -->
{#if showAchievements}
	<section
		id="achievements"
		aria-labelledby="achievements-title"
		class="scroll-mt-16 bg-surface-000 py-16 md:scroll-mt-[72px] md:py-24"
	>
		<div class="site-container flex flex-col gap-10">
			<SectionHeader
				id="achievements-title"
				no={numbers.achievements}
				label={s.achievements.data.eyebrow}
				title={s.achievements.data.heading}
			>
				{#snippet aside()}
					{#if yearRange}
						<Note text={yearRange} arrow="down-left" rot={-4} class="hidden sm:inline-flex" />
					{/if}
				{/snippet}
			</SectionHeader>
			<AchievementsTimeline entries={data.achievements} />
		</div>
	</section>
{/if}

<!-- 03 From the archive -->
{#if showArchive}
	<section
		aria-labelledby="archive-title"
		class="site-container flex flex-col gap-12 pt-16 pb-20 md:pt-24 md:pb-[104px]"
	>
		<SectionHeader
			id="archive-title"
			no={numbers.archive}
			label={s.archive.data.eyebrow}
			title={s.archive.data.heading}
		/>
		<ul
			class="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-8 p-0 pt-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-x-8 sm:gap-y-10"
		>
			{#each data.archive as photo, i (photo.id)}
				<li>
					<figure
						class="relative m-0 bg-ink px-2 pt-2 shadow-[0_1px_0_var(--eic-line)] sm:px-2.5 sm:pt-2.5"
						style:transform="rotate({TILTS[i % TILTS.length]}deg)"
					>
						<span
							aria-hidden="true"
							class="absolute -top-2.5 left-1/2 h-[22px] w-16 -translate-x-1/2 -rotate-3 bg-brand/80 sm:w-[84px]"
						></span>
						<ImageSlot
							src={photo.imageUrl || null}
							alt={photo.alt}
							label={photo.caption ? `Photo · ${photo.caption}` : 'Photo'}
							aspect="4 / 3"
							sizes="(min-width: 1264px) 260px, (min-width: 640px) 25vw, 50vw"
						/>
						<figcaption
							class="min-h-[44px] px-1 pt-2.5 pb-3 font-hand text-xl leading-none font-semibold text-ink-on-light sm:min-h-[50px] sm:pt-3 sm:pb-3.5 sm:text-2xl"
						>
							{photo.caption ?? ''}
						</figcaption>
					</figure>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- 04 Join EIC, and the sponsors -->
{#if s.join.enabled}
	<section
		id="join"
		aria-labelledby="join-title"
		class="scroll-mt-16 bg-surface-000 py-16 md:scroll-mt-[72px] md:py-24"
	>
		<div class="site-container flex flex-col gap-10">
			<SectionHeader id="join-title" no={numbers.join} label={join.eyebrow} title={join.heading} />
			<div class="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-6">
				<!-- Students: the red card -->
				<div
					class="relative flex min-h-[300px] flex-col gap-[18px] overflow-hidden rounded-lg bg-brand p-7 text-on-brand sm:p-10"
				>
					<svg
						aria-hidden="true"
						focusable="false"
						viewBox="0 0 300 300"
						class="pointer-events-none absolute -right-[60px] -bottom-[60px] size-[300px]"
					>
						<g fill="none" stroke="#ffffff">
							<circle cx="300" cy="300" r="60" stroke-opacity="0.5" />
							<circle cx="300" cy="300" r="120" stroke-opacity="0.38" />
							<circle cx="300" cy="300" r="180" stroke-opacity="0.28" stroke-dasharray="2 6" />
							<circle cx="300" cy="300" r="240" stroke-opacity="0.2" />
						</g>
					</svg>
					<span class="relative text-label">{join.studentsLabel}</span>
					<h3
						class="relative m-0 font-display text-[32px] leading-[36px] font-semibold tracking-[-0.02em] sm:text-4xl sm:leading-[38px]"
					>
						{join.studentsHeading}
					</h3>
					{#if join.studentsText}
						<p class="relative m-0 max-w-[22em] text-base leading-[26px]">{join.studentsText}</p>
					{/if}
					{#if join.studentsCta.label && studentsHref}
						<ButtonLink
							href={studentsHref}
							variant="on-brand"
							class="relative mt-auto self-start">{join.studentsCta.label}</ButtonLink
						>
					{/if}
				</div>

				<!-- Partners -->
				<div
					id="partner"
					class="relative flex min-h-[300px] scroll-mt-16 flex-col gap-[18px] overflow-hidden rounded-lg border border-line bg-surface-200 p-7 sm:p-10 md:scroll-mt-[72px]"
				>
					<GearDrawing
						class="absolute -right-14 -bottom-14 w-[220px] opacity-40 sm:-right-[70px] sm:-bottom-20 sm:w-80 sm:opacity-55"
					/>
					<span class="relative text-label text-ink-muted">{join.partnersLabel}</span>
					<h3
						class="relative m-0 font-display text-[32px] leading-[36px] font-semibold tracking-[-0.02em] sm:text-4xl sm:leading-[38px]"
					>
						{join.partnersHeading}
					</h3>
					{#if join.partnersText}
						<p class="relative m-0 max-w-[22em] text-base leading-[26px] text-ink-muted">
							{join.partnersText}
						</p>
					{/if}
					{#if join.partnersCta.label && partnersHref}
						<ButtonLink
							href={partnersHref}
							variant="outline"
							class="relative mt-auto self-start bg-surface-200/80">{join.partnersCta.label}</ButtonLink
						>
					{/if}
				</div>
			</div>

			{#if showSponsors}
				<div class="flex flex-col gap-4">
					<h3 class="text-label text-ink-muted">{s.sponsors.data.heading}</h3>
					<ul
						class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(160px,100%),1fr))] gap-3 p-0"
					>
						{#each data.sponsors as sponsor (sponsor.id)}
							<li class="h-[88px]">
								{#if sponsor.url}
									{@const external = isExternal(sponsor.url)}
									<a
										href={sponsor.url}
										target={external ? '_blank' : undefined}
										rel={external ? 'noopener noreferrer' : undefined}
										class="flex size-full items-center justify-center rounded-sm border border-line px-4 py-3 text-ink-muted no-underline transition-colors duration-150 hover:border-line-strong hover:text-ink"
									>
										{@render sponsorMark(sponsor)}
										{#if external}<span class="sr-only"> (opens in a new tab)</span>{/if}
									</a>
								{:else}
									<div
										class="flex size-full items-center justify-center rounded-sm border border-line px-4 py-3 text-ink-muted"
									>
										{@render sponsorMark(sponsor)}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</section>
{/if}

{#snippet sponsorMark(sponsor: { name: string; logoUrl: string | null })}
	{#if sponsor.logoUrl}
		<img
			src={sponsor.logoUrl}
			alt={sponsor.name}
			loading="lazy"
			decoding="async"
			class="block max-h-12 max-w-full object-contain"
		/>
	{:else}
		<span class="text-label text-center">{sponsor.name}</span>
	{/if}
{/snippet}

<!-- 05 Contact -->
{#if s.contact.enabled}
	<section
		id="contact"
		aria-labelledby="contact-title"
		class="site-container flex scroll-mt-16 flex-wrap gap-14 py-16 md:scroll-mt-[72px] md:py-24"
	>
		<div class="flex max-w-[460px] min-w-0 flex-[1_1_340px] flex-col gap-6">
			<SectionLabel no={numbers.contact} label={contact.eyebrow} />
			<h2
				id="contact-title"
				class="font-display text-[clamp(40px,4.4vw,56px)] leading-none font-semibold tracking-[-0.025em] text-balance"
			>
				{contact.heading}
			</h2>
			<figure
				class="m-0 flex flex-col gap-2.5 rounded-lg border border-line px-5 pt-5 pb-3.5 crop-marks"
			>
				<img
					src={building}
					alt="Line drawing of Engineering Building 1, Chulalongkorn University"
					width="1400"
					height="846"
					loading="lazy"
					decoding="async"
					class="block h-auto w-full opacity-80"
				/>
				{#if contact.address}
					<figcaption class="text-label text-ink-muted">{contact.address}</figcaption>
				{/if}
			</figure>
			{#if contact.personName || contact.personEmail}
				<dl class="m-0 flex flex-col gap-4">
					{#if contact.personName}
						<div class="flex flex-col gap-1">
							<dt class="text-label text-ink-muted">Contact person</dt>
							<dd class="m-0 text-base leading-6 font-semibold">{contact.personName}</dd>
						</div>
					{/if}
					{#if contact.personEmail}
						<div class="flex flex-col gap-1">
							<dt class="text-label text-ink-muted">Email</dt>
							<dd class="m-0">
								<a
									href="mailto:{contact.personEmail}"
									class="text-base leading-6 break-all text-brand-text transition-colors duration-150 hover:text-ink"
									>{contact.personEmail}</a
								>
							</dd>
						</div>
					{/if}
				</dl>
			{/if}
		</div>
		{#if contact.formEnabled}
			<ContactForm
				result={form}
				token={data.token}
				{topic}
				fallbackEmail={contact.personEmail || undefined}
			/>
		{/if}
	</section>
{/if}
