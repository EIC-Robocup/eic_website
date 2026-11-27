<!--
	Site footer: ruler strip, the faint line drawing of Engineering Building 1, the logo
	and tagline, Explore / Follow / Visit columns, then the copyright, Thai name and
	coordinates. Reads the site.footer section.
-->
<script lang="ts">
	import type { SectionData } from '#lib/content/sections.ts';
	import { currentYear } from './format.ts';
	import { NAV_LINKS } from './links.ts';
	import logo from './assets/eic-logo-128.webp';
	import building from './assets/building-1-line.webp';

	type Props = { data: SectionData<'site', 'footer'> };
	let { data }: Props = $props();

	const socials = $derived(
		[
			{ label: 'Facebook', href: data.facebook },
			{ label: 'Instagram', href: data.instagram },
			{ label: 'GitHub', href: data.github }
		].filter((s) => s.href)
	);
	const year = currentYear();

	const colLink =
		'inline-flex min-h-11 items-center text-[15px] text-ink no-underline transition-colors duration-150 hover:text-brand-text md:min-h-8';
</script>

<footer class="relative overflow-hidden bg-surface-000 text-ink">
	<div aria-hidden="true" class="ruler-strip"></div>
	<img
		src={building}
		alt=""
		aria-hidden="true"
		loading="lazy"
		decoding="async"
		width="1400"
		height="846"
		class="pointer-events-none absolute -right-6 -bottom-3 h-auto w-[min(760px,72%)] opacity-[0.13]"
	/>
	<div class="relative site-container flex flex-col gap-14 pt-16 pb-9">
		<div class="flex flex-wrap justify-between gap-12">
			<div class="flex max-w-[360px] flex-[1_1_300px] flex-col gap-[18px]">
				<a
					href="/"
					aria-label="EIC Chula home"
					class="flex items-center gap-3.5 self-start text-ink no-underline"
				>
					<span class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink">
						<img src={logo} alt="" width="58" height="58" loading="lazy" class="block size-[58px]" />
					</span>
					<span class="font-display text-2xl leading-8 font-semibold tracking-[-0.02em] whitespace-nowrap"
						>EIC <span class="font-medium text-ink-muted">Chula</span></span
					>
				</a>
				{#if data.tagline}
					<p class="m-0 text-sm leading-[22px] text-ink-muted">{data.tagline}</p>
				{/if}
			</div>

			<div class="flex flex-wrap gap-x-[72px] gap-y-10">
				<nav id="footer-nav" aria-labelledby="footer-explore" class="flex flex-col">
					<h2 id="footer-explore" class="text-label mb-1.5 text-ink-muted">Explore</h2>
					<ul class="m-0 flex list-none flex-col p-0">
						{#each NAV_LINKS as link (link.href)}
							<li><a href={link.href} class={colLink}>{link.label}</a></li>
						{/each}
					</ul>
				</nav>

				{#if socials.length}
					<div class="flex flex-col">
						<h2 id="footer-follow" class="text-label mb-1.5 text-ink-muted">Follow</h2>
						<ul aria-labelledby="footer-follow" class="m-0 flex list-none flex-col p-0">
							{#each socials as social (social.label)}
								<li>
									<a href={social.href} rel="noopener noreferrer me" class={colLink}>{social.label}</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if data.email || data.address}
					<div class="flex max-w-60 flex-col">
						<h2 class="text-label mb-1.5 text-ink-muted">Visit</h2>
						{#if data.email}
							<a
								href="mailto:{data.email}"
								class="inline-flex min-h-11 items-center text-[15px] break-all text-ink underline underline-offset-2 transition-colors duration-150 hover:text-brand-text md:min-h-8"
								>{data.email}</a
							>
						{/if}
						{#if data.address}
							<address class="mt-1.5 text-sm leading-[22px] text-ink-muted not-italic">{data.address}</address>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div
			class="flex flex-wrap justify-between gap-3 border-t border-line pt-[22px] text-[13px] leading-5 text-ink-muted"
		>
			<span>© {year} EIC Chula</span>
			{#if data.thaiName || data.coordinates}
				<span class="font-mono text-xs tracking-[0.04em]">
					{#if data.thaiName}<span lang="th" class="font-sans">{data.thaiName}</span>{/if}{#if data.thaiName && data.coordinates}{' · '}{/if}{data.coordinates}
				</span>
			{/if}
		</div>
	</div>
</footer>
