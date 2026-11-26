<!--
	A slim red bar along the top of the window that fills as the article is read.
	Decorative (the scrollbar already tells the same story), so hidden from assistive tech.
-->
<script lang="ts">
	type Props = { target: HTMLElement | undefined };
	let { target }: Props = $props();

	let progress = $state(0);

	$effect(() => {
		const el = target;
		if (!el) return;
		let frame = 0;

		const measure = () => {
			frame = 0;
			const rect = el.getBoundingClientRect();
			const total = rect.height - window.innerHeight;
			const read = total > 0 ? -rect.top / total : rect.top <= 0 ? 1 : 0;
			progress = Math.min(1, Math.max(0, read));
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};

		measure();
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		const observer = new ResizeObserver(schedule);
		observer.observe(el);
		return () => {
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
			observer.disconnect();
			if (frame) cancelAnimationFrame(frame);
		};
	});
</script>

<div aria-hidden="true" class="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
	<div class="h-full origin-left bg-brand" style:transform="scaleX({progress})"></div>
</div>
