<!--
	Status as a dot plus a word: green for Ongoing / Active / Recruiting, grey for Archived.
	Pass `status`, or a free `label` with a `tone`.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js';
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
	const color = $derived((tone ?? info.tone) === 'success' ? 'text-success' : 'text-ink-muted');
</script>

{#if text}
	<!-- text-label is kept out of cn(): it would treat it as a text colour and drop it. -->
	<span class={['text-label', cn('inline-flex items-center gap-1.5 whitespace-nowrap', color, className)]}>
		<span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-current"></span>{text}
	</span>
{/if}
