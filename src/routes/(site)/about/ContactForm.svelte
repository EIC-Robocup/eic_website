<!--
	The About page message form. Works without JavaScript (the browser checks the fields,
	the action answers with errors or the thank you note). With JavaScript it checks the
	fields first, shows errors next to them, and swaps in the thank you note in place.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { MESSAGE_TOPIC_OPTIONS } from '#lib/content/labels.ts';
	import {
		FIELD,
		FIELD_ORDER,
		LIMITS,
		readValues,
		validate,
		type ContactErrors,
		type ContactFailure,
		type ContactValues
	} from './contact.ts';

	type Props = {
		/** The action's result: the thank you flag, or errors with the values echoed back. */
		result: { success: true } | ContactFailure | null | undefined;
		/** Signed render time from the load. */
		token: string;
		/** Preselected topic (from ?topic= or the join cards). */
		topic: string;
		/** Shown when sending fails outright. */
		fallbackEmail?: string;
	};

	let { result, token, topic: initialTopic, fallbackEmail }: Props = $props();

	const failure = $derived(result && 'values' in result ? result : null);
	const values = $derived<ContactValues>(
		failure?.values ?? { name: '', email: '', topic: initialTopic, message: '' }
	);

	// Server results arrive through `result`; local checks and "send another" override them.
	let sent = $derived(result != null && 'success' in result && result.success === true);
	let errors = $derived<ContactErrors>(failure?.errors ?? {});
	let formError = $derived(failure?.formError ?? '');
	let topic = $derived(failure?.values.topic || initialTopic);
	const currentToken = $derived(failure?.token || token);

	let pending = $state(false);
	let enhanced = $state(false);
	let thanksHeading = $state<HTMLElement>();
	let formErrorEl = $state<HTMLElement>();

	$effect(() => {
		enhanced = true;
	});

	const ids = {
		name: 'contact-name',
		email: 'contact-email',
		topic: 'contact-topic',
		message: 'contact-message'
	} as const;
	const errorId = (field: keyof typeof ids) => `${ids[field]}-error`;

	async function focusProblem() {
		await tick();
		const first = FIELD_ORDER.find((f) => errors[f]);
		if (first) document.getElementById(ids[first])?.focus();
		else if (formError) formErrorEl?.focus();
	}

	const submit: SubmitFunction = ({ formData, cancel }) => {
		const local = validate(readValues(formData));
		if (Object.keys(local).length > 0) {
			cancel();
			errors = local;
			formError = '';
			void focusProblem();
			return;
		}
		errors = {};
		formError = '';
		pending = true;

		return async ({ result: res, update }) => {
			pending = false;
			if (res.type === 'error') {
				formError = fallbackEmail
					? `We could not send your message just now. Try again in a minute, or email us at ${fallbackEmail}.`
					: 'We could not send your message just now. Try again in a minute.';
				void focusProblem();
				return;
			}
			// Stay on this page and keep what was typed; the thank you note replaces the form.
			await update({ reset: false, navigate: false, refreshAll: false });
			if (res.type === 'success') {
				await tick();
				thanksHeading?.focus();
			} else if (res.type === 'failure') {
				void focusProblem();
			}
		};
	};

	async function sendAnother() {
		sent = false;
		errors = {};
		formError = '';
		await tick();
		document.getElementById(ids.name)?.focus();
	}

	const label = 'flex flex-col gap-2';
	const labelText = 'text-sm leading-5 font-medium text-ink';
	const control =
		'block min-h-12 w-full rounded-sm border border-line-strong bg-surface-100 px-3.5 py-3 text-base leading-6 text-ink transition-colors duration-150 placeholder:text-ink-muted hover:border-ink aria-invalid:border-brand-text';
	const errorText = 'text-sm leading-5 text-brand-text';
</script>

{#if sent}
	<div
		class="flex min-w-0 flex-[999_1_480px] flex-col items-start gap-4 self-start rounded-lg border border-line bg-surface-200 p-6 sm:p-8"
	>
		<svg
			width="40"
			height="40"
			viewBox="0 0 40 40"
			fill="none"
			stroke="var(--eic-success)"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="20" cy="20" r="18" />
			<path d="M12.5 20.5 L17.5 25.5 L27.5 15" />
		</svg>
		<h3
			bind:this={thanksHeading}
			tabindex="-1"
			class="font-display text-[28px] leading-8 font-semibold tracking-[-0.02em] text-ink"
		>
			Message sent.
		</h3>
		<p class="m-0 max-w-[32em] text-base leading-[26px] text-ink-muted" role="status">
			Thanks. We read every message and reply within a week.
		</p>
		<button
			type="button"
			onclick={sendAnother}
			class="mt-2 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-sm border border-line-strong px-[22px] text-[15px] leading-5 font-medium text-ink transition-colors duration-150 hover:border-ink"
		>
			Send another message
		</button>
	</div>
{:else}
	<form
		method="POST"
		action="#contact"
		novalidate={enhanced}
		aria-label="Send us a message"
		aria-busy={pending}
		use:enhance={submit}
		class="relative grid min-w-0 flex-[999_1_480px] grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-5 self-start rounded-lg border border-line bg-surface-200 p-5 sm:p-8"
	>
		<input type="hidden" name={FIELD.token} value={currentToken} />

		<!-- Honeypot: hidden from people and screen readers; bots tend to fill it in. -->
		<div class="sr-only" aria-hidden="true">
			<label>
				Website
				<input type="text" name={FIELD.honeypot} tabindex="-1" autocomplete="off" value="" />
			</label>
		</div>

		{#if formError}
			<p
				bind:this={formErrorEl}
				tabindex="-1"
				role="alert"
				class="col-span-full m-0 rounded-sm border border-brand-text/60 px-4 py-3 text-sm leading-[22px] text-ink"
			>
				{formError}
			</p>
		{/if}

		<div class={label}>
			<label for={ids.name} class={labelText}>Name</label>
			<input
				id={ids.name}
				class={control}
				type="text"
				name={FIELD.name}
				autocomplete="name"
				required
				maxlength={LIMITS.name}
				value={values.name}
				aria-invalid={errors.name ? 'true' : undefined}
				aria-describedby={errors.name ? errorId('name') : undefined}
			/>
			{#if errors.name}<p id={errorId('name')} class={errorText}>{errors.name}</p>{/if}
		</div>

		<div class={label}>
			<label for={ids.email} class={labelText}>Email</label>
			<input
				id={ids.email}
				class={control}
				type="email"
				name={FIELD.email}
				autocomplete="email"
				inputmode="email"
				spellcheck="false"
				required
				maxlength={LIMITS.email}
				value={values.email}
				aria-invalid={errors.email ? 'true' : undefined}
				aria-describedby={errors.email ? errorId('email') : undefined}
			/>
			{#if errors.email}<p id={errorId('email')} class={errorText}>{errors.email}</p>{/if}
		</div>

		<div class={['col-span-full', label]}>
			<label for={ids.topic} class={labelText}>I am interested in</label>
			<div class="relative">
				<select
					id={ids.topic}
					class={[control, 'cursor-pointer appearance-none pr-11']}
					name={FIELD.topic}
					required
					bind:value={topic}
					aria-invalid={errors.topic ? 'true' : undefined}
					aria-describedby={errors.topic ? errorId('topic') : undefined}
				>
					{#each MESSAGE_TOPIC_OPTIONS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				<svg
					class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
					width="14"
					height="14"
					viewBox="0 0 14 14"
					fill="none"
					stroke="var(--eic-ink-muted)"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"><path d="M3 5.5 L7 9.5 L11 5.5" /></svg
				>
			</div>
			{#if errors.topic}<p id={errorId('topic')} class={errorText}>{errors.topic}</p>{/if}
		</div>

		<div class={['col-span-full', label]}>
			<label for={ids.message} class={labelText}>Message</label>
			<textarea
				id={ids.message}
				class={[control, 'resize-y']}
				name={FIELD.message}
				rows="5"
				required
				minlength={LIMITS.messageMin}
				maxlength={LIMITS.messageMax}
				value={values.message}
				aria-invalid={errors.message ? 'true' : undefined}
				aria-describedby={errors.message ? errorId('message') : undefined}
			></textarea>
			{#if errors.message}<p id={errorId('message')} class={errorText}>{errors.message}</p>{/if}
		</div>

		<div class="col-span-full flex justify-end">
			<button
				type="submit"
				disabled={pending}
				class="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-sm bg-brand px-6 text-[15px] leading-5 font-medium text-on-brand transition-colors duration-150 hover:bg-brand-hover disabled:cursor-progress disabled:opacity-70 sm:w-auto"
			>
				{pending ? 'Sending…' : 'Send message'}
			</button>
		</div>
	</form>
{/if}
