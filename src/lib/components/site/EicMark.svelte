<!--
	The EIC letter mark: the club logo's "EIC" without the "Engineering Innovator Club" line.
	Drawn on a 23 by 12 grid (each unit is one stroke half-width), so it stays crisp at any size.
	It takes the text colour (`currentColor`); size it by height, e.g. `class="h-6 w-auto"`.
	Decorative by default: the link or heading around it carries the name.
-->
<script lang="ts">
	type Props = {
		class?: string;
		/** Set when the mark stands alone and must be read out, e.g. "EIC". */
		title?: string;
	};

	let { class: className, title }: Props = $props();
</script>

<svg
	viewBox="0 0 23 12"
	fill="currentColor"
	class={className}
	role={title ? 'img' : undefined}
	aria-label={title}
	aria-hidden={title ? undefined : 'true'}
	focusable="false"
>
	<path d="M0 2h7l2-2H2zM0 5v7h7l2-2H2V7h5l2-2zM11 0v12h2V0zM17 0l-2 2v10h6l2-2h-6V2h4l2-2z" />
</svg>
