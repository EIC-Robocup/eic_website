<!--
	The drawing title block in the corner of a hero band: CREATED BY · DWG · SHEET · REV.
	Decorative, so it is hidden from assistive technology.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';

	type Props = {
		/** Drawing name, e.g. "HOME", "WALKIE 4". */
		dwg: string;
		/** Sheet number, e.g. "01". */
		sheet: string;
		total?: string;
		createdBy?: string;
		rev?: string;
		class?: string;
	};

	let {
		dwg,
		sheet,
		total = '07',
		createdBy = 'EIC CHULA',
		rev = '2026',
		class: className
	}: Props = $props();
</script>

<div
	aria-hidden="true"
	class={cn(
		'inline-flex max-w-full flex-wrap border border-line-strong bg-surface-100 font-mono text-ink',
		className
	)}
>
	<div class="flex items-center gap-2.5 px-2.5 py-2 sm:px-3.5">
		<svg class="hidden shrink-0 sm:block" width="18" height="18" viewBox="0 0 22 22">
			<circle cx="11" cy="11" r="6.5" fill="none" stroke="var(--eic-brand)" stroke-width="2" />
			<path d="M11 0 V22 M0 11 H22" stroke="var(--eic-brand)" stroke-width="1.5" />
		</svg>
		<div class="flex flex-col gap-0.5">
			<span class="text-[9px] leading-[12px] tracking-[0.12em] text-ink-muted">CREATED BY</span>
			<span class="text-xs leading-4 tracking-[0.06em]">{createdBy}</span>
		</div>
	</div>
	<div
		class="flex flex-col gap-0.5 border-l border-line-strong px-2.5 py-2 sm:min-w-24 sm:px-3.5"
	>
		<span class="text-[9px] leading-[12px] tracking-[0.12em] text-ink-muted">DWG</span>
		<span class="text-xs leading-4 tracking-[0.06em]">{dwg}</span>
	</div>
	<div class="flex flex-col gap-0.5 border-l border-line-strong px-2.5 py-2 sm:px-3.5">
		<span class="text-[9px] leading-[12px] tracking-[0.12em] text-ink-muted">SHEET</span>
		<span class="text-xs leading-4 tracking-[0.06em]">{sheet} OF {total}</span>
	</div>
	<div class="flex flex-col gap-0.5 border-l border-line-strong px-2.5 py-2 sm:px-3.5">
		<span class="text-[9px] leading-[12px] tracking-[0.12em] text-ink-muted">REV</span>
		<span class="text-xs leading-4 tracking-[0.06em] text-brand-text">{rev}</span>
	</div>
</div>
