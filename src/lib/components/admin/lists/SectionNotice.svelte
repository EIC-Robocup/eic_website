<!--
	A one line notice in a list's panel when the section that shows the list is switched off on
	its public page, with a link to the Pages editor.

	<SectionNotice shown={data.shown.sponsors} page="about" pageTitle="About" />
-->
<script lang="ts">
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';

	type Props = {
		/** Whether the section is on. Nothing renders unless it is `false`. */
		shown: boolean | null;
		/** Page key in the Pages editor, e.g. "about". */
		page: string;
		pageTitle: string;
	};

	let { shown, page, pageTitle }: Props = $props();
</script>

{#if shown === false}
	<p class="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-line bg-surface-100 px-3 py-2.5 text-[13px] leading-5 text-ink-muted">
		<EyeOffIcon class="size-4 shrink-0" aria-hidden="true" />
		<span>This section is switched off on the {pageTitle} page, so the list is not shown.</span>
		<a href="/admin/pages/{page}" class="text-brand-text hover:text-ink">Turn it on in Pages</a>
	</p>
{/if}
