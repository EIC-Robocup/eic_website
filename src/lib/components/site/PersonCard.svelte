<!--
	Person card from the People page: a dashed reticle avatar (photo or initials), the
	name and the role (in brand-text for leads). Links to `profileUrl` when there is one;
	otherwise it is a plain figure, not a link.
	size 'md' is the People grid (112px reticle); 'sm' is the home page strip (96px).
-->
<script lang="ts" module>
	export type PersonCardData = {
		name: string;
		role?: string | null;
		teamName?: string | null;
		isLead?: boolean;
		photoUrl?: string | null;
		profileUrl?: string | null;
	};
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js';
	import { optimizedSrc } from '#lib/image.ts';
	import { initials, isExternal } from './format.ts';

	type Props = {
		person: PersonCardData;
		size?: 'md' | 'sm';
		/** Override the link (e.g. the home strip links everyone to /people). */
		href?: string | null;
		class?: string;
	};

	let { person, size = 'md', href, class: className }: Props = $props();

	const link = $derived(href ?? person.profileUrl ?? null);
	const external = $derived(isExternal(link));
	const role = $derived(
		person.role?.trim() || (person.teamName ? `${person.teamName} team` : '')
	);
	const md = $derived(size === 'md');
	/**
	 * The photo is shown at 92px (76px in the home strip): the smallest optimised width (320px)
	 * covers it at 3x, so one candidate is enough (#lib/image.ts; other links pass through).
	 */
	const photo = $derived(optimizedSrc(person.photoUrl, 320));
</script>

{#snippet body()}
	<span
		class={cn(
			'flex shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong transition-colors duration-150',
			md ? 'size-28' : 'size-24',
			link && 'group-hover:border-ink'
		)}
	>
		{#if photo}
			<img
				src={photo}
				alt=""
				width={md ? 92 : 76}
				height={md ? 92 : 76}
				loading="lazy"
				decoding="async"
				class={cn('rounded-full object-cover', md ? 'size-[92px]' : 'size-[76px]')}
			/>
		{:else}
			<span
				aria-hidden="true"
				class={cn(
					'flex items-center justify-center rounded-full font-display font-semibold text-ink-muted',
					md ? 'size-[92px] bg-surface-200 text-[26px]' : 'size-[76px] bg-surface-300 text-[22px]'
				)}>{initials(person.name)}</span
			>
		{/if}
	</span>
	<svelte:element this={link ? 'span' : 'figcaption'} class="flex flex-col gap-0.5">
		<span class={cn('text-[15px] font-semibold', md ? 'leading-[21px]' : 'leading-5')}
			>{person.name}</span
		>
		{#if role}
			<span
				class={cn('text-[13px] leading-5', person.isLead ? 'text-brand-text' : 'text-ink-muted')}
				>{role}</span
			>
		{/if}
	</svelte:element>
{/snippet}

{#if link}
	<a
		href={link}
		rel={external ? 'noopener noreferrer' : undefined}
		class={cn('group flex flex-col gap-3 text-ink no-underline', className)}
	>
		{@render body()}
	</a>
{:else}
	<figure class={cn('m-0 flex flex-col gap-3 text-ink', className)}>
		{@render body()}
	</figure>
{/if}
