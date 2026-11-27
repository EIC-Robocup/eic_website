<!--
	"On this page": links to the post's h2 and h3 headings. The heading being read is
	marked with aria-current="location" (and an ink tick) once the page is interactive.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';

	type Heading = { id: string; text: string; depth: number };
	type Props = {
		headings: Heading[];
		/** id of the "On this page" heading. */
		id: string;
		/** Show the heading (off when a <summary> already names the list). */
		titled?: boolean;
		class?: string;
	};
	let { headings, id, titled = true, class: className }: Props = $props();

	let active = $state<string | null>(null);

	$effect(() => {
		const els = headings
			.map((h) => document.getElementById(h.id))
			.filter((el): el is HTMLElement => el !== null);
		if (!els.length) return;

		// The active heading is the last one that has scrolled past the top fifth of the window.
		let frame = 0;
		const update = () => {
			frame = 0;
			const line = window.innerHeight * 0.2;
			let current: string | null = null;
			for (const el of els) {
				if (el.getBoundingClientRect().top <= line) current = el.id;
				else break;
			}
			active = current;
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		return () => {
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
			if (frame) cancelAnimationFrame(frame);
		};
	});
</script>

<nav
	aria-labelledby={titled ? id : undefined}
	aria-label={titled ? undefined : 'On this page'}
	class={cn('flex flex-col gap-4', className)}
>
	{#if titled}<h2 {id} class="text-label m-0 text-ink-muted">On this page</h2>{/if}
	<ol class="m-0 flex list-none flex-col border-l border-line p-0">
		{#each headings as heading (heading.id)}
			{@const current = active === heading.id}
			<li>
				<a
					href="#{heading.id}"
					aria-current={current ? 'location' : undefined}
					class={[
						// 44px on phones (the inline list is xl:hidden), 36px in the desktop sidebar.
						'-ml-px flex min-h-11 items-center border-l py-1.5 text-sm leading-5 no-underline transition-colors duration-150 xl:min-h-9',
						heading.depth > 2 ? 'pl-7' : 'pl-4',
						current
							? 'border-ink text-ink'
							: 'border-transparent text-ink-muted hover:text-ink'
					]}>{heading.text}</a
				>
			</li>
		{/each}
	</ol>
</nav>
