<!--
	The meshing gears line drawing from the drawing kit (Art, kind "gear"), as inline SVG.
	Decorative: it sits behind the partners card.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();

	const f = (n: number) => n.toFixed(1);

	/** Gear outline: n teeth between the root radius ri and the tip radius ro. */
	function gear(cx: number, cy: number, n: number, ro: number, ri: number, rot: number): string {
		const step = (2 * Math.PI) / n;
		const t = step / 2;
		const p = (r: number, a: number) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
		let d = `M${p(ri, rot - t * 0.5)}`;
		for (let i = 0; i < n; i++) {
			const a = rot + i * step;
			d +=
				` L${p(ro, a - t * 0.28)} A${ro} ${ro} 0 0 1 ${p(ro, a + t * 0.28)}` +
				` L${p(ri, a + t * 0.5)} A${ri} ${ri} 0 0 1 ${p(ri, a + step - t * 0.5)}`;
		}
		return `${d} Z`;
	}

	/** n round lightening holes of radius r on a circle of radius R. */
	function holes(cx: number, cy: number, R: number, n: number, r: number): string {
		let d = '';
		for (let i = 0; i < n; i++) {
			const a = (i * 2 * Math.PI) / n - Math.PI / 2;
			const x = cx + R * Math.cos(a);
			const y = cy + R * Math.sin(a);
			d += `M${f(x + r)} ${f(y)} a${r} ${r} 0 1 0 ${-2 * r} 0 a${r} ${r} 0 1 0 ${2 * r} 0 `;
		}
		return d;
	}

	const big = gear(200, 180, 16, 128, 110, 0);
	const small = gear(393, 180, 10, 82, 66, Math.PI / 10);
	const bigHoles = holes(200, 180, 74, 6, 15);
</script>

<div aria-hidden="true" class={cn('pointer-events-none relative aspect-[4/3] w-full', className)}>
	<svg
		viewBox="0 0 480 360"
		preserveAspectRatio="xMidYMid meet"
		class="absolute inset-0 size-full"
		focusable="false"
	>
		<path
			d="M40 180 H476 M200 36 V324 M393 84 V276"
			stroke="var(--eic-construction)"
			stroke-dasharray="14 4 2 4"
		/>
		<circle
			cx="200"
			cy="180"
			r="119"
			fill="none"
			stroke="var(--eic-ink)"
			stroke-opacity="0.18"
			stroke-dasharray="3 5"
		/>
		<path
			d={big}
			fill="#141414"
			stroke="var(--eic-ink)"
			stroke-opacity="0.9"
			stroke-width="1.5"
			stroke-linejoin="round"
		/>
		<path
			d={bigHoles}
			fill="var(--eic-surface-100)"
			stroke="var(--eic-ink)"
			stroke-opacity="0.7"
			stroke-width="1.25"
		/>
		<circle
			cx="200"
			cy="180"
			r="42"
			fill="none"
			stroke="var(--eic-ink)"
			stroke-opacity="0.7"
			stroke-width="1.25"
		/>
		<circle
			cx="200"
			cy="180"
			r="16"
			fill="var(--eic-surface-100)"
			stroke="var(--eic-ink)"
			stroke-width="1.5"
		/>
		<rect
			x="196"
			y="159"
			width="8"
			height="7"
			fill="var(--eic-surface-100)"
			stroke="var(--eic-ink)"
			stroke-width="1.25"
		/>
		<path
			d={small}
			fill="#141414"
			stroke="var(--eic-brand)"
			stroke-width="1.75"
			stroke-linejoin="round"
		/>
		<circle
			cx="393"
			cy="180"
			r="74"
			fill="none"
			stroke="var(--eic-brand)"
			stroke-opacity="0.35"
			stroke-dasharray="3 5"
		/>
		<circle cx="393" cy="180" r="22" fill="none" stroke="var(--eic-brand)" stroke-width="1.25" />
		<circle
			cx="393"
			cy="180"
			r="8"
			fill="var(--eic-surface-100)"
			stroke="var(--eic-brand)"
			stroke-width="1.5"
		/>
		<text
			x="24"
			y="36"
			class="font-mono"
			font-size="10"
			letter-spacing="1"
			fill="var(--eic-ink-muted)">Z16 · Z10</text
		>
	</svg>
</div>
