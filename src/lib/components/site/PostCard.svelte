<!--
	Post card. The whole card is the link.
	- grid: Blog grid card (16:10 cover, red category, title, "author · date").
	- row: the horizontal "Read more" card of the Project page (cover on the left).
	- featured: the big card at the top of the Blog page (cover left, text right).
-->
<script lang="ts" module>
	export type PostCardData = {
		slug: string;
		title: string;
		excerpt?: string | null;
		category: string;
		authorName?: string | null;
		publishedAt: Date | string | null;
		coverUrl?: string | null;
		coverAlt?: string | null;
		readingMinutes?: number | null;
	};
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js';
	import ImageSlot from './ImageSlot.svelte';
	import { categoryLabel, formatDate, isoDate, readingTime } from './format.ts';
	import { postMorphKey } from '#lib/motion/view-transitions.ts';

	type Props = {
		post: PostCardData;
		variant?: 'grid' | 'row' | 'featured';
		headingLevel?: 2 | 3 | 4;
		/** Show the author in the meta line (grid and featured). Default true. */
		showAuthor?: boolean;
		/** Show the excerpt under the title (featured only by default). */
		showExcerpt?: boolean;
		eager?: boolean;
		class?: string;
	};

	let {
		post,
		variant = 'grid',
		headingLevel = 3,
		showAuthor = true,
		showExcerpt,
		eager = false,
		class: className
	}: Props = $props();

	const uid = $props.id();
	const href = $derived(`/blog/${post.slug}`);
	const date = $derived(formatDate(post.publishedAt));
	const datetime = $derived(isoDate(post.publishedAt));
	const author = $derived(showAuthor ? (post.authorName?.trim() ?? '') : '');
	const minutes = $derived(variant === 'featured' ? readingTime(post.readingMinutes) : '');
	const excerpt = $derived((showExcerpt ?? variant === 'featured') ? post.excerpt : null);
	const category = $derived(categoryLabel(post.category));
	const tag = $derived(`h${headingLevel}`);
	/**
	 * A cover photo morphs into the post page's cover. Without one, the card's placeholder and
	 * the post page's empty image slot (different shapes and labels) stay out of the transition.
	 */
	const morph = $derived(post.coverUrl ? postMorphKey(post.slug) : null);
	const coverClass = $derived(morph ? 'vt-target' : undefined);
	/** Grid cards: three across the 1200px column, two on tablets, one on phones. */
	const gridSizes =
		'(min-width: 1264px) 384px, (min-width: 1072px) 33vw, (min-width: 640px) 50vw, 100vw';
</script>

{#snippet metaLine(cls: string)}
	{#if author || date || minutes}
		<span class={cls}>
			{#if author}{author}{/if}{#if author && date}{' · '}{/if}{#if date}<time {datetime}
					>{date}</time
				>{/if}{#if minutes && (author || date)}{' · '}{/if}{minutes}
		</span>
	{/if}
{/snippet}

{#if variant === 'row'}
	<a
		{href}
		aria-labelledby="{uid}-title"
		data-vt-key={morph}
		class={cn(
			'flex flex-row overflow-hidden rounded-lg border border-line bg-surface-200 text-ink no-underline transition-colors duration-150 hover:border-ink',
			className
		)}
	>
		<ImageSlot
			src={post.coverUrl}
			alt={post.coverAlt ?? ''}
			label="Cover"
			aspect={null}
			iconSize={26}
			{eager}
			sizes="(min-width: 1264px) 162px, (min-width: 768px) 20vw, 42vw"
			class={cn('min-h-[170px] w-[42%] shrink-0 border-r border-line', coverClass)}
		/>
		<div class="flex min-w-0 flex-col justify-center gap-2 p-6">
			<span class="text-label text-brand-text">{category}</span>
			<svelte:element
				this={tag}
				id="{uid}-title"
				class="font-display text-xl leading-[26px] font-semibold">{post.title}</svelte:element
			>
			{#if date}<time {datetime} class="text-[13px] leading-5 text-ink-muted">{date}</time>{/if}
		</div>
	</a>
{:else if variant === 'featured'}
	<a
		{href}
		aria-labelledby="{uid}-title"
		data-vt-key={morph}
		class={cn(
			'@container flex flex-row flex-wrap overflow-hidden rounded-lg border border-line bg-surface-200 text-ink no-underline transition-colors duration-150 hover:border-ink',
			className
		)}
	>
		<ImageSlot
			src={post.coverUrl}
			alt={post.coverAlt ?? ''}
			label="Cover photo · {post.title}"
			aspect="16 / 10"
			iconSize={36}
			{eager}
			sizes="(min-width: 1264px) 730px, (min-width: 1004px) 60vw, 100vw"
			class={cn('min-w-0 flex-[1_1_600px]', coverClass)}
		/>
		<div
			class="flex min-w-0 flex-[1_1_340px] flex-col justify-center gap-[18px] border-t border-line p-6 sm:p-10 @min-[940px]:border-t-0 @min-[940px]:border-l"
		>
			<div class="flex flex-wrap items-center gap-3">
				<span class="text-label rounded-xs bg-ink px-2 py-1 text-ink-on-light">Featured</span>
				<span class="text-label text-brand-text">{category}</span>
			</div>
			<svelte:element
				this={tag}
				id="{uid}-title"
				class="font-display text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-balance sm:text-4xl sm:leading-10"
				>{post.title}</svelte:element
			>
			{#if excerpt}<p class="m-0 text-base leading-[26px] text-ink-muted">{excerpt}</p>{/if}
			{@render metaLine('text-sm text-ink-muted')}
		</div>
	</a>
{:else}
	<a
		{href}
		aria-labelledby="{uid}-title"
		data-vt-key={morph}
		class={cn(
			'flex flex-col overflow-hidden rounded-lg border border-line bg-surface-200 text-ink no-underline transition-colors duration-150 hover:border-ink',
			className
		)}
	>
		<ImageSlot
			src={post.coverUrl}
			alt={post.coverAlt ?? ''}
			label="Cover photo"
			aspect="16 / 10"
			iconSize={28}
			{eager}
			sizes={gridSizes}
			class={coverClass}
		/>
		<div class="flex grow flex-col gap-2 border-t border-line px-6 pt-5 pb-6">
			<span class="text-label text-brand-text">{category}</span>
			<svelte:element
				this={tag}
				id="{uid}-title"
				class="grow font-display text-[22px] leading-7 font-semibold tracking-[-0.01em]"
				>{post.title}</svelte:element
			>
			{#if excerpt}<p class="m-0 text-sm text-ink-muted">{excerpt}</p>{/if}
			{@render metaLine('text-[13px] leading-5 text-ink-muted')}
		</div>
	</a>
{/if}
