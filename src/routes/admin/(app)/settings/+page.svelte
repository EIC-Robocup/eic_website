<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { EDITOR_ROLE_LABELS } from '#lib/content/labels.ts';
	import AdminButton from '#lib/components/admin/AdminButton.svelte';
	import ConfirmDelete from '#lib/components/admin/ConfirmDelete.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import FormField from '#lib/components/admin/FormField.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Panel from '#lib/components/admin/Panel.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { AdminForm } from '#lib/components/admin/form.svelte.ts';
	import { formatDateTime, isoString, timeAgo } from '#lib/components/admin/sections/time.ts';
	import { inputClass, selectTriggerClass } from '#lib/components/admin/styles.ts';
	import RoleSelect from './RoleSelect.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	let now = $state(untrack(() => data.now));
	$effect(() => {
		now = new Date();
	});

	const DOCS = 'https://github.com/EIC-Robocup/eic_website/blob/main/docs';
	const loginUrl = $derived(`${page.url.origin}/admin/login`);

	let inviteRole = $state<'editor' | 'owner'>('editor');
	const invite = new AdminForm({
		reset: true,
		onSuccess: () => {
			inviteRole = 'editor';
		}
	});

	async function copyLoginUrl() {
		try {
			await navigator.clipboard.writeText(loginUrl);
			toast.success('Sign in link copied.');
		} catch {
			toast.error(`Could not copy. The link is ${loginUrl}`);
		}
	}

	const nameOf = (e: { name: string | null; email: string }) => e.name?.trim() || e.email;
	/** An email split after the @ and before each dot, so it wraps there on phones. */
	const emailParts = (email: string) => email.split(/(?<=@)|(?=\.)/);
</script>

{#snippet wrappable(text: string)}
	{#each emailParts(text) as part, i (i)}{#if i}<wbr />{/if}{part}{/each}
{/snippet}

<PageHeader
	breadcrumb={[{ label: 'Library' }, { label: 'Settings' }]}
	title="Settings"
	description="Who can sign in to the admin panel, and whether the site's services are working."
/>

<div class="flex flex-wrap items-start gap-6">
	<div class="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
		<Panel
			title="Editors"
			padding="none"
			stacked
			description={data.canManage
				? 'Editors can change everything on the site. Owners can also invite and remove editors.'
				: 'Only owners can invite people or change roles.'}
		>
			{#if data.editors.length}
				<Table.Root class="table-fixed">
					<Table.Header>
						<Table.Row class="border-0 border-t border-line hover:bg-transparent">
							<Table.Head class="text-label h-9 px-4 text-[11px] font-medium text-ink-muted sm:px-[18px]">Editor</Table.Head>
							<Table.Head class="text-label h-9 w-[112px] px-2 text-[11px] font-medium text-ink-muted sm:w-[140px]">Role</Table.Head>
							<Table.Head class="text-label hidden h-9 w-[130px] px-2 text-[11px] font-medium text-ink-muted sm:table-cell">
								Last sign in
							</Table.Head>
							{#if data.canManage}
								<Table.Head class="h-9 w-[56px] px-1 sm:w-[68px] sm:pr-[18px]"><span class="sr-only">Remove</span></Table.Head>
							{/if}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.editors as editor (editor.id)}
							{@const isYou = editor.id === data.me.id}
							<Table.Row class="border-0 border-t border-line hover:bg-surface-300/40">
								<Table.Cell class="max-w-0 px-4 py-3 whitespace-normal sm:px-[18px]">
									<div class="flex min-w-0 flex-col gap-0.5">
										<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
											<span class="min-w-0 text-sm font-medium text-ink [overflow-wrap:anywhere] sm:truncate">{@render wrappable(nameOf(editor))}</span>
											{#if isYou}<StatusBadge label="You" tone="neutral" class="h-5 px-2" />{/if}
											{#if editor.alwaysAllowed}
												<StatusBadge label="ADMIN_EMAILS" tone="neutral" class="h-5 px-2 font-mono text-[11px]" />
											{/if}
										</span>
										{#if editor.name?.trim()}
											<span class="text-xs leading-[18px] text-ink-muted [overflow-wrap:anywhere] sm:truncate">{@render wrappable(editor.email)}</span>
										{/if}
										<span class="text-xs leading-[18px] text-ink-muted sm:hidden">
											{editor.lastSignInAt ? `Signed in ${timeAgo(editor.lastSignInAt, now, { lower: true })}` : 'Not signed in yet'}
										</span>
									</div>
								</Table.Cell>
								<Table.Cell class="px-2 py-3">
									{#if data.canManage && !isYou}
										<RoleSelect id={editor.id} role={editor.role} name={nameOf(editor)} />
									{:else}
										<StatusBadge
											label={EDITOR_ROLE_LABELS[editor.role]}
											tone={editor.role === 'owner' ? 'success' : 'neutral'}
										/>
									{/if}
								</Table.Cell>
								<Table.Cell class="hidden px-2 py-3 text-sm text-ink-muted sm:table-cell">
									{#if editor.lastSignInAt}
										<time datetime={isoString(editor.lastSignInAt)} title={formatDateTime(editor.lastSignInAt)}>
											{timeAgo(editor.lastSignInAt, now)}
										</time>
									{:else}
										Not yet
									{/if}
								</Table.Cell>
								{#if data.canManage}
									<Table.Cell class="px-1 py-3 text-right sm:px-2 sm:pr-[18px]">
										{#if !isYou}
											<ConfirmDelete
												action="?/remove"
												id={editor.id}
												title="Remove {nameOf(editor)}?"
												description={editor.alwaysAllowed
													? 'They lose access straight away. Their email is also in ADMIN_EMAILS, so they become an owner again when they next sign in: remove it from the environment variables as well.'
													: 'They lose access to the admin panel straight away. You can invite them again later.'}
												confirmLabel="Remove editor"
												success="Editor removed."
											>
												{#snippet trigger(props)}
													<AdminButton {...props} variant="ghost" size="icon" aria-label="Remove {nameOf(editor)}">
														<Trash2Icon aria-hidden="true" />
													</AdminButton>
												{/snippet}
											</ConfirmDelete>
										{/if}
									</Table.Cell>
								{/if}
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<div class="border-t border-line p-4 sm:p-[18px]">
					<EmptyState
						compact
						icon={UsersIcon}
						title={data.status.database ? 'No editors yet' : 'Editors could not be loaded'}
						description={data.status.database
							? 'People listed in ADMIN_EMAILS join this list when they first sign in.'
							: 'The database did not answer. See Site status.'}
					/>
				</div>
			{/if}
		</Panel>

		{#if data.canManage}
			<Panel title="Invite someone" description="Add their email, then send them the sign in link. Nothing is emailed from here.">
				<form method="POST" action="?/invite" use:enhance={invite.submit} class="flex flex-col gap-4" novalidate>
					<div class="grid gap-4 sm:grid-cols-2">
						<FormField label="Email" error={invite.errors.email} hint="The address of their GitHub or Google account, or the inbox for sign in links.">
							{#snippet children(attrs)}
								<Input
									{...attrs}
									name="email"
									type="email"
									autocomplete="off"
									spellcheck={false}
									placeholder="name@example.com"
									maxlength={254}
									required
									class={inputClass}
								/>
							{/snippet}
						</FormField>
						<FormField label="Name" optional error={invite.errors.name} hint="Shown in Recent edits.">
							{#snippet children(attrs)}
								<Input {...attrs} name="name" autocomplete="off" maxlength={100} class={inputClass} />
							{/snippet}
						</FormField>
					</div>
					<div class="flex flex-wrap items-end justify-between gap-4">
						<FormField label="Role" error={invite.errors.role} class="w-full sm:w-[220px]">
							{#snippet children(attrs)}
								<Select.Root type="single" name="role" bind:value={inviteRole}>
									<Select.Trigger id={attrs.id} aria-describedby={attrs['aria-describedby']} class={selectTriggerClass}>
										{EDITOR_ROLE_LABELS[inviteRole]}
									</Select.Trigger>
									<Select.Content class="border border-line bg-surface-200">
										<Select.Item value="editor" label="Editor" class="min-h-10" />
										<Select.Item value="owner" label="Owner" class="min-h-10" />
									</Select.Content>
								</Select.Root>
							{/snippet}
						</FormField>
						<AdminButton type="submit" pending={invite.pending} pendingLabel="Inviting">Invite</AdminButton>
					</div>
				</form>
			</Panel>
		{/if}
	</div>

	<aside class="flex min-w-0 flex-[1_1_300px] flex-col gap-6" aria-label="Help and status">
		<Panel title="How sign in works" size="sm" padding="sm">
			<div class="flex flex-col gap-2.5 text-[13px] leading-5 text-ink-muted">
				<p class="m-0">There are no passwords. Invited people open the sign in page and either:</p>
				<ul class="m-0 flex list-disc flex-col gap-1 pl-5">
					<li>continue with <span class="text-ink">GitHub</span> or <span class="text-ink">Google</span>, using an account with the same email, or</li>
					<li>ask for a <span class="text-ink">sign in link</span> by email (the email also has a 6 digit code).</li>
				</ul>
				<p class="m-0">Anyone not on the list is turned away, and removing someone ends their access at once.</p>
			</div>
			<div class="flex min-w-0 items-center gap-2 rounded-sm border border-line bg-surface-100 py-1 pr-1 pl-3">
				<span class="min-w-0 flex-1 truncate font-mono text-xs text-ink">{loginUrl}</span>
				<AdminButton variant="ghost" size="sm" onclick={copyLoginUrl} aria-label="Copy the sign in link">
					<CopyIcon aria-hidden="true" />Copy
				</AdminButton>
			</div>
		</Panel>

		<Panel title="Site status" size="sm" padding="sm">
			<ul class="m-0 flex list-none flex-col p-0">
				<li class="flex items-start justify-between gap-3 py-2.5">
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="text-sm font-medium text-ink">Database</span>
						<span class="text-xs leading-[18px] text-ink-muted">
							{data.status.database ? 'Pages and content load from Postgres.' : 'Check DATABASE_URL.'}
						</span>
					</span>
					<StatusBadge
						dot
						label={data.status.database ? 'Working' : 'Unreachable'}
						tone={data.status.database ? 'success' : 'brand'}
					/>
				</li>
				<li class="flex items-start justify-between gap-3 border-t border-line py-2.5">
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="text-sm font-medium text-ink">Sign in</span>
						<span class="text-xs leading-[18px] text-ink-muted">
							{#if data.status.auth}
								Supabase Auth is set up.
							{:else}
								Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.
							{/if}
							{#if data.status.devSignIn}
								Local dev: DEV_AUTH_EMAIL signs you in as {data.status.devSignIn}.
							{/if}
						</span>
					</span>
					<StatusBadge
						dot
						label={data.status.auth ? 'Set up' : 'Not set up'}
						tone={data.status.auth ? 'success' : 'neutral'}
					/>
				</li>
				<li class="flex items-start justify-between gap-3 border-t border-line py-2.5">
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="text-sm font-medium text-ink">Uploads</span>
						<span class="text-xs leading-[18px] text-ink-muted">
							{#if !data.storageCheck}
								Add SUPABASE_URL and SUPABASE_SECRET_KEY.
							{:else}
								{#await data.storageCheck}
									Checking Supabase Storage.
								{:then check}
									{check.message}
								{/await}
							{/if}
						</span>
					</span>
					{#if !data.storageCheck}
						<StatusBadge dot label="Not set up" tone="neutral" />
					{:else}
						{#await data.storageCheck}
							<Spinner class="mt-1 size-4 text-ink-muted" aria-label="Checking uploads" />
						{:then check}
							<StatusBadge dot label={check.ok ? 'Working' : 'Problem'} tone={check.ok ? 'success' : 'brand'} />
						{/await}
					{/if}
				</li>
			</ul>
			<div class="flex flex-col gap-2 border-t border-line pt-3.5">
				<p class="m-0 text-xs leading-[18px] text-ink-muted">Setting something up? The guides walk through it.</p>
				<div class="flex flex-wrap gap-2">
					<AdminButton variant="outline" size="sm" href="{DOCS}/setup-supabase.md" external>Supabase guide</AdminButton>
					<AdminButton variant="outline" size="sm" href="{DOCS}/setup-vercel.md" external>Vercel guide</AdminButton>
				</div>
			</div>
		</Panel>
	</aside>
</div>
