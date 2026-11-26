<!--
	Sticky site navigation: logo badge and wordmark, the section links (the current one
	marked with a 2px brand underline) and the red call to action. Below 768px the links
	and the button move into a disclosure menu.
-->
<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ButtonLink from './ButtonLink.svelte';
	import { NAV_LINKS, isActivePath } from './links.ts';
	import logo from './assets/eic-logo-128.webp';

	type Props = {
		/** The red button (site.nav section's `cta`). */
		cta?: { label: string; href: string };
	};

	let { cta = { label: 'Join EIC', href: '/about#join' } }: Props = $props();

	let open = $state(false);
	let header: HTMLElement | undefined = $state();
	let toggle: HTMLButtonElement | undefined = $state();

	const links = $derived(
		NAV_LINKS.map((l) => ({
			...l,
			active: isActivePath(page.url.pathname, l.href),
			current: page.url.pathname === l.href
		}))
	);

	afterNavigate(() => {
		open = false;
	});

	function onkeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			open = false;
			toggle?.focus();
		}
	}

	function onclick(event: MouseEvent) {
		if (open && header && event.target instanceof Node && !header.contains(event.target)) {
			open = false;
		}
	}
</script>

<svelte:window {onkeydown} {onclick} />

<header bind:this={header} class="sticky top-0 z-40 border-b border-line bg-surface-100 text-ink">
	<nav
		aria-label="Main"
		class="site-container flex min-h-16 items-center justify-between gap-x-8 gap-y-3 md:min-h-[72px] md:flex-wrap"
	>
		<a href="/" aria-label="EIC Chula home" class="flex min-h-11 items-center gap-3 text-ink no-underline">
			<span class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink">
				<img src={logo} alt="" width="40" height="40" class="block size-10" />
			</span>
			<span class="font-display text-[22px] leading-7 font-semibold tracking-[-0.02em] whitespace-nowrap"
				>EIC <span class="font-medium text-ink-muted">Chula</span></span
			>
		</a>

		<div class="hidden flex-wrap items-center gap-x-7 gap-y-1 md:flex">
			<ul class="m-0 flex list-none flex-wrap items-center gap-x-7 gap-y-1 p-0">
				{#each links as link (link.href)}
					<li>
						<a
							href={link.href}
							aria-current={link.current ? 'page' : link.active ? 'true' : undefined}
							class={[
								'inline-flex min-h-11 items-center text-[15px] font-medium no-underline transition-colors duration-150',
								link.active
									? 'text-ink shadow-[inset_0_-2px_0_var(--eic-brand)]'
									: 'text-ink-muted hover:text-ink'
							]}>{link.label}</a
						>
					</li>
				{/each}
			</ul>
			{#if cta.href && cta.label}
				<ButtonLink href={cta.href} size="sm">{cta.label}</ButtonLink>
			{/if}
		</div>

		<button
			bind:this={toggle}
			type="button"
			class="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-strong text-ink transition-colors duration-150 hover:border-ink md:hidden"
			aria-expanded={open}
			aria-controls="site-menu"
			onclick={() => (open = !open)}
		>
			<span class="sr-only">Menu</span>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				aria-hidden="true"
			>
				{#if open}
					<path d="M6 6 L18 18 M18 6 L6 18" />
				{:else}
					<path d="M4 7 H20 M4 12 H20 M4 17 H20" />
				{/if}
			</svg>
		</button>
	</nav>

	<div id="site-menu" hidden={!open} class="border-t border-line md:hidden">
		<ul class="site-container m-0 flex list-none flex-col py-2">
			{#each links as link (link.href)}
				<li class="border-b border-line last:border-b-0">
					<a
						href={link.href}
						aria-current={link.current ? 'page' : link.active ? 'true' : undefined}
						class={[
							'flex min-h-12 items-center text-base font-medium no-underline',
							link.active
								? 'text-ink shadow-[inset_2px_0_0_var(--eic-brand)] pl-3'
								: 'text-ink-muted hover:text-ink'
						]}>{link.label}</a
					>
				</li>
			{/each}
		</ul>
		{#if cta.href && cta.label}
			<div class="site-container pb-4">
				<ButtonLink href={cta.href} class="w-full">{cta.label}</ButtonLink>
			</div>
		{/if}
	</div>
</header>
