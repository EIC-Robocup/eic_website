<!-- The three small line icons of the About pillars: target (compete), protractor (research), branch (share). -->
<script lang="ts">
	let { index }: { index: number } = $props();
	const kind = $derived(((index % 3) + 3) % 3);
</script>

<svg
	width="64"
	height="64"
	viewBox="0 0 64 64"
	fill="none"
	stroke="var(--eic-ink)"
	stroke-width="1.6"
	stroke-linecap="round"
	aria-hidden="true"
	focusable="false"
	class="shrink-0"
>
	{#if kind === 0}
		<circle cx="32" cy="32" r="22" />
		<circle cx="32" cy="32" r="12" stroke="var(--eic-brand)" />
		<circle cx="32" cy="32" r="3" fill="var(--eic-brand)" stroke="none" />
		<path d="M32 2 V14 M32 50 V62 M2 32 H14 M50 32 H62" stroke-linecap="butt" />
	{:else if kind === 1}
		<path d="M4 50 A28 28 0 0 1 60 50 Z" />
		<path d="M14 50 A18 18 0 0 1 50 50" />
		<path d="M32 50 L50 26" stroke="var(--eic-brand)" />
		<path d="M44 50 A12 12 0 0 0 39 40" stroke="var(--eic-brand)" />
	{:else}
		<circle cx="16" cy="14" r="5" />
		<circle cx="16" cy="50" r="5" />
		<circle cx="48" cy="24" r="5" stroke="var(--eic-brand)" />
		<path d="M16 19 V45 M16 34 C16 26 30 24 43 24" stroke-linejoin="round" />
	{/if}
</svg>
