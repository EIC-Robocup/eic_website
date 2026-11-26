<!--
	The achievements timeline. From 1024px up: the designed horizontal timeline (years on an
	axis with ticks, placement badges on stems of alternating height), hidden from assistive
	technology. The ordered list below carries the same facts: it is the visible vertical
	timeline on phones and tablets, and visually hidden (but read out) on wide screens.
-->
<script lang="ts" module>
	export type TimelineEntry = {
		id: string;
		year: number;
		placement: string;
		competition: string;
		shortName: string | null;
		location: string | null;
	};
</script>

<script lang="ts">
	import { splitPlacement } from '#lib/content/labels.ts';

	type Props = {
		entries: TimelineEntry[];
		/** The axis starts here, or earlier if there are older entries. */
		since?: number;
	};

	let { entries, since = 2006 }: Props = $props();

	type Item = TimelineEntry & {
		number: string;
		suffix: string;
		numeric: boolean;
		first: boolean;
		/** Short label on the wide timeline, e.g. "@Home". */
		what: string;
		/** City only, e.g. "Bordeaux" for "Bordeaux, France". */
		city: string;
	};
	type Year = { year: number; col: number; latest: boolean; items: Item[] };

	const years = $derived.by((): Year[] => {
		const sorted = [...entries].sort((a, b) => a.year - b.year);
		if (sorted.length === 0) return [];
		const start = Math.min(since, sorted[0].year);
		const end = sorted[sorted.length - 1].year;
		const groups = new Map<number, Item[]>();
		for (const e of sorted) {
			const p = splitPlacement(e.placement);
			const item: Item = {
				...e,
				number: p.number,
				suffix: p.suffix,
				numeric: p.numeric,
				first: p.numeric && p.number === '1',
				what: e.shortName?.trim() || e.competition,
				city: (e.location ?? '').split(',')[0].trim()
			};
			const list = groups.get(e.year);
			if (list) list.push(item);
			else groups.set(e.year, [item]);
		}
		return [...groups].map(([year, items]) => ({
			year,
			col: year - start + 1,
			latest: year === end,
			items
		}));
	});

	const start = $derived(years.length ? years[0].year - years[0].col + 1 : since);
	const columns = $derived(years.length ? years[years.length - 1].col : 0);
	const ticks = $derived.by(() => {
		const on = new Set(years.map((y) => y.year));
		return Array.from({ length: columns }, (_, i) => {
			const year = start + i;
			return { year, on: on.has(year), latest: i === columns - 1 };
		});
	});
	const gridColumns = $derived(`repeat(${columns}, minmax(0, 1fr))`);

	/** Badge colours: the latest year in ink, first places in brand red, the rest outlined. */
	function badgeTone(item: Item, latest: boolean): string {
		if (latest) return 'bg-ink text-ink-on-light';
		if (item.first) return 'bg-brand text-on-brand';
		return 'border border-ink bg-surface-000 text-ink';
	}
</script>

{#if years.length > 0}
	<!-- Wide timeline (decorative copy of the list below) -->
	<div aria-hidden="true" class="hidden overflow-x-auto pb-2 lg:block">
		<div class="relative" style:min-width="{columns * 45}px">
			<svg
				viewBox="0 0 1080 120"
				preserveAspectRatio="none"
				focusable="false"
				class="pointer-events-none absolute top-0 left-0 h-[120px] w-full"
			>
				<path
					d="M26 112 C220 -16 760 -24 1054 104"
					fill="none"
					stroke="var(--eic-line-strong)"
					stroke-dasharray="2 6"
					vector-effect="non-scaling-stroke"
				/>
			</svg>
			<div class="relative grid min-h-[280px] items-end" style:grid-template-columns={gridColumns}>
				{#each years as y (y.year)}
					<div
						class="row-start-1 flex flex-col items-center justify-end"
						style:grid-column={String(y.col)}
					>
						{#each y.items as item (item.id)}
							<div class="mb-2 flex flex-col items-center gap-1">
								<span
									class={[
										'flex h-11 shrink-0 items-center justify-center rounded-full font-display leading-none font-semibold',
										item.numeric ? 'w-11 text-[17px]' : 'min-w-11 px-3 text-[13px]',
										badgeTone(item, y.latest)
									]}
									>{item.number}{#if item.suffix}<span class="text-[10px] tracking-normal"
											>{item.suffix}</span
										>{/if}</span
								>
								<span
									class="text-center font-mono text-[9.5px] leading-3 tracking-[0.04em] text-ink uppercase"
									>{item.what}</span
								>
								{#if item.city}
									<span
										class="text-center font-mono text-[9px] leading-[11px] tracking-[0.04em] text-ink-muted uppercase"
										>{item.city}</span
									>
								{/if}
							</div>
						{/each}
						<span class="w-px bg-line-strong" style:height="{y.col % 2 === 0 ? 72 : 24}px"></span>
					</div>
				{/each}
			</div>
			<div class="grid border-t border-ink" style:grid-template-columns={gridColumns}>
				{#each ticks as t (t.year)}
					<div class="flex flex-col items-center gap-1.5">
						<span class={['w-px', t.on ? 'h-4 bg-ink' : 'h-2 bg-line-strong']}></span>
						<span
							class={[
								'min-h-3.5 font-mono text-[11px] leading-[14px]',
								t.latest ? 'text-brand-text' : 'text-ink'
							]}>{t.on ? t.year : ''}</span
						>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- The same facts as a list: a vertical timeline below 1024px, read out everywhere -->
	<ol
		class="relative flex flex-col before:absolute before:top-[22px] before:bottom-[22px] before:left-[4.25rem] before:w-px before:bg-line-strong lg:sr-only"
	>
		{#each years as y (y.year)}
			<li class="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 pb-7 last:pb-0">
				<span
					class={[
						'pt-3 font-mono text-[13px] leading-5',
						y.latest ? 'text-brand-text' : 'text-ink'
					]}>{y.year}<span class="sr-only">:</span></span
				>
				<ul class="flex min-w-0 flex-col gap-4 pl-6">
					{#each y.items as item (item.id)}
						<li class="relative flex min-w-0 items-start gap-3.5">
							<span aria-hidden="true" class="absolute top-[22px] -left-6 h-px w-6 bg-line-strong"
							></span>
							<span
								class={[
									'flex h-11 shrink-0 items-center justify-center rounded-full font-display leading-none font-semibold',
									item.numeric ? 'w-11 text-[17px]' : 'min-w-11 px-3 text-[13px]',
									badgeTone(item, y.latest)
								]}
								>{item.number}{#if item.suffix}<span class="text-[10px] tracking-normal"
										>{item.suffix}</span
									>{/if}</span
							>
							<span class="flex min-h-11 min-w-0 flex-col justify-center gap-0.5">
								<span class="sr-only">, </span>
								<span class="text-[15px] leading-[22px] font-medium text-ink">{item.competition}</span>
								{#if item.location}
									<span class="sr-only">, </span>
									<span class="text-label text-ink-muted">{item.location}</span>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ol>
{/if}
