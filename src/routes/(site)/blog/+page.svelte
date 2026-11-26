<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import FilterPills from '#lib/components/site/FilterPills.svelte';
	import HeroBand from '#lib/components/site/HeroBand.svelte';
	import HeroEyebrow from '#lib/components/site/HeroEyebrow.svelte';
	import Note from '#lib/components/site/Note.svelte';
	import PostCard from '#lib/components/site/PostCard.svelte';
	import Seo from '#lib/components/site/Seo.svelte';
	import Tag from '#lib/components/site/Tag.svelte';
	import TitleBlock from '#lib/components/site/TitleBlock.svelte';
	import { POST_CATEGORY_OPTIONS } from '#lib/content/labels.ts';
	import RssLink from './RssLink.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const hero = $derived(data.sections.hero.data);

	/** /blog with the current filters, changed by `next`. Leaves out empty values. */
	function blogHref(next: { category?: string | null; tag?: string | null; q?: string | null; page?: number }) {
		const values = {
			category: data.filters.category,
			tag: data.filters.tag,
			q: data.filters.q,
			page: null as number | null,
			...next
		};
		const params = new URLSearchParams();
		if (values.category) params.set('category', values.category);
		if (values.tag) params.set('tag', values.tag);
		if (values.q) params.set('q', values.q);
		if (values.page && values.page > 1) params.set('page', String(values.page));
		const qs = params.toString();
		return qs ? `/blog?${qs}` : '/blog';
	}

	/* Category: the pill answers at once (the loaded cards are filtered here), then the
	   server's list for that category replaces them. */
	let category = $state(untrack(() => data.filters.category ?? 'all'));
	$effect.pre(() => {
		category = data.filters.category ?? 'all';
	});

	const categoryOptions = [{ value: 'all', label: 'All' }, ...POST_CATEGORY_OPTIONS];

	function pickCategory(value: string) {
		// Take the search box along, even if its pause has not passed yet.
		clearTimeout(timer);
		sentQuery = query.trim();
		goto(blogHref({ category: value === 'all' ? null : value, q: sentQuery || null }), {
			noScroll: true,
			keepFocus: true
		});
	}

	/* Search: the loaded cards are filtered as you type, and after a pause the URL
	   (?q=) is updated so the server searches every post. Without JavaScript the form
	   submits ?q= itself. */
	let query = $state(untrack(() => data.filters.q ?? ''));
	let sentQuery = untrack(() => data.filters.q ?? '');
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect.pre(() => {
		// Back/forward or a tag link changed ?q=: show it, unless it is what we sent.
		const incoming = data.filters.q ?? '';
		if (incoming !== sentQuery) {
			sentQuery = incoming;
			query = incoming;
		}
	});

	$effect(() => () => clearTimeout(timer));

	function sendQuery() {
		clearTimeout(timer);
		const q = query.trim();
		if (q === sentQuery) return;
		sentQuery = q;
		goto(blogHref({ q: q || null, category: category === 'all' ? null : category }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function onSearchInput() {
		clearTimeout(timer);
		timer = setTimeout(sendQuery, 350);
	}

	function onSearchSubmit(event: SubmitEvent) {
		event.preventDefault();
		sendQuery();
	}

	const needle = $derived(query.trim().toLowerCase());

	const matches = (p: { title: string; excerpt: string | null; category: string }) =>
		(category === 'all' || p.category === category) &&
		(!needle ||
			p.title.toLowerCase().includes(needle) ||
			(p.excerpt ?? '').toLowerCase().includes(needle));

	const shown = $derived.by(() => {
		// While a search is typed but not yet sent, the featured post counts as a result too.
		const pool =
			needle && !data.filters.q && data.featured ? [data.featured, ...data.posts] : data.posts;
		return pool.filter(matches);
	});

	const filtering = $derived(category !== 'all' || Boolean(needle) || Boolean(data.filters.tag));

	/* "Load older posts": a real link (?page=N+1) that works without JavaScript. With it,
	   the new cards are appended in place and focus moves to the first of them. */
	const firstNew = $derived(data.pageNo * data.pageSize + 1);
	const olderHref = $derived(blogHref({ page: data.pageNo + 1 }));

	async function loadOlder(event: MouseEvent) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
		event.preventDefault();
		const target = firstNew;
		await goto(olderHref, { noScroll: true, keepFocus: true });
		document.querySelector<HTMLElement>(`#post-${target} a`)?.focus();
	}

	const resultText = $derived(
		shown.length === 1 ? '1 post' : shown.length ? `${shown.length} posts` : 'No posts'
	);
</script>

<Seo
	title="Blog"
	description="{hero.headline} Race reports, build logs and research notes from the EIC Chula robotics team."
/>
<RssLink />

<HeroBand circle={{ cx: 1160, cy: 280, r: 260 }} height={560} labelledby="blog-title">
	<div
		class="site-container flex flex-wrap items-end justify-between gap-8 pt-12 pb-12 sm:pt-[72px]"
	>
		<div class="flex min-w-0 flex-[1_1_520px] flex-col gap-[22px]">
			<HeroEyebrow label={hero.label} sublabel={hero.sublabel} />
			<h1
				id="blog-title"
				class="m-0 font-display text-[clamp(52px,7vw,100px)] leading-[0.9] font-semibold tracking-[-0.04em] text-balance"
			>
				{hero.headline}
			</h1>
			<Note text="fresh off the bench" arrow="right" rot={-3} class="self-start" />
		</div>
		<TitleBlock dwg="BLOG" sheet="05" />
	</div>
</HeroBand>

{#if !data.hasPosts}
	<section aria-labelledby="empty-title" class="site-container pt-16 pb-16 md:pb-[104px]">
		<div
			class="flex flex-col items-start gap-4 rounded-lg border border-dashed border-line-strong p-8 sm:p-12"
		>
			<h2 id="empty-title" class="m-0 font-display text-[28px] leading-[34px] font-semibold">
				No posts yet.
			</h2>
			<p class="m-0 max-w-[52ch] text-ink-muted">
				The first lab notes are on the bench. Race reports and build logs will show up here.
			</p>
		</div>
	</section>
{:else}
	{#if data.featured}
		<section aria-label="Featured post" class="site-container pt-12 pb-10 md:pt-16 md:pb-12">
			<PostCard post={data.featured} variant="featured" headingLevel={2} showExcerpt={false} eager />
		</section>
	{/if}

	<section
		aria-labelledby="posts-title"
		class={[
			'site-container flex flex-col gap-8 pb-16 md:pb-[104px]',
			!data.featured && 'pt-12 md:pt-16'
		]}
	>
		<h2 id="posts-title" class="sr-only">
			{data.tagLabel ? `Posts tagged ${data.tagLabel}` : 'All posts'}
		</h2>
		<div class="flex flex-wrap items-center justify-between gap-4">
			<FilterPills
				label="Filter posts"
				options={categoryOptions}
				bind:value={category}
				onchange={pickCategory}
			/>
			<form
				role="search"
				method="GET"
				action="/blog"
				onsubmit={onSearchSubmit}
				class="w-full sm:w-auto"
			>
				{#if data.filters.category}<input
						type="hidden"
						name="category"
						value={data.filters.category}
					/>{/if}
				{#if data.filters.tag}<input type="hidden" name="tag" value={data.filters.tag} />{/if}
				<label
					class="flex min-h-11 w-full items-center gap-2 rounded-sm border border-line-strong bg-surface-200 px-3.5 transition-colors duration-150 focus-within:border-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus hover:border-ink sm:w-[240px]"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="var(--eic-ink-muted)"
						stroke-width="1.5"
						aria-hidden="true"
						class="shrink-0"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg
					>
					<span class="sr-only">Search posts</span>
					<input
						type="search"
						name="q"
						placeholder="Search posts"
						autocomplete="off"
						maxlength="100"
						bind:value={query}
						oninput={onSearchInput}
						class="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink placeholder:text-ink-muted focus-visible:outline-none"
					/>
				</label>
			</form>
		</div>

		{#if data.tagLabel}
			<p class="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-ink-muted">
				<span>Posts tagged</span>
				<Tag label={data.tagLabel} tone="raised" size="md" />
				<a
					href={blogHref({ tag: null })}
					class="inline-flex min-h-11 items-center font-medium text-brand-text no-underline transition-colors duration-150 hover:text-ink"
					>Show all posts</a
				>
			</p>
		{/if}

		<p class="sr-only" aria-live="polite">{filtering ? `${resultText} shown` : ''}</p>

		{#if shown.length}
			<ul
				class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-6 p-0"
			>
				{#each shown as post, i (post.id)}
					<li id="post-{i + 1}" class="flex min-w-0 flex-col">
						<PostCard {post} class="grow" />
					</li>
				{/each}
			</ul>
		{:else}
			<div
				class="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong p-8"
			>
				<p class="m-0 font-display text-[22px] leading-7 font-semibold">
					{#if needle}
						No posts match “{query.trim()}”.
					{:else if category !== 'all'}
						No {categoryOptions.find((o) => o.value === category)?.label.toLowerCase()} posts yet.
					{:else}
						No other posts yet.
					{/if}
				</p>
				{#if filtering}
					<a
						href="/blog"
						class="inline-flex min-h-11 items-center text-[15px] font-medium text-brand-text no-underline transition-colors duration-150 hover:text-ink"
						>Show all posts</a
					>
				{/if}
			</div>
		{/if}

		{#if data.hasMore && (!needle || data.filters.q)}
			<div class="flex justify-center pt-4">
				<a
					href="{olderHref}#post-{firstNew}"
					onclick={loadOlder}
					class="inline-flex min-h-12 items-center justify-center rounded-sm border border-line-strong px-[22px] text-[15px] leading-5 font-medium text-ink no-underline transition-colors duration-150 hover:border-ink"
					>Load older posts</a
				>
			</div>
		{/if}
	</section>
{/if}
