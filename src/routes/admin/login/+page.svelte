<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { Input } from '#lib/components/ui/input/index.js';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import AuthCard from '#lib/components/admin/AuthCard.svelte';
	import FormField from '#lib/components/admin/FormField.svelte';
	import { inputClass, monoInputClass } from '#lib/components/admin/styles.ts';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();

	type Result = { stage?: 'email' | 'code'; email?: string; message?: string; errors?: Record<string, string> };
	const result = $derived(form as Result | null | undefined);

	const stage = $derived(result?.stage === 'code' ? 'code' : 'email');
	const email = $derived(result?.email ?? '');
	const errors = $derived(result?.errors ?? {});
	// Failures on the email step show above the forms; on the code step, under the code field.
	const notice = $derived(stage === 'email' && result?.message ? result.message : data.error);

	let pending = $state<'github' | 'google' | 'magic' | 'verify' | null>(null);

	const nextQuery = $derived(data.next !== '/admin' ? `?next=${encodeURIComponent(data.next)}` : '');

	/** Keep values, show the result, and track which button is busy. */
	function track(which: 'magic' | 'verify'): SubmitFunction {
		return () => {
			pending = which;
			return async ({ update }) => {
				await update({ reset: false });
				pending = null;
			};
		};
	}

	function onoauthsubmit(event: SubmitEvent) {
		const value = (event.submitter as HTMLButtonElement | null)?.value;
		// After the browser has read the form: a disabled submitter would drop `provider`.
		if (value === 'github' || value === 'google') setTimeout(() => (pending = value));
	}

	function onpageshow(event: PageTransitionEvent) {
		// Coming back from GitHub or Google with the Back button restores this page as it was.
		if (event.persisted) pending = null;
	}
</script>

<svelte:window {onpageshow} />

<svelte:head>
	<title>Sign in · EIC Admin</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AuthCard title="Sign in" description="Edit what visitors see on eicchula.club.">
	{#if notice}
		<div
			role="alert"
			class="rounded-sm border border-brand-text/50 bg-brand/10 px-3 py-2.5 text-[13px] leading-5 text-ink"
		>
			{notice}
		</div>
	{/if}

	{#if !data.configured}
		<div class="flex flex-col gap-2 rounded-sm border border-dashed border-line-strong p-4 text-[13px] leading-5 text-ink-muted">
			<p class="m-0 font-medium text-ink">Sign in is not set up yet</p>
			<p class="m-0">
				Add <code class="font-mono text-[12px] text-ink">SUPABASE_URL</code> and
				<code class="font-mono text-[12px] text-ink">SUPABASE_PUBLISHABLE_KEY</code> to the site's environment
				variables. The Supabase setup guide in <code class="font-mono text-[12px] text-ink">docs/</code> shows where to find them.
			</p>
			{#if data.dev}
				<p class="m-0">
					Working locally without Supabase? Set
					<code class="font-mono text-[12px] text-ink">DEV_AUTH_EMAIL</code> in
					<code class="font-mono text-[12px] text-ink">.env</code> to an email listed in
					<code class="font-mono text-[12px] text-ink">ADMIN_EMAILS</code> and restart
					<code class="font-mono text-[12px] text-ink">pnpm dev</code>.
				</p>
			{/if}
		</div>
	{:else if stage === 'code'}
		<div role="status" class="flex flex-col gap-1 rounded-sm border border-line bg-surface-100 px-3.5 py-3 text-[13px] leading-5">
			<span class="font-medium text-ink">Check your email</span>
			<span class="text-ink-muted">
				{result?.message ?? 'If this email is invited, a sign in link is on its way.'} Check
				<span class="text-ink">{email}</span>. The link works once and expires in one hour.
			</span>
		</div>

		<form method="POST" action="?/verify" class="flex flex-col gap-3" use:enhance={track('verify')}>
			<input type="hidden" name="email" value={email} />
			<input type="hidden" name="next" value={data.next} />
			<FormField
				label="Or enter the code from the email"
				error={errors.code ? (result?.message ?? errors.code) : null}
			>
				{#snippet children(attrs)}
					<Input
						{...attrs}
						name="code"
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength={12}
						placeholder="123456"
						class="{monoInputClass} tracking-[0.2em]"
						required
					/>
				{/snippet}
			</FormField>
			<AdminButton type="submit" pending={pending === 'verify'}>Sign in with the code</AdminButton>
		</form>

		<a
			href="/admin/login{nextQuery}"
			class="inline-flex min-h-11 items-center self-start text-[13px] text-ink-muted underline underline-offset-4 hover:text-ink"
		>
			Use a different email
		</a>
	{:else}
		<form method="POST" action="?/oauth" class="flex flex-col gap-[18px]" onsubmit={onoauthsubmit}>
			<input type="hidden" name="next" value={data.next} />
			<AdminButton
				type="submit"
				name="provider"
				value="github"
				variant="outline"
				class="w-full bg-surface-100 dark:bg-surface-100"
				pending={pending === 'github'}
				disabled={pending !== null}
			>
				Continue with GitHub
			</AdminButton>
			<AdminButton
				type="submit"
				name="provider"
				value="google"
				variant="outline"
				class="w-full bg-surface-100 dark:bg-surface-100"
				pending={pending === 'google'}
				disabled={pending !== null}
			>
				Continue with Google
			</AdminButton>
		</form>

		<div class="flex items-center gap-3 text-xs text-ink-muted" aria-hidden="true">
			<span class="h-px flex-1 bg-line"></span>or use your email<span class="h-px flex-1 bg-line"></span>
		</div>

		<form method="POST" action="?/magic" class="flex flex-col gap-3" use:enhance={track('magic')}>
			<input type="hidden" name="next" value={data.next} />
			<FormField label="Email" error={errors.email}>
				{#snippet children(attrs)}
					<Input
						{...attrs}
						type="email"
						name="email"
						autocomplete="email"
						placeholder="you@example.com"
						value={email}
						class={inputClass}
						required
					/>
				{/snippet}
			</FormField>
			<AdminButton type="submit" pending={pending === 'magic'} disabled={pending !== null}>
				Email me a sign in link
			</AdminButton>
			<span class="text-xs leading-[18px] text-ink-muted">
				No password. We send a one time link that signs you in.
			</span>
		</form>
	{/if}

	{#if data.devNotice}
		<p class="m-0 rounded-sm border border-dashed border-line-strong p-3 text-xs leading-[18px] text-ink-muted">
			<span class="font-medium text-ink">Dev:</span>
			{data.devNotice}
		</p>
	{:else if data.noBootstrap && data.configured}
		<p class="m-0 rounded-sm border border-dashed border-line-strong p-3 text-xs leading-[18px] text-ink-muted">
			<span class="font-medium text-ink">Dev:</span>
			ADMIN_EMAILS is empty, so nobody can sign in to a fresh database. Add your email to it in .env.
		</p>
	{/if}

	{#snippet footer()}
		Admins only. Ask the team leader to invite your account.
	{/snippet}
</AuthCard>
