<!--
	"Embed video": asks for a YouTube or Vimeo link, checks it, and hands it back with `oninsert`.
	The editor puts the link alone on its own line, where it becomes a player.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import AdminButton from '../AdminButton.svelte';
	import FormField from '../FormField.svelte';
	import { monoInputClass } from '../styles.ts';
	import { videoEmbed } from './markdown-commands.ts';

	type Props = {
		open?: boolean;
		/** Prefilled link (e.g. the selected text). */
		initial?: string;
		oninsert: (url: string) => void;
		/** Called when the dialog closes; return focus yourself and call `event.preventDefault()`. */
		onCloseAutoFocus?: (event: Event) => void;
	};

	let { open = $bindable(false), initial = '', oninsert, onCloseAutoFocus }: Props = $props();

	let url = $state('');
	let error = $state<string | null>(null);
	let input: HTMLInputElement | null = $state(null);

	$effect(() => {
		if (open) {
			url = initial;
			error = null;
			void tick().then(() => input?.select());
		}
	});

	const detected = $derived(videoEmbed(url));

	function submit(event: SubmitEvent) {
		event.preventDefault();
		// Never submit the post form around the editor.
		event.stopPropagation();
		const value = url.trim();
		if (!value) {
			error = 'Paste a YouTube or Vimeo link.';
			input?.focus();
			return;
		}
		const embed = videoEmbed(value);
		if (!embed) {
			error = 'That is not a YouTube or Vimeo video link. Copy the link from the address bar or the Share button.';
			input?.focus();
			return;
		}
		open = false;
		oninsert(value);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="border border-line bg-surface-200 sm:max-w-md" {onCloseAutoFocus}>
		<Dialog.Header>
			<Dialog.Title class="font-display text-lg font-semibold">Embed a video</Dialog.Title>
			<Dialog.Description class="text-sm leading-[22px] text-ink-muted">
				The link goes on its own line and shows as a player. It loads only when a reader presses play.
			</Dialog.Description>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={submit} novalidate>
			<FormField
				label="YouTube or Vimeo link"
				{error}
				hint={detected
					? `${detected.kind === 'youtube' ? 'YouTube' : 'Vimeo'} video ${detected.id}. Add &t=90 to start at 1:30.`
					: 'For example https://www.youtube.com/watch?v=… or https://vimeo.com/…'}
			>
				{#snippet children(attrs)}
					<Input
						{...attrs}
						bind:ref={input}
						bind:value={url}
						type="url"
						inputmode="url"
						autocomplete="off"
						spellcheck={false}
						placeholder="https://youtu.be/…"
						class={monoInputClass}
						oninput={() => (error = null)}
					/>
				{/snippet}
			</FormField>
			<Dialog.Footer class="gap-2">
				<AdminButton variant="outline" onclick={() => (open = false)}>Cancel</AdminButton>
				<AdminButton type="submit">Insert video</AdminButton>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
