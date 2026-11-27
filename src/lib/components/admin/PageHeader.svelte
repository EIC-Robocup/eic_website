<!--
	The top of every admin page: a mono breadcrumb ("Content / Posts") or a back link
	("← Posts"), the Space Grotesk title with an optional status badge, an optional line of
	description, and the page's actions on the right (the primary action goes last).
	Also sets the document title to "<title> · EIC Admin".

	<PageHeader breadcrumb={[{ label: 'Content' }, { label: 'Posts' }]} title="Posts">
		{#snippet actions()}
			<AdminButton href="/admin/posts/new">New post</AdminButton>
		{/snippet}
	</PageHeader>

	<PageHeader back={{ label: 'Posts', href: '/admin/posts' }} title="Edit post" size="md">
		{#snippet badge()}<StatusBadge status={post.status} />{/snippet}
		{#snippet actions()}...{/snippet}
	</PageHeader>
-->
<script lang="ts" module>
	export type Crumb = { label: string; href?: string };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		/** Mono trail above the title. Items with `href` are links. */
		breadcrumb?: Crumb[];
		/** A "← Label" link above the title, for edit pages. Used instead of `breadcrumb`. */
		back?: { label: string; href: string };
		/** One plain line under the title. */
		description?: string;
		/** Next to the title, e.g. a StatusBadge. */
		badge?: Snippet;
		/** Buttons on the right; they wrap under the title on phones. */
		actions?: Snippet;
		/** `lg` 32px titles for list pages (default), `md` 28px for edit pages. */
		size?: 'lg' | 'md';
		/** The browser tab title (before " · EIC Admin"). Defaults to `title`; `false` leaves it alone. */
		documentTitle?: string | false;
		class?: string;
	};

	let {
		title,
		breadcrumb = [],
		back,
		description,
		badge,
		actions,
		size = 'lg',
		documentTitle,
		class: className
	}: Props = $props();

	const tabTitle = $derived(documentTitle === false ? null : `${documentTitle ?? title} · EIC Admin`);
</script>

<svelte:head>
	{#if tabTitle}<title>{tabTitle}</title>{/if}
</svelte:head>

<header class={['flex flex-wrap items-end justify-between gap-4', className]}>
	<div class="flex min-w-0 flex-col gap-2">
		{#if back}
			<a
				href={back.href}
				class="text-label -my-3 inline-flex min-h-11 items-center gap-1.5 self-start text-ink-muted no-underline transition-colors hover:text-ink"
			>
				<span aria-hidden="true">←</span>{back.label}
			</a>
		{:else if breadcrumb.length}
			<nav aria-label="Breadcrumb">
				<ol class="text-label flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-muted">
					{#each breadcrumb as crumb, i (i)}
						<li class="inline-flex items-center gap-1.5">
							{#if i > 0}<span aria-hidden="true">/</span>{/if}
							{#if crumb.href && i < breadcrumb.length - 1}
								<a href={crumb.href} class="text-ink-muted no-underline transition-colors hover:text-ink">
									{crumb.label}
								</a>
							{:else}
								<span aria-current={i === breadcrumb.length - 1 ? 'page' : undefined}>{crumb.label}</span>
							{/if}
						</li>
					{/each}
				</ol>
			</nav>
		{/if}
		<div class="flex flex-wrap items-center gap-3">
			<h1
				class={[
					'm-0 font-display font-semibold tracking-[-0.02em] text-balance text-ink',
					size === 'lg'
						? 'text-[26px] leading-8 sm:text-[32px] sm:leading-[38px]'
						: 'text-[24px] leading-[30px] sm:text-[28px] sm:leading-[34px]'
				]}
			>
				{title}
			</h1>
			{@render badge?.()}
		</div>
		{#if description}
			<p class="m-0 max-w-[60ch] text-sm leading-[22px] text-ink-muted">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2.5">
			{@render actions()}
		</div>
	{/if}
</header>
