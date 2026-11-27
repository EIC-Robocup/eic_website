<!--
	A rendered blog post: the sanitised HTML from renderPost() (src/lib/server/markdown.ts) in
	a <div> with the EIC prose styling (post.css), plus the client enhancements from
	post-enhance.ts. They run after mount and again whenever `html` changes (the admin preview
	re-renders it), and load code only for what the post uses: copy buttons, a lightbox for
	images, lite YouTube/Vimeo players, Mermaid diagrams, 3D models and heading links.

	<PostBody html={data.html} />

	The KaTeX stylesheet is added to <head> only when the post has math.
-->
<script lang="ts">
	import katexStylesheet from 'katex/dist/katex.min.css?url';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import XIcon from '@lucide/svelte/icons/x';
	import { cn } from '#lib/utils.js';
	import { enhancePost, type LightboxItem } from './post-enhance.ts';
	import './post.css';

	type Props = {
		/** Sanitised post HTML from renderPost() or POST /admin/api/preview. */
		html: string;
		class?: string;
	};

	let { html, class: className }: Props = $props();

	const hasMath = $derived(html.includes('class="katex'));

	let content: HTMLElement | undefined = $state();

	type DialogModule = typeof import('#lib/components/ui/dialog/index.js');
	type ButtonModule = typeof import('#lib/components/ui/button/index.js');

	let Dialog: DialogModule | null = $state(null);
	let Btn: ButtonModule['Button'] | null = $state(null);
	let loading: Promise<void> | null = null;

	let items: LightboxItem[] = $state([]);
	let index = $state(0);
	let open = $state(false);
	const current = $derived(items[index] as LightboxItem | undefined);

	function loadLightbox(): Promise<void> {
		loading ??= Promise.all([import('#lib/components/ui/dialog/index.js'), import('#lib/components/ui/button/index.js')]).then(
			([dialog, button]) => {
				Dialog = dialog;
				Btn = button.Button;
			}
		);
		return loading;
	}

	function show(list: LightboxItem[], at: number) {
		items = list;
		index = at;
		void loadLightbox().then(() => (open = true));
	}

	function step(by: number) {
		if (items.length < 2) return;
		index = (index + by + items.length) % items.length;
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			step(1);
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			step(-1);
		}
	}

	$effect(() => {
		// Re-run for every new HTML (the {#key} block below makes a fresh element for it).
		void html;
		const root = content;
		if (!root) return;
		return enhancePost(root, { openLightbox: show, preloadLightbox: () => void loadLightbox() });
	});
</script>

<svelte:head>
	{#if hasMath}
		<link rel="stylesheet" href={katexStylesheet} />
	{/if}
</svelte:head>

<!-- A <div>: the post page's own <article> holds the header, cover and this body. -->
<div class={cn('post-body', className)}>
	{#key html}
		<div class="post-content" bind:this={content}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised by renderPost on the server -->
			{@html html}
		</div>
	{/key}
</div>

{#if Dialog && Btn && current}
	<Dialog.Root bind:open>
		<Dialog.Content
			showCloseButton={false}
			class="eic-lightbox flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[min(1400px,calc(100vw-1rem))] flex-col gap-0 overflow-hidden rounded-lg border border-line bg-surface-000 p-0 ring-0 sm:max-w-[min(1400px,calc(100vw-2rem))]"
			{onkeydown}
		>
			<div class="relative flex min-h-0 flex-1 items-center justify-center bg-surface-000 p-2 sm:p-4">
				{#key current.src}
					<img
						src={current.src}
						alt={current.alt}
						width={current.width}
						height={current.height}
						class="block h-auto max-h-[calc(100dvh-9rem)] w-auto max-w-full object-contain"
					/>
				{/key}
			</div>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface-100 px-4 py-3">
				<div class="flex min-w-0 flex-[1_1_240px] items-baseline gap-3">
					{#if current.label}
						<span class="text-label shrink-0 text-brand-text">{current.label}</span>
					{/if}
					<Dialog.Title class="min-w-0 text-sm leading-[22px] font-normal text-ink-muted">
						{current.caption || current.alt || 'Image'}
					</Dialog.Title>
				</div>
				<Dialog.Description class="sr-only">
					{items.length > 1
						? `Image ${index + 1} of ${items.length}. Use the left and right arrow keys to move between images.`
						: 'Press Escape to close.'}
				</Dialog.Description>
				<div class="ml-auto flex items-center gap-1">
					{#if items.length > 1}
						<span class="text-spec mr-2 text-ink-muted tabular-nums" aria-hidden="true">
							{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
						</span>
						<Btn variant="outline" size="icon" class="size-11 sm:size-9" aria-label="Previous image" onclick={() => step(-1)}>
							<ChevronLeftIcon aria-hidden="true" />
						</Btn>
						<Btn variant="outline" size="icon" class="size-11 sm:size-9" aria-label="Next image" onclick={() => step(1)}>
							<ChevronRightIcon aria-hidden="true" />
						</Btn>
					{/if}
					<Dialog.Close>
						{#snippet child({ props })}
							<Btn {...props} variant="ghost" size="icon" class="size-11 sm:size-9" aria-label="Close">
								<XIcon aria-hidden="true" />
							</Btn>
						{/snippet}
					</Dialog.Close>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}
