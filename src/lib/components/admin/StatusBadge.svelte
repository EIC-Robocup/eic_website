<!--
	A status pill. Green for Published (and Active, Ongoing, Visible), grey for Draft (and
	Archived, Hidden), red for things that need attention (Unread, New).

	<StatusBadge status={post.status} />
	<StatusBadge tone="brand" label="3 unread" />
-->
<script lang="ts" module>
	export type StatusTone = 'success' | 'neutral' | 'brand';

	const TONES: Record<string, StatusTone> = {
		published: 'success',
		active: 'success',
		ongoing: 'success',
		visible: 'success',
		live: 'success',
		draft: 'neutral',
		archived: 'neutral',
		hidden: 'neutral',
		unread: 'brand',
		new: 'brand'
	};

	/** The tone a status word gets when no `tone` is passed. */
	export function toneFor(status: string | null | undefined): StatusTone {
		return (status && TONES[status.toLowerCase()]) || 'neutral';
	}
</script>

<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		/** A status value such as 'published' or 'draft'. Shown capitalised unless `label` is set. */
		status?: 'published' | 'draft' | (string & {}) | null;
		/** Text to show instead of the capitalised status. */
		label?: string;
		/** Colour, overriding the one picked from `status`. */
		tone?: StatusTone;
		/** Adds a small dot before the text. */
		dot?: boolean;
		class?: string;
	};

	let { status, label, tone, dot = false, class: className }: Props = $props();

	const text = $derived(
		label ?? (status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/[-_]/g, ' ') : '')
	);
	const resolved = $derived(tone ?? toneFor(status));
	const toneClass = $derived(
		resolved === 'success'
			? 'border-success/35 bg-success/12 text-success'
			: resolved === 'brand'
				? 'border-brand/45 bg-brand/14 text-brand-text'
				: 'border-line bg-surface-300 text-ink-muted'
	);
</script>

{#if text}
	<Badge
		variant="outline"
		class={cn('h-6 gap-1.5 rounded-full px-2.5 py-0 text-xs leading-5 font-medium', toneClass, className)}
	>
		{#if dot}<span aria-hidden="true" class="size-1.5 rounded-full bg-current"></span>{/if}{text}
	</Badge>
{/if}
