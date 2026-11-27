<!--
	Share row: Facebook (a plain link, so it works without JavaScript), copy link (a toast
	says whether it worked) and the system share sheet where the browser has one.
	The buttons are the shadcn Button with the EIC outline variant at 44px.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { notify } from '#lib/components/site/notify.ts';

	type Props = { url: string; title: string; text?: string | null };
	let { url, title, text }: Props = $props();

	const facebook = $derived(
		`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
	);

	let canShare = $state(false);

	onMount(() => {
		canShare = typeof navigator.share === 'function';
	});

	function copyWithSelection(value: string): boolean {
		const field = document.createElement('textarea');
		field.value = value;
		field.setAttribute('readonly', '');
		field.style.position = 'fixed';
		field.style.opacity = '0';
		document.body.append(field);
		field.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		field.remove();
		return ok;
	}

	async function copy() {
		let ok = false;
		try {
			await navigator.clipboard.writeText(url);
			ok = true;
		} catch {
			ok = copyWithSelection(url);
		}
		// The toast library loads with the first toast (notify.ts), not with every page.
		if (ok) void notify('Link copied', 'success', { id: 'share-copy' });
		else void notify('Could not copy the link', 'error', { id: 'share-copy', description: url });
	}

	async function share() {
		try {
			await navigator.share({ title, text: text ?? undefined, url });
		} catch {
			// Closing the share sheet rejects; nothing to do.
		}
	}

	// The share row's buttons are a little smaller than page buttons: 14px regular text.
	const button = 'px-3.5 text-sm leading-5 font-normal';
</script>

<div class="flex flex-wrap items-center gap-2">
	<span class="pr-1 text-sm text-ink-muted">Share</span>
	<Button
		href={facebook}
		target="_blank"
		rel="noopener noreferrer"
		variant="outline-ink"
		size="site-md"
		class={button}>Facebook<span class="sr-only"> (opens in a new tab)</span></Button
	>
	<Button onclick={copy} variant="outline-ink" size="site-md" class={button}>Copy link</Button>
	{#if canShare}
		<Button onclick={share} variant="outline-ink" size="site-md" class={button}>
			More<span class="sr-only"> ways to share</span>
		</Button>
	{/if}
</div>
