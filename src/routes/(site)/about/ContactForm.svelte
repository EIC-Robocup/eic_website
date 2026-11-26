<!--
	The About page message form. Works without JavaScript (the browser checks the fields,
	the action answers with errors or the thank you note). With JavaScript it checks the
	fields first, shows errors next to them, and swaps in the thank you note in place.

	Controls are the shadcn-svelte Input, Textarea, Label and Button with the EIC sizes. The
	topic stays a native <select>: the shadcn Select needs JavaScript to open, and this form
	must work without it.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from './$types';
	import { MESSAGE_TOPIC_OPTIONS } from '#lib/content/labels.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { cn } from '#lib/utils.js';
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
	const fieldAttrs = (field: keyof typeof ids) => ({
		id: ids[field],
		'aria-invalid': errors[field] ? ('true' as const) : undefined,
		'aria-describedby': errors[field] ? errorId(field) : undefined
	});

	const unsentMessage = $derived(
		fallbackEmail
			? `We could not send your message just now. Try again in a minute, or email us at ${fallbackEmail}.`
			: 'We could not send your message just now. Try again in a minute.'
	);

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
				formError = unsentMessage;
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

	const fieldClass = 'flex min-w-0 flex-col gap-2';
	const labelClass = 'text-sm leading-5 font-medium text-ink';
	/** The EIC control: 48px tall, 6px radius, line-strong border on the page colour. */
	const controlClass =
		'min-h-12 rounded-sm border-line-strong bg-surface-100 px-3.5 py-3 text-base leading-6 text-ink shadow-none hover:border-ink md:text-base dark:bg-surface-100';
	const errorClass = 'm-0 text-sm leading-5 text-brand-text';
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
		<p class="m-0 max-w-[32em] text-base leading-[26px] text-ink-muted">
			Thanks. We read every message and reply within a week.
		</p>
		<Button
			variant="outline"
			onclick={sendAnother}
			class="mt-2 h-auto min-h-12 rounded-sm border-line-strong bg-transparent px-[22px] text-[15px] leading-5 text-ink shadow-none hover:border-ink hover:bg-transparent dark:border-line-strong dark:bg-transparent dark:hover:bg-transparent"
		>
			Send another message
		</Button>
	</div>
{:else}
	<form
		method="POST"
		action="#contact"
		novalidate={enhanced}
		aria-label="Send us a message"
		aria-busy={pending}
		use:enhance={submit}
		class="relative grid min-w-0 flex-[999_1_480px] grid-cols-1 gap-5 sm:grid-cols-2 self-start rounded-lg border border-line bg-surface-200 p-5 sm:p-8"
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

		<div class={fieldClass}>
			<Label for={ids.name} class={labelClass}>Name</Label>
			<Input
				{...fieldAttrs('name')}
				class={controlClass}
				type="text"
				name={FIELD.name}
				autocomplete="name"
				required
				maxlength={LIMITS.name}
				value={values.name}
			/>
			{#if errors.name}<p id={errorId('name')} class={errorClass}>{errors.name}</p>{/if}
		</div>

		<div class={fieldClass}>
			<Label for={ids.email} class={labelClass}>Email</Label>
			<Input
				{...fieldAttrs('email')}
				class={controlClass}
				type="email"
				name={FIELD.email}
				autocomplete="email"
				spellcheck="false"
				required
				maxlength={LIMITS.email}
				value={values.email}
			/>
			{#if errors.email}<p id={errorId('email')} class={errorClass}>{errors.email}</p>{/if}
		</div>

		<div class={['col-span-full', fieldClass]}>
			<Label for={ids.topic} class={labelClass}>I am interested in</Label>
			<div class="relative">
				<!-- Same look as the shadcn Input (focus ring, invalid state), but native. -->
				<select
					{...fieldAttrs('topic')}
					class={cn(
						'w-full min-w-0 cursor-pointer appearance-none border pr-11 transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
						controlClass
					)}
					name={FIELD.topic}
					required
					bind:value={topic}
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
			{#if errors.topic}<p id={errorId('topic')} class={errorClass}>{errors.topic}</p>{/if}
		</div>

		<div class={['col-span-full', fieldClass]}>
			<Label for={ids.message} class={labelClass}>Message</Label>
			<Textarea
				{...fieldAttrs('message')}
				class={cn(controlClass, 'field-sizing-fixed min-h-[148px] resize-y')}
				name={FIELD.message}
				rows={5}
				required
				minlength={LIMITS.messageMin}
				maxlength={LIMITS.messageMax}
				value={values.message}
			/>
			{#if errors.message}<p id={errorId('message')} class={errorClass}>{errors.message}</p>{/if}
		</div>

		<div class="col-span-full flex justify-end">
			<Button
				type="submit"
				disabled={pending}
				class="h-auto min-h-12 w-full rounded-sm px-6 text-[15px] leading-5 hover:bg-brand-hover disabled:cursor-progress disabled:opacity-70 sm:w-auto"
			>
				{pending ? 'Sending…' : 'Send message'}
			</Button>
		</div>
	</form>
{/if}
