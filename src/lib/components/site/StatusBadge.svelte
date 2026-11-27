<!--
	Status as a dot plus a word: green for Ongoing / Active / Recruiting, grey for Archived.
	The shadcn Badge with the EIC status variants. Pass `status`, or a free `label` with a `tone`.
-->
<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { statusInfo, type StatusTone } from './format.ts';

	type Props = {
		status?: 'ongoing' | 'active' | 'archived' | 'recruiting' | (string & {}) | null;
		label?: string;
		tone?: StatusTone;
		class?: string;
	};
	let { status, label, tone, class: className }: Props = $props();

	const info = $derived(statusInfo(status));
	const text = $derived(label ?? info.label);
	const variant = $derived((tone ?? info.tone) === 'success' ? 'status-success' : 'status-muted');
</script>

{#if text}
	<Badge {variant} class={className}>
		<span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-current"></span>{text}
	</Badge>
{/if}
