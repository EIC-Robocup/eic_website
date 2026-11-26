<script lang="ts">
	import ButtonLink from '#lib/components/site/ButtonLink.svelte';
	import FilterPills from '#lib/components/site/FilterPills.svelte';
	import Figure from '#lib/components/site/Figure.svelte';
	import HeroBand from '#lib/components/site/HeroBand.svelte';
	import HeroEyebrow from '#lib/components/site/HeroEyebrow.svelte';
	import Note from '#lib/components/site/Note.svelte';
	import PersonCard from '#lib/components/site/PersonCard.svelte';
	import SecNo from '#lib/components/site/SecNo.svelte';
	import Seo from '#lib/components/site/Seo.svelte';
	import TitleBlock from '#lib/components/site/TitleBlock.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const hero = $derived(data.sections.hero.data);
	const alumniBand = $derived(data.sections.alumni);

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	const stats = $derived(
		[
			{ value: data.totals.people, label: data.totals.people === 1 ? 'person' : 'people' },
			{ value: data.totals.teams, label: data.totals.teams === 1 ? 'team' : 'teams' },
			{ value: data.totals.advisors, label: data.totals.advisors === 1 ? 'advisor' : 'advisors' }
		].filter((s) => s.value > 0)
	);

	let team = $state('all');

	const options = $derived([
		{ value: 'all', label: 'Everyone' },
		...data.groups.map((g) => ({ value: g.id, label: g.name }))
	]);

	const shown = $derived(team === 'all' ? data.groups : data.groups.filter((g) => g.id === team));
	const shownCount = $derived(shown.reduce((n, g) => n + g.people.length, 0));

	const seoDescription = $derived(
		[
			hero.headline.trim(),
			data.totals.people
				? `${plural(data.totals.people, 'person', 'people')} in ${plural(data.totals.teams, 'team', 'teams')}, with ${plural(data.totals.advisors, 'advisor', 'advisors')}, build Walkie at EIC Chula.`
				: ''
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<Seo
	title="People"
	description={seoDescription}
	image={hero.image.url || null}
	imageAlt={hero.image.alt}
/>

<HeroBand circle={{ cx: 1180, cy: 360, r: 300 }} height={700} labelledby="people-title">
	<div class="site-container flex flex-wrap items-center gap-x-14 gap-y-10 pt-10 pb-7 sm:pt-16">
		<div class="flex min-w-0 flex-[1_1_400px] flex-col gap-6">
			<HeroEyebrow label={hero.label} sublabel={hero.sublabel} />
			<h1
				id="people-title"
				class="m-0 font-display text-[clamp(56px,7vw,104px)] leading-[0.9] font-semibold tracking-[-0.04em]"
			>
				{hero.headline}
			</h1>
			{#if stats.length}
				<dl class="m-0 flex flex-wrap gap-x-9 gap-y-6">
					{#each stats as stat (stat.label)}
						<div class="flex flex-col-reverse gap-1.5">
							<dt class="text-label text-ink-muted">{stat.label}</dt>
							<dd
								class="m-0 font-display text-[56px] leading-none font-medium tracking-[-0.03em]"
							>
								{stat.value}
							</dd>
						</div>
					{/each}
				</dl>
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
			<Note text={hero.note} arrow="right" rot={-6} />
		{/snippet}
	</div>
	{#snippet titleBlock()}
		<TitleBlock dwg="PEOPLE" sheet="04" />
	{/snippet}
</HeroBand>

<section
	aria-label="The team by group"
	class="site-container flex flex-col gap-14 pt-16 pb-16 md:pb-24"
>
	{#if data.groups.length}
		<FilterPills
			label="Filter by team"
			{options}
			bind:value={team}
			class="border-b border-line pb-6"
		/>
		<p class="sr-only" aria-live="polite">
			{team === 'all'
				? `Showing everyone, ${plural(shownCount, 'person', 'people')}`
				: `Showing ${shown[0]?.name ?? ''}, ${plural(shownCount, 'person', 'people')}`}
		</p>

		{#each shown as group (group.id)}
			<section aria-labelledby="group-{group.id}" class="flex flex-col gap-7">
				<div class="flex flex-wrap items-center gap-3">
					<SecNo no={group.no} />
					<h2
						id="group-{group.id}"
						class="m-0 font-display text-[28px] leading-[34px] font-semibold tracking-[-0.015em]"
					>
						{group.name}
					</h2>
					<span class="text-label text-ink-muted"
						>{plural(group.people.length, 'person', 'people')}</span
					>
				</div>
				<ul
					class="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-8 p-0 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] sm:gap-x-6 sm:gap-y-9"
				>
					{#each group.people as person (person.id)}
						<li class="min-w-0">
							<PersonCard {person} />
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{:else}
		<p class="m-0 text-ink-muted">The team list is on its way. Check back soon.</p>
	{/if}
</section>

{#if alumniBand.enabled}
	<section aria-labelledby="alumni-title" class="bg-surface-000 py-16 md:py-20">
		<div class="site-container flex flex-wrap items-center justify-between gap-8">
			<div class="flex min-w-0 flex-[1_1_520px] flex-col gap-3">
				<p class="text-label m-0 text-brand-text">{alumniBand.data.eyebrow}</p>
				<h2
					id="alumni-title"
					class="m-0 font-display text-[clamp(30px,3.4vw,36px)] leading-[1.1] font-semibold tracking-[-0.02em] text-balance"
				>
					{alumniBand.data.heading}
				</h2>
			</div>
			{#if alumniBand.data.cta.label && alumniBand.data.cta.href}
				<ButtonLink href={alumniBand.data.cta.href} variant="outline">
					{alumniBand.data.cta.label}
				</ButtonLink>
			{/if}
			{#if data.alumni.length}
				<ul
					aria-label="Alumni"
					class="m-0 grid w-full list-none grid-cols-2 gap-x-4 gap-y-8 p-0 pt-4 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] sm:gap-x-6"
				>
					{#each data.alumni as person (person.id)}
						<li class="min-w-0">
							<PersonCard {person} size="sm" />
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>
{/if}
