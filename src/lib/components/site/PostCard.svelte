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
			class="min-h-[170px] w-[42%] shrink-0 border-r border-line"
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
			class="min-w-0 flex-[1_1_600px]"
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
