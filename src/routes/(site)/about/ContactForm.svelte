<!--
	The About page message form. Works without JavaScript (the browser checks the fields,
	the action answers with errors or the thank you note). With JavaScript it checks the
	fields first, shows errors next to them, and swaps in the thank you note in place.

	Controls are the shadcn-svelte Field, Input, Textarea, Select and Button with the EIC sizes.
	The topic is a native <select> in the server-rendered page and becomes the shadcn Select once
	the page is interactive and its code has loaded (a separate chunk, so other pages and the
	first load of this one don't carry it): the shadcn Select needs JavaScript to open, and this
	form must work without it. The Select submits through its hidden input under the same name.

	Errors are not alerts. After a send, focus moves to the first field with a problem (or to the
	form's message), and each field's error is its description, so it is read once, with the field.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from './$types';
	import { MESSAGE_TOPIC_LABELS, MESSAGE_TOPIC_OPTIONS } from '#lib/content/labels.ts';
	import type { MessageTopic } from '#lib/server/db/schema.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
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

	type SelectModule = typeof import('#lib/components/ui/select/index.js');
	let Select = $state<SelectModule | null>(null);

	$effect(() => {
		enhanced = true;
		import('#lib/components/ui/select/index.js').then(
			(module) => (Select = module),
			() => {
				// Offline or a stale deploy: the native select keeps working.
			}
		);
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
		const target = first ? document.getElementById(ids[first]) : formError ? formErrorEl : null;
		if (!target) return;
		// Already focused (Enter pressed in that field): focus it afresh so its error is read.
		if (document.activeElement === target) target.blur();
		target.focus();
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

	const fieldClass = 'min-w-0 gap-2';
	const labelClass = 'text-sm leading-5 font-medium text-ink';
	/** The EIC control: 48px tall, 6px radius, line-strong border on the page colour. */
	const controlClass =
		'min-h-12 rounded-sm border-line-strong bg-surface-100 px-3.5 py-3 text-base leading-6 text-ink shadow-none hover:border-ink md:text-base dark:bg-surface-100';
	const errorClass = 'm-0 text-sm leading-5 text-brand-text';
	const topicLabel = $derived(MESSAGE_TOPIC_LABELS[topic as MessageTopic] ?? 'Choose a topic');
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
		<Button variant="outline-ink" size="site-lg" onclick={sendAnother} class="mt-2">
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
				class="col-span-full m-0 rounded-sm border border-brand-text/60 px-4 py-3 text-sm leading-[22px] text-ink"
			>
				{formError}
			</p>
		{/if}

		<Field.Field class={fieldClass}>
			<Field.Label for={ids.name} class={labelClass}>Name</Field.Label>
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
			{#if errors.name}<Field.Error id={errorId('name')} role={undefined} class={errorClass}>{errors.name}</Field.Error>{/if}
		</Field.Field>

		<Field.Field class={fieldClass}>
			<Field.Label for={ids.email} class={labelClass}>Email</Field.Label>
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
			{#if errors.email}<Field.Error id={errorId('email')} role={undefined} class={errorClass}>{errors.email}</Field.Error>{/if}
		</Field.Field>

		<Field.Field class={cn('col-span-full', fieldClass)}>
			<Field.Label for={ids.topic} class={labelClass}>I am interested in</Field.Label>
			{#if Select}
				<Select.Root type="single" name={FIELD.topic} required bind:value={topic}>
					<Select.Trigger
						{...fieldAttrs('topic')}
						class={cn(
							controlClass,
							'w-full cursor-pointer justify-between gap-3 pr-4 pl-3.5 data-[size=default]:h-auto dark:hover:bg-surface-100 [&>svg]:size-3.5'
						)}
					>
						<span data-slot="select-value">{topicLabel}</span>
					</Select.Trigger>
					<Select.Content class="rounded-sm border border-line bg-surface-200 shadow-none ring-0">
						{#each MESSAGE_TOPIC_OPTIONS as option (option.value)}
							<Select.Item
								value={option.value}
								label={option.label}
								class="min-h-11 rounded-xs pl-3 text-base"
							/>
						{/each}
					</Select.Content>
				</Select.Root>
			{:else}
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
			{/if}
			{#if errors.topic}<Field.Error id={errorId('topic')} role={undefined} class={errorClass}>{errors.topic}</Field.Error>{/if}
		</Field.Field>

		<Field.Field class={cn('col-span-full', fieldClass)}>
			<Field.Label for={ids.message} class={labelClass}>Message</Field.Label>
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
			{#if errors.message}<Field.Error id={errorId('message')} role={undefined} class={errorClass}
					>{errors.message}</Field.Error
				>{/if}
		</Field.Field>

		<div class="col-span-full flex justify-end">
			<Button
				type="submit"
				variant="brand"
				size="site-lg"
				disabled={pending}
				class="w-full px-6 disabled:cursor-progress disabled:opacity-70 sm:w-auto"
			>
				{pending ? 'Sending…' : 'Send message'}
			</Button>
		</div>
	</form>
{/if}
