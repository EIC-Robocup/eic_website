<!--
	Share row: Facebook (a plain link, so it works without JavaScript), copy link with an
	inline "Copied" state, and the system share sheet where the browser has one.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	type Props = { url: string; title: string; text?: string | null };
	let { url, title, text }: Props = $props();

	const facebook = $derived(
		`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
	);

	let canShare = $state(false);
	let copied = $state(false);
	let copyFailed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		canShare = typeof navigator.share === 'function';
		return () => clearTimeout(timer);
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
		copied = ok;
		copyFailed = !ok;
		clearTimeout(timer);
		timer = setTimeout(() => {
			copied = false;
			copyFailed = false;
		}, 2500);
	}

	async function share() {
		try {
			await navigator.share({ title, text: text ?? undefined, url });
		} catch {
			// Closing the share sheet rejects; nothing to do.
		}
	}

	const button =
		'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sm border border-line-strong bg-transparent px-3.5 text-sm leading-5 text-ink no-underline transition-colors duration-150 hover:border-ink';
</script>

<div class="flex flex-wrap items-center gap-2">
	<span class="pr-1 text-sm text-ink-muted">Share</span>
	<a href={facebook} target="_blank" rel="noopener noreferrer" class={button}
		>Facebook<span class="sr-only"> (opens in a new tab)</span></a
	>
	<button type="button" onclick={copy} class={[button, 'min-w-[96px]']}>
		{copied ? 'Copied' : copyFailed ? 'Copy failed' : 'Copy link'}
	</button>
	{#if canShare}
		<button type="button" onclick={share} class={button}>
			More<span class="sr-only"> ways to share</span>
		</button>
	{/if}
	<span class="sr-only" aria-live="polite"
		>{copied ? 'Link copied' : copyFailed ? 'Could not copy the link' : ''}</span
	>
</div>
