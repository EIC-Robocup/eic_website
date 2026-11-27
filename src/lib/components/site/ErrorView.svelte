<script lang="ts">
	import { page } from '$app/state';
	import ButtonLink from '#lib/components/site/ButtonLink.svelte';
	import HeroBand from '#lib/components/site/HeroBand.svelte';
	import HeroEyebrow from '#lib/components/site/HeroEyebrow.svelte';
	import Note from '#lib/components/site/Note.svelte';
	import TitleBlock from '#lib/components/site/TitleBlock.svelte';

	/**
	 * The body of the public error page, shared by the root and (site) error pages. Admin
	 * errors have their own (src/routes/+error.svelte, admin/(app)/+error.svelte).
	 */
	const status = $derived(page.status);
	const notFound = $derived(status === 404);
	const heading = $derived(notFound ? 'This page is not on the drawing.' : 'Something went wrong.');
	const line = $derived(
		notFound
			? 'The link may be old, or the page has moved. Start again from the home page.'
			: status >= 500
				? 'We could not load this page. Try again in a moment.'
				: (page.error?.message ?? 'We could not load this page.')
	);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Error'} · EIC Chula</title>
	<meta name="robots" content="noindex" />
</svelte:head>
<!-- No ruler: the footer's own ruler strip follows the band directly. -->
<HeroBand
	circle={{ cx: 1160, cy: 320, r: 280 }}
	height={640}
	labelledby="error-title"
	ruler={false}
>
	<div class="site-container flex flex-col gap-6 pt-16 pb-7 sm:pt-24">
		<HeroEyebrow label="Error {status}" sublabel={notFound ? 'Page not found' : status >= 500 ? 'Server error' : 'Request error'} />
		<h1
			id="error-title"
			class="m-0 max-w-[14em] font-display text-[clamp(44px,6vw,80px)] leading-[0.95] font-semibold tracking-[-0.04em] text-balance"
		>
			{heading}
		</h1>
		<p class="m-0 max-w-[36em] text-[19px] leading-[30px] text-ink-muted">{line}</p>
		<div class="relative flex flex-wrap gap-3 self-start pt-1">
			<ButtonLink href="/">Back to home</ButtonLink>
			<ButtonLink href="/projects" variant="outline">See the projects</ButtonLink>
			{#if notFound}
				<Note
					text="wrong turn?"
					arrow="left"
					rot={-5}
					class="absolute top-1/2 left-full ml-4 hidden -translate-y-1/2 lg:inline-flex"
				/>
			{/if}
		</div>
	</div>
	{#snippet titleBlock()}
		<TitleBlock dwg={notFound ? 'NOT FOUND' : 'ERROR'} sheet="00" rev={String(status)} />
	{/snippet}
</HeroBand>
