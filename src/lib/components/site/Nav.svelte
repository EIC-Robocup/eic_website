<!--
	Sticky site navigation: logo badge and wordmark, the section links (the current one
	marked with a 2px brand underline) and the red call to action. Below 768px the links
	and the button move into a menu: a shadcn Sheet that drops from the top and repeats the
	bar, so it looks like the bar opening. It closes on navigation, Escape and a tap outside.
	Until the page is interactive (and without JavaScript) the menu button is a plain link to
	the footer's Explore list (#footer-nav), so it never sits there doing nothing.

	The header keeps still during page transitions (view-transition-name: site-nav).
-->
<script lang="ts">
	import { flushSync } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import ButtonLink from './ButtonLink.svelte';
	import { focusedIndex, refocus, useHydrated } from './hydrated.svelte.ts';
	import { NAV_LINKS, isActivePath } from './links.ts';
	import logo from './assets/eic-logo-128.webp';

	type Props = {
		/** The red button (site.nav section's `cta`). */
		cta?: { label: string; href: string };
	};

	let { cta = { label: 'Join EIC', href: '/about#join' } }: Props = $props();

	let open = $state(false);
	/** The menu link shown until the page is interactive, then the Sheet's menu button. */
	let standInButton: HTMLElement | null = $state(null);
	let menuButton: HTMLElement | null = $state(null);
	// Focus on the stand-in moves to the menu button when it takes over.
	const hydrated = useHydrated(() => refocus(focusedIndex(standInButton), () => menuButton));
	let closeButton: HTMLElement | null = $state(null);
	/**
	 * Set when a navigation closes the menu: it then goes at once (the page transition fades it
	 * out with the old page, as `site-menu`) and focus stays where SvelteKit put it.
	 */
	let navigated = $state(false);

	const links = $derived(
		NAV_LINKS.map((l) => ({
			...l,
			active: isActivePath(page.url.pathname, l.href),
			current: page.url.pathname === l.href
		}))
	);

	afterNavigate(() => {
		if (!open) return;
		// Close before the page transition captures the new page, so only the old one has it.
		flushSync(() => {
			navigated = true;
			open = false;
		});
	});

	function onOpenChange(next: boolean) {
		if (next) navigated = false;
	}

	// The menu is for phones: close it if the window grows past the breakpoint.
	$effect(() => {
		const wide = window.matchMedia('(min-width: 48rem)');
		const onchange = () => {
			if (wide.matches) open = false;
		};
		wide.addEventListener('change', onchange);
		return () => wide.removeEventListener('change', onchange);
	});
</script>

{#snippet brand()}
	<a href="/" aria-label="EIC Chula home" class="flex min-h-11 items-center gap-3 text-ink no-underline">
		<span class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink">
			<img src={logo} alt="" width="40" height="40" class="block size-10" />
		</span>
		<span class="font-display text-[22px] leading-7 font-semibold tracking-[-0.02em] whitespace-nowrap"
			>EIC <span class="font-medium text-ink-muted">Chula</span></span
		>
	</a>
{/snippet}

{#snippet icon(path: string)}
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		aria-hidden="true"
		class="size-5"
	>
		<path d={path} />
	</svg>
{/snippet}

<header
	class="sticky top-0 z-40 border-b border-line bg-surface-100 text-ink [view-transition-name:site-nav]"
>
	<nav
		aria-label="Main"
		class="site-container flex min-h-16 items-center justify-between gap-x-8 gap-y-3 md:min-h-[72px] md:flex-wrap"
	>
		{@render brand()}

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

		{#if hydrated.current}
			<Sheet.Root bind:open {onOpenChange}>
				<Sheet.Trigger>
					{#snippet child({ props })}
						<Button {...props} bind:ref={menuButton} variant="outline-ink" size="site-icon" class="md:hidden">
							<span class="sr-only">Menu</span>
							{@render icon('M4 7 H20 M4 12 H20 M4 17 H20')}
						</Button>
					{/snippet}
				</Sheet.Trigger>
				<Sheet.Content
					side="top"
					showCloseButton={false}
					overlayClass={[
						'bg-surface-000/70 supports-backdrop-filter:backdrop-blur-none',
						navigated && 'data-closed:hidden! data-closed:animate-none!'
					].filter(Boolean).join(' ')}
					class={[
						'gap-0 border-line bg-surface-100 p-0 text-base text-ink shadow-none [view-transition-name:site-menu] md:hidden',
						navigated && 'data-closed:hidden! data-closed:animate-none!'
					].filter(Boolean).join(' ')}
					onOpenAutoFocus={(event) => {
						// Like the bar's own button turning into the close button.
						event.preventDefault();
						closeButton?.focus();
					}}
					onCloseAutoFocus={(event) => {
						if (navigated) event.preventDefault();
					}}
				>
					<Sheet.Title class="sr-only">Menu</Sheet.Title>
					<div class="border-b border-line">
						<div class="site-container flex min-h-16 items-center justify-between gap-x-8">
							{@render brand()}
							<Sheet.Close>
								{#snippet child({ props })}
									<Button {...props} bind:ref={closeButton} variant="outline-ink" size="site-icon">
										<span class="sr-only">Close menu</span>
										{@render icon('M6 6 L18 18 M18 6 L6 18')}
									</Button>
								{/snippet}
							</Sheet.Close>
						</div>
					</div>
					<nav aria-label="Main">
						<ul class="site-container m-0 flex list-none flex-col py-2">
							{#each links as link (link.href)}
								<li class="border-b border-line last:border-b-0">
									<a
										href={link.href}
										aria-current={link.current ? 'page' : link.active ? 'true' : undefined}
										class={[
											'flex min-h-12 items-center text-base font-medium no-underline transition-colors duration-150',
											link.active
												? 'pl-3 text-ink shadow-[inset_2px_0_0_var(--eic-brand)]'
												: 'text-ink-muted hover:text-ink'
										]}>{link.label}</a
									>
								</li>
							{/each}
						</ul>
					</nav>
					{#if cta.href && cta.label}
						<div class="site-container pb-4">
							<ButtonLink href={cta.href} class="w-full">{cta.label}</ButtonLink>
						</div>
					{/if}
				</Sheet.Content>
			</Sheet.Root>
		{:else}
			<Button bind:ref={standInButton} href="#footer-nav" variant="outline-ink" size="site-icon" class="md:hidden">
				<span class="sr-only">Menu</span>
				{@render icon('M4 7 H20 M4 12 H20 M4 17 H20')}
			</Button>
		{/if}
	</nav>
</header>
