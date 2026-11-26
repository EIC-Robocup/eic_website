<script lang="ts">
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import AuthCard from '#lib/components/admin/AuthCard.svelte';

	let pending = $state(false);

	function onsubmit() {
		// After the browser has read the form, so the request is not affected.
		setTimeout(() => (pending = true));
	}

	function onpageshow(event: PageTransitionEvent) {
		if (event.persisted) pending = false;
	}
</script>

<svelte:window {onpageshow} />

<svelte:head>
	<title>Continue to sign in · EIC Admin</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AuthCard
	title="Continue to sign in"
	description="One more click and you are in the EIC Chula content editor."
>
	<!-- No action attribute: posts back to this URL, token and all. -->
	<form method="POST" class="flex flex-col gap-3" {onsubmit}>
		<AdminButton type="submit" {pending}>Continue to sign in</AdminButton>
		<span class="text-xs leading-[18px] text-ink-muted">
			This extra step stops email scanners from using up your one time link.
		</span>
	</form>

	{#snippet footer()}
		Not you? You can close this page. Nothing happens until you continue.
	{/snippet}
</AuthCard>
