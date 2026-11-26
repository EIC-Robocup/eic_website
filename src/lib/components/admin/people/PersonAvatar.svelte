<!--
	A small round headshot for the People list: the photo when there is one, else the initials
	in a dashed circle (as on the site's empty reticle).

	<PersonAvatar name={person.name} photoUrl={person.photoUrl} />
-->
<script lang="ts">
	import * as Avatar from '#lib/components/ui/avatar/index.js';
	import { initials } from '#lib/content/labels.ts';
	import { optimizedSrc } from '#lib/image.ts';
	import { cn } from '#lib/utils.js';

	type Props = { name: string; photoUrl?: string | null; class?: string };
	let { name, photoUrl, class: className }: Props = $props();
</script>

<Avatar.Root class={cn('size-[34px] after:border-0', className)}>
	{#if photoUrl}
		<Avatar.Image src={optimizedSrc(photoUrl, 96)} alt="" loading="lazy" class="border border-line" />
	{/if}
	<Avatar.Fallback
		class="border border-dashed border-line-strong bg-transparent font-sans text-xs font-semibold text-ink-muted"
		aria-hidden="true"
	>
		{initials(name) || '?'}
	</Avatar.Fallback>
</Avatar.Root>
