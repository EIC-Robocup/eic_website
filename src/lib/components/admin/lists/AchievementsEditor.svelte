<!--
	The achievements list: year, place ("6th"), how many teams took part, the competition, the
	short label on the About timeline and where it was. Saved newest first (rows of the same
	year keep their order, which the arrows set).

	<AchievementsEditor server={data.lists.achievements} shown={data.shown.achievements} bind:dirty />
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { Input } from '#lib/components/ui/input/index.js';
	import ListEditor from '../ListEditor.svelte';
	import { inputClass, monoInputClass } from '../styles.ts';
	import ListForm from './ListForm.svelte';
	import SectionNotice from './SectionNotice.svelte';
	import { LIST_MAX, emptyRow, type AchievementRow, type Errors } from './rows.ts';

	type Props = { server: AchievementRow[]; shown: boolean | null; dirty?: boolean };
	let { server, shown, dirty = $bindable(false) }: Props = $props();

	let rows = $state(untrack(() => $state.snapshot(server)));
	let editor: ListEditor<AchievementRow> | undefined = $state();

	const LABELS: Record<string, string> = {
		year: 'Year',
		placement: 'Place',
		entrants: 'Teams',
		competition: 'Competition',
		shortName: 'Timeline label',
		location: 'Where'
	};

	function rowErrors(errors: Errors, index: number): string[] {
		const prefix = `achievements.${index}.`;
		return Object.entries(errors)
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, message]) => `${LABELS[key.slice(prefix.length)] ?? 'Row'}: ${message}`);
	}

	const span = {
		year: 'col-span-2 @xl:col-span-1',
		placement: 'col-span-2 @xl:col-span-1',
		entrants: 'col-span-2 @xl:col-span-1',
		competition: 'col-span-6 @xl:col-span-1',
		shortName: 'col-span-3 @4xl:col-span-1',
		location: 'col-span-3 @xl:col-span-1'
	};
</script>

<ListForm
	list="achievements"
	id="achievements"
	bind:rows
	bind:dirty
	{server}
	title="Achievements"
	description="On the About timeline, oldest on the left. Saved newest first; the arrows order entries within the same year."
	noun={['achievement', 'achievements']}
	addLabel="+ Add achievement"
	onadd={() => editor?.add()}
>
	{#snippet notice()}<SectionNotice {shown} page="about" pageTitle="About" />{/snippet}
	{#snippet children(errors)}
		<div class="@container">
			<ListEditor
				bind:this={editor}
				bind:items={rows}
				create={() => emptyRow('achievements')}
				itemLabel="achievement"
				addPosition="none"
				max={LIST_MAX.achievements}
				rowClass="grid min-w-0 flex-1 grid-cols-6 gap-2 @max-4xl:border-t @max-4xl:border-line @max-4xl:pt-3 @xl:grid-cols-[76px_72px_64px_minmax(0,1fr)] @4xl:grid-cols-[76px_72px_64px_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)]"
			>
				{#snippet header()}
					<span class="hidden @4xl:block">Year</span>
					<span class="hidden @4xl:block">Place</span>
					<span class="hidden @4xl:block">Teams</span>
					<span class="hidden @4xl:block">Competition</span>
					<span class="hidden @4xl:block">Timeline label</span>
					<span class="hidden @4xl:block">Where</span>
				{/snippet}
				{#snippet row(item, i)}
					{@const problems = rowErrors(errors, i)}
					{@const describedBy = problems.length ? `achievement-${i}-errors` : undefined}
					{@const invalid = (key: string) => (errors[`achievements.${i}.${key}`] ? 'true' : undefined)}
					<Input
						bind:value={item.year}
						aria-label="Year of achievement {i + 1}"
						aria-invalid={invalid('year')}
						aria-describedby={describedBy}
						placeholder="Year"
						inputmode="numeric"
						maxlength={4}
						autocomplete="off"
						class="{monoInputClass} {span.year}"
					/>
					<Input
						bind:value={item.placement}
						aria-label="Place in achievement {i + 1}"
						aria-invalid={invalid('placement')}
						aria-describedby={describedBy}
						placeholder="6th"
						maxlength={40}
						autocomplete="off"
						class="{inputClass} font-display font-semibold {span.placement}"
					/>
					<Input
						bind:value={item.entrants}
						aria-label="Teams taking part in achievement {i + 1}"
						aria-invalid={invalid('entrants')}
						aria-describedby={describedBy}
						placeholder="Teams"
						title="How many teams took part, for 6th of 24"
						inputmode="numeric"
						maxlength={5}
						autocomplete="off"
						class="{monoInputClass} {span.entrants}"
					/>
					<Input
						bind:value={item.competition}
						aria-label="Competition of achievement {i + 1}"
						aria-invalid={invalid('competition')}
						aria-describedby={describedBy}
						placeholder="RoboCup@Home Open League"
						maxlength={200}
						class="{inputClass} {span.competition}"
					/>
					<Input
						bind:value={item.shortName}
						aria-label="Timeline label of achievement {i + 1}"
						aria-invalid={invalid('shortName')}
						aria-describedby={describedBy}
						placeholder="Timeline label, e.g. @Home"
						maxlength={40}
						class="{inputClass} {span.shortName}"
					/>
					<Input
						bind:value={item.location}
						aria-label="Where achievement {i + 1} took place"
						aria-invalid={invalid('location')}
						aria-describedby={describedBy}
						placeholder="City, country"
						maxlength={120}
						class="{inputClass} {span.location}"
					/>
					{#if problems.length}
						<p id={describedBy} class="col-span-full m-0 text-xs leading-[18px] text-brand-text">
							{problems.join(' ')}
						</p>
					{/if}
				{/snippet}
				{#snippet empty()}
					<p class="m-0 rounded-sm border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink-muted">
						No achievements yet. Add the first result to start the timeline.
					</p>
				{/snippet}
			</ListEditor>
		</div>
	{/snippet}
</ListForm>
