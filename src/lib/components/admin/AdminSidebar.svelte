<!--
	The admin sidebar (AdminNav design): brand mark, the Site / Content / Library groups with
	counts, and a footer with "View site", the signed-in editor and Sign out. Below 768px it
	becomes the shadcn sidebar's sheet, opened from AdminTopBar. Must sit inside Sidebar.Provider.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import ImageIcon from '@lucide/svelte/icons/image';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import PanelsTopLeftIcon from '@lucide/svelte/icons/panels-top-left';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import UsersIcon from '@lucide/svelte/icons/users';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { useSidebar } from '#lib/components/ui/sidebar/index.js';
	import AdminButton from './AdminButton.svelte';
	import BrandMark from './BrandMark.svelte';
	import { ADMIN_NAV, isActiveAdminPath, type AdminCounts, type AdminNavKey, type AdminNavLink } from './nav.ts';

	type Props = {
		editor: { email: string; name: string | null; role: 'owner' | 'editor' };
		counts: AdminCounts | null;
		/** Number of editable pages, for the Pages badge. */
		pageCount?: number;
	};

	let { editor, counts, pageCount }: Props = $props();

	const sidebar = useSidebar();

	// The phone sheet closes once a link has been followed.
	afterNavigate(() => {
		if (sidebar.openMobile) sidebar.setOpenMobile(false);
	});

	const ICONS: Record<AdminNavKey, Component<{ class?: string }>> = {
		dashboard: LayoutGridIcon,
		pages: PanelsTopLeftIcon,
		projects: FolderIcon,
		posts: FileTextIcon,
		people: UsersIcon,
		achievements: TrophyIcon,
		media: ImageIcon,
		inbox: InboxIcon,
		settings: SlidersHorizontalIcon
	};

	function countFor(link: AdminNavLink): number | null {
		if (!link.count) return null;
		if (link.count === 'pages') return pageCount ?? null;
		return counts?.[link.count] ?? null;
	}

	const displayName = $derived(editor.name?.trim() || editor.email);
	const initials = $derived.by(() => {
		const source = editor.name?.trim() || editor.email.split('@')[0];
		const parts = source.split(/[\s._-]+/).filter(Boolean);
		const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
		return letters.toUpperCase();
	});
	const roleLabel = $derived(editor.role === 'owner' ? 'Owner' : 'Editor');
</script>

<Sidebar.Root class="border-line">
	<!-- One landmark for the whole sidebar, so the brand, View site and the signed-in editor are in it too. -->
	<aside aria-label="Admin sidebar" class="flex h-full min-h-0 flex-col">
		<Sidebar.Header class="gap-0 px-3.5 pt-5 pb-1">
			<div class="flex items-center justify-between gap-2 px-1.5">
				<BrandMark href="/admin" />
				{#if sidebar.isMobile}
					<AdminButton
						variant="ghost"
						size="icon"
						aria-label="Close menu"
						onclick={() => sidebar.setOpenMobile(false)}
					>
						<XIcon aria-hidden="true" />
					</AdminButton>
				{/if}
			</div>
		</Sidebar.Header>

		<Sidebar.Content class="gap-0 px-3.5 py-4">
			<nav aria-label="Admin" class="flex flex-col gap-[22px]">
				{#each ADMIN_NAV as group (group.label)}
					<Sidebar.Group class="p-0">
						<Sidebar.GroupLabel
							class="h-auto px-2.5 pb-1.5 font-mono text-[11px] leading-4 tracking-[0.1em] text-ink-muted uppercase"
						>
							{group.label}
						</Sidebar.GroupLabel>
						<Sidebar.GroupContent>
							<Sidebar.Menu class="gap-0.5">
								{#each group.links as link (link.key)}
									{@const active = isActiveAdminPath(page.url.pathname, link.href)}
									{@const count = countFor(link)}
									{@const Icon = ICONS[link.key]}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton
											class="h-10 gap-2.5 rounded-sm px-2.5 py-0 font-medium text-ink-muted hover:bg-surface-200/60 hover:text-ink data-active:bg-surface-200 data-active:text-ink data-active:shadow-[inset_0_0_0_1px_var(--eic-line)] [&_svg]:size-[18px]"
										>
											{#snippet child({ props })}
												<a
													href={link.href}
													{...props}
													data-active={active ? '' : undefined}
													aria-current={active ? 'page' : undefined}
												>
													<Icon class="shrink-0" />
													<span class="min-w-0 flex-1 truncate">{link.label}</span>
													{#if count !== null && link.count === 'unread'}
														{#if count > 0}
															<span
																class="rounded-full bg-brand px-1.5 font-mono text-[11px] leading-[18px] text-on-brand"
															>
																{count}<span class="sr-only"> unread</span>
															</span>
														{/if}
													{:else if count !== null}
														<span class="font-mono text-[11px] text-ink-muted">{count}</span>
													{/if}
												</a>
											{/snippet}
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								{/each}
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				{/each}
			</nav>
		</Sidebar.Content>

		<Sidebar.Footer class="gap-2.5 px-3.5 pt-0 pb-5">
			<div class="flex flex-col gap-2.5 border-t border-line pt-4">
				<a
					href="/"
					target="_blank"
					rel="noopener"
					class="flex min-h-11 items-center justify-between rounded-sm border border-line px-2.5 text-sm font-medium text-ink no-underline transition-colors hover:border-ink"
				>
					View site <span aria-hidden="true">↗</span><span class="sr-only">(opens in a new tab)</span>
				</a>
				<div class="flex items-center gap-2.5 px-1 py-1.5">
					<span
						class="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-xs font-semibold text-ink-muted"
						aria-hidden="true"
					>
						{initials}
					</span>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-[13px] leading-[18px] font-semibold text-ink" title={editor.email}>
							{displayName}
						</span>
						<span class="truncate text-xs leading-4 text-ink-muted">
							{editor.name ? `${roleLabel} · ${editor.email}` : roleLabel}
						</span>
					</span>
					<form method="POST" action="/admin/logout" class="shrink-0">
						<Button
							type="submit"
							variant="link"
							class="h-11 rounded-sm px-1.5 text-xs font-normal text-ink-muted underline transition-colors hover:text-ink"
						>
							Sign out
						</Button>
					</form>
				</div>
			</div>
		</Sidebar.Footer>
	</aside>
</Sidebar.Root>
