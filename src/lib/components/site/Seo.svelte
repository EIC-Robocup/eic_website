<!--
	Page <head>: title, description, canonical link, Open Graph and Twitter tags.
	The title renders as "{title} · EIC Chula" ("EIC Chula" alone when no title is given,
	as on the home page). Image paths are made absolute against the current origin.
-->
<script lang="ts">
	import { page } from '$app/state';

	type Props = {
		title?: string | null;
		description?: string | null;
		/** Absolute URL or a site path, e.g. "/images/archive/robocup-2022-team.webp". */
		image?: string | null;
		imageAlt?: string | null;
		type?: 'website' | 'article' | 'profile';
		/** ISO date for articles. */
		publishedTime?: string | null;
		/** Ask search engines not to index the page. */
		noindex?: boolean;
	};

	const SITE = 'EIC Chula';
	const DEFAULT_DESCRIPTION =
		'Engineering Innovator Club, Chulalongkorn University. Student robotics and the RoboCup@Home team behind Walkie.';
	const DEFAULT_IMAGE = '/images/archive/robocup-2022-team.webp';
	const DEFAULT_IMAGE_ALT = 'The EIC Chula team holding the EIC CHULA banner at RoboCup@Home 2022';

	let {
		title,
		description,
		image,
		imageAlt,
		type = 'website',
		publishedTime,
		noindex = false
	}: Props = $props();

	const fullTitle = $derived(title && title !== SITE ? `${title} · ${SITE}` : SITE);
	const desc = $derived(description?.trim() || DEFAULT_DESCRIPTION);
	const canonical = $derived(page.url.origin + page.url.pathname);

	function absolute(url: string): string {
		try {
			return new URL(url, page.url.origin).href;
		} catch {
			return page.url.origin + DEFAULT_IMAGE;
		}
	}

	const ogImage = $derived(absolute(image?.trim() || DEFAULT_IMAGE));
	const ogImageAlt = $derived(image?.trim() ? (imageAlt ?? '') : DEFAULT_IMAGE_ALT);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={canonical} />
	{#if noindex}<meta name="robots" content="noindex" />{/if}

	<meta property="og:site_name" content={SITE} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title || SITE} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={ogImage} />
	{#if ogImageAlt}<meta property="og:image:alt" content={ogImageAlt} />{/if}
	<meta property="og:locale" content="en_US" />
	{#if type === 'article' && publishedTime}
		<meta property="article:published_time" content={publishedTime} />
	{/if}

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title || SITE} />
	<meta name="twitter:description" content={desc} />
	<meta name="twitter:image" content={ogImage} />
	{#if ogImageAlt}<meta name="twitter:image:alt" content={ogImageAlt} />{/if}
</svelte:head>
