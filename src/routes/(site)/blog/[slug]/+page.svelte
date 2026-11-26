<script lang="ts">
	import { page } from '$app/state';
	import ImageSlot from '#lib/components/site/ImageSlot.svelte';
	import PostBody from '#lib/components/site/PostBody.svelte';
	import PostCard from '#lib/components/site/PostCard.svelte';
	import Seo from '#lib/components/site/Seo.svelte';
	import Tag from '#lib/components/site/Tag.svelte';
	import {
		categoryLabel,
		formatDate,
		initials,
		isoDate,
		readingTime
	} from '#lib/components/site/format.ts';
	import RssLink from '../RssLink.svelte';
	import ReadingProgress from './ReadingProgress.svelte';
	import ShareButtons from './ShareButtons.svelte';
	import TableOfContents from './TableOfContents.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const post = $derived(data.post);
	const author = $derived(post.authorName ?? 'EIC Chula');
	const url = $derived(page.url.origin + page.url.pathname);
	const showToc = $derived(data.headings.length >= 3);
	const minutes = $derived(readingTime(data.readingMinutes));

	let article = $state<HTMLElement>();

	/** Bylines like "AI Team" or "EIC Chula" are groups, not people. */
	const isGroup = (name: string) => /\b(team|club|eic|advisors|support|lab)\b/i.test(name);

	const jsonLd = $derived.by(() => {
		const origin = page.url.origin;
		const ld = {
			'@context': 'https://schema.org',
			'@type': 'BlogPosting',
			headline: post.title,
			description: post.excerpt ?? undefined,
			image: post.coverUrl ? [new URL(post.coverUrl, origin).href] : undefined,
			datePublished: isoDate(post.publishedAt),
			dateModified: isoDate(post.updatedAt) ?? isoDate(post.publishedAt),
			author: { '@type': isGroup(author) ? 'Organization' : 'Person', name: author },
			publisher: {
				'@type': 'Organization',
				name: 'EIC Chula',
				url: origin,
				logo: { '@type': 'ImageObject', url: `${origin}/apple-touch-icon.png` }
			},
			mainEntityOfPage: { '@type': 'WebPage', '@id': url },
			url,
			articleSection: categoryLabel(post.category),
			keywords: post.tags.length ? post.tags.join(', ') : undefined,
			wordCount: data.words || undefined,
			inLanguage: 'en'
		};
		// "<" is escaped so the JSON can never close the script element early.
		const json = JSON.stringify(ld).replace(/</g, '\\u003c');
		return `<script type="application/ld+json">${json}</` + `script>`;
	});
</script>

<Seo
	title={post.title}
	description={post.excerpt}
	image={post.coverUrl}
	imageAlt={post.coverAlt}
	type="article"
	publishedTime={isoDate(post.publishedAt)}
/>
<RssLink />
<svelte:head>
	{@html jsonLd}
</svelte:head>

<ReadingProgress target={article} />

<article bind:this={article} aria-labelledby="post-title">
	<header class="border-b border-line bg-graph-paper">
		<div class="site-container">
			<div class="mx-auto flex max-w-[720px] flex-col gap-[22px] pt-10 pb-10 sm:pt-14 sm:pb-12">
				<a
					href="/blog"
					class="-my-2 self-start py-2 text-sm text-ink-muted no-underline transition-colors duration-150 hover:text-ink"
					><span aria-hidden="true">←</span> All posts</a
				>
				<span class="text-label text-brand-text">{categoryLabel(post.category)}</span>
				<h1
					id="post-title"
					class="m-0 font-display text-[clamp(40px,5.4vw,64px)] leading-[0.98] font-semibold tracking-[-0.03em] text-balance"
				>
					{post.title}
				</h1>
				<div class="flex items-center gap-3.5 pt-1">
					<span
						aria-hidden="true"
						class="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-300 font-display text-[15px] font-semibold text-ink-muted"
						>{initials(author)}</span
					>
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="text-[15px] font-semibold">{author}</span>
						<span class="text-sm text-ink-muted">
							<time datetime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time
							>{#if minutes}{' · '}{minutes}{/if}
						</span>
					</span>
				</div>
			</div>
		</div>
	</header>

	{#if post.coverUrl}
		<div class="site-container pt-8 pb-10 sm:pt-12 sm:pb-14">
			<figure class="m-0 flex flex-col overflow-hidden rounded-lg border border-line">
				<ImageSlot
					src={post.coverUrl}
					alt={post.coverAlt}
					label="Cover photo"
					aspect="16 / 8"
					iconSize={36}
					sizes="(min-width: 1264px) 1200px, 100vw"
					eager
				/>
				<figcaption class="text-label border-t border-line px-5 py-3.5 text-ink-muted">
					Fig. 01{#if post.coverCaption}{' · '}{post.coverCaption}{/if}
				</figcaption>
			</figure>
		</div>
	{/if}

	<div
		class={[
			'site-container xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,720px)_minmax(0,1fr)] xl:gap-x-12',
			!post.coverUrl && 'pt-10 sm:pt-14'
		]}
	>
		<div class="mx-auto w-full max-w-[720px] min-w-0 xl:col-start-2">
			{#if showToc}
				<details
					class="group mb-10 rounded-lg border border-line bg-surface-200 xl:hidden [&_summary::-webkit-details-marker]:hidden"
				>
					<summary
						class="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5"
					>
						<span class="text-label text-ink-muted">On this page</span>
						<svg
							aria-hidden="true"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							class="text-ink-muted transition-transform duration-150 group-open:rotate-180"
							><path d="M6 9l6 6 6-6" /></svg
						>
					</summary>
					<TableOfContents
						headings={data.headings}
						id="toc-inline"
						titled={false}
						class="px-5 pb-4"
					/>
				</details>
			{/if}

			<!-- PostBody adds the KaTeX stylesheet itself when the post has math. -->
			<PostBody html={data.html} />

			<footer class="flex flex-col gap-7 pt-10 pb-16 md:pb-20">
				{#if post.tags.length}
					<ul aria-label="Tags" class="m-0 flex list-none flex-wrap gap-2 p-0">
						{#each post.tags as tag (tag)}
							<li>
								<Tag
									label={tag}
									href="/blog?tag={encodeURIComponent(tag)}"
									tone="raised"
									size="md"
								/>
							</li>
						{/each}
					</ul>
				{/if}
				<div
					class="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"
				>
					{#if post.project}
						<a
							href="/projects/{post.project.slug}"
							class="text-[15px] font-medium text-brand-text no-underline transition-colors duration-150 hover:text-ink"
							>Part of the {post.project.title} project <span aria-hidden="true">→</span></a
						>
					{/if}
					<div class={[!post.project && 'sm:ml-auto']}>
						<ShareButtons {url} title={post.title} text={post.excerpt} />
					</div>
				</div>
			</footer>
		</div>

		{#if showToc}
			<div class="hidden xl:col-start-3 xl:block">
				<TableOfContents
					headings={data.headings}
					id="toc-aside"
					class="sticky top-28 max-w-[260px] pb-10"
				/>
			</div>
		{/if}
	</div>
</article>

{#if data.related.length}
	<section aria-labelledby="related-title" class="bg-surface-000 py-16 md:py-20">
		<div class="site-container flex flex-col gap-8">
			<h2
				id="related-title"
				class="m-0 font-display text-[clamp(30px,3.4vw,36px)] leading-[1.1] font-semibold tracking-[-0.02em]"
			>
				Keep reading
			</h2>
			<ul
				class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-6 p-0"
			>
				{#each data.related as related (related.id)}
					<li class="flex min-w-0 flex-col">
						<PostCard post={related} showAuthor={false} class="grow" />
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}
