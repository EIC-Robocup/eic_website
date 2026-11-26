<!--
	A list of short tags as removable chips with a text box. Enter or comma adds the typed
	tag, Backspace in the empty box removes the last one, pasting "a, b, c" adds three.
	Duplicates (ignoring case) are skipped. With `name`, every tag is submitted as its own
	`name=value` field; read them on the server with `readTags(form, name)` from form-data.ts.

	<FormField label="Tags" hint="Press Enter after each tag.">
		{#snippet children(attrs)}
			<TagsInput {...attrs} name="tags" bind:tags />
		{/snippet}
	</FormField>
-->
<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';

	type Props = {
		/** The tags. Bindable. */
		tags?: string[];
		/** Form field name for the hidden inputs (one per tag). */
		name?: string;
		placeholder?: string;
		/** Most tags allowed. */
		max?: number;
		/** Longest tag, in characters. */
		maxLength?: number;
		disabled?: boolean;
		/** id of the text box (FormField passes it). */
		id?: string;
		'aria-describedby'?: string;
		'aria-invalid'?: 'true' | 'false' | boolean;
		/** Accessible name when the box is not inside a FormField. */
		'aria-label'?: string;
		onchange?: (tags: string[]) => void;
		class?: string;
	};

	let {
		tags = $bindable([]),
		name,
		placeholder = 'Add a tag',
		max = 30,
		maxLength = 40,
		disabled = false,
		id,
		'aria-describedby': describedBy,
		'aria-invalid': invalid,
		'aria-label': ariaLabel,
		onchange,
		class: className
	}: Props = $props();

	let draft = $state('');
	let input: HTMLInputElement | undefined = $state();
	let announcement = $state('');

	const full = $derived(tags.length >= max);

	function commit(raw: string): boolean {
		const parts = raw
			.split(',')
			.map((t) => t.trim().replace(/\s+/g, ' ').slice(0, maxLength))
			.filter(Boolean);
		if (!parts.length) return false;
		const next = [...tags];
		const added: string[] = [];
		for (const part of parts) {
			if (next.length >= max) break;
			if (next.some((t) => t.toLowerCase() === part.toLowerCase())) continue;
			next.push(part);
			added.push(part);
		}
		if (!added.length) {
			// Everything typed is already there (or the list is full): clear the box anyway.
			announcement = next.length >= max ? `Up to ${max} tags` : `${parts.join(', ')} is already added`;
			return true;
		}
		tags = next;
		announcement = `Added ${added.join(', ')}`;
		onchange?.(tags);
		return true;
	}

	function remove(index: number, refocus = true) {
		const removed = tags[index];
		tags = tags.filter((_, i) => i !== index);
		announcement = `Removed ${removed}`;
		onchange?.(tags);
		if (refocus) input?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.isComposing) return;
		if (event.key === 'Enter' || event.key === ',') {
			// Never submit the surrounding form from here.
			event.preventDefault();
			if (commit(draft)) draft = '';
		} else if (event.key === 'Backspace' && draft === '' && tags.length) {
			event.preventDefault();
			remove(tags.length - 1);
		}
	}

	function onpaste(event: ClipboardEvent) {
		const text = event.clipboardData?.getData('text') ?? '';
		if (!text.includes(',') && !text.includes('\n')) return;
		event.preventDefault();
		commit(text.replace(/\n/g, ','));
	}

	function onblur() {
		if (commit(draft)) draft = '';
	}
</script>

<div
	class={[
		'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-sm border border-line-strong bg-surface-100 px-2 py-1.5',
		'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
		invalid === true || invalid === 'true' ? 'border-brand-text' : '',
		disabled && 'opacity-50',
		className
	]}
>
	{#each tags as tag, i (tag)}
		<span
			class="inline-flex min-h-[30px] max-w-full items-center gap-1 rounded-sm border border-line bg-surface-200 py-0.5 pr-0.5 pl-2 text-xs leading-4 text-ink"
		>
			<span class="truncate">{tag}</span>
			<button
				type="button"
				class="-my-1 inline-flex size-7 shrink-0 items-center justify-center rounded-xs text-ink-muted transition-colors hover:bg-surface-300 hover:text-ink"
				aria-label="Remove {tag}"
				{disabled}
				onclick={() => remove(i)}
			>
				<XIcon class="size-3.5" aria-hidden="true" />
			</button>
		</span>
		{#if name}<input type="hidden" {name} value={tag} />{/if}
	{/each}
	<input
		bind:this={input}
		bind:value={draft}
		{id}
		type="text"
		class="h-8 min-w-[10ch] flex-1 border-0 bg-transparent px-1 text-base text-ink outline-none placeholder:text-ink-muted/70 md:text-sm"
		placeholder={full ? `Up to ${max} tags` : placeholder}
		{disabled}
		maxlength={maxLength * 4}
		autocomplete="off"
		enterkeyhint="done"
		aria-describedby={describedBy}
		aria-invalid={invalid}
		aria-label={ariaLabel}
		{onkeydown}
		{onpaste}
		{onblur}
	/>
	<span class="sr-only" aria-live="polite">{announcement}</span>
</div>
