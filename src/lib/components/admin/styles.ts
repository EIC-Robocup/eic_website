/**
 * Class strings that size and colour shadcn-svelte controls for the admin panel: 44px high,
 * `surface-100` fill, `line-strong` border, 6px corners. Pass them as `class` to the ui
 * components; `cn()` inside them lets these win over the defaults.
 *
 *     <Input class={inputClass} name="title" />
 *     <Textarea class={textareaClass} name="excerpt" rows={3} />
 *     <Select.Trigger class={selectTriggerClass}>...</Select.Trigger>
 *
 * Inputs keep shadcn's 16px text below 768px (so iOS does not zoom in) and drop to 14px above.
 */

export const inputClass =
	'h-11 rounded-sm border-line-strong bg-surface-100 px-3 shadow-none dark:bg-surface-100 placeholder:text-ink-muted';

/** Big title input, as on the post editor (Space Grotesk 24px, 56px high). */
export const titleInputClass = `${inputClass} h-14 font-display text-2xl font-semibold tracking-[-0.01em] md:text-2xl`;

/** Monospace input for slugs, URLs, years and quantities. */
export const monoInputClass = `${inputClass} font-mono text-[13px] md:text-[13px]`;

export const textareaClass =
	'min-h-24 rounded-sm border-line-strong bg-surface-100 px-3 py-2.5 leading-6 shadow-none dark:bg-surface-100 placeholder:text-ink-muted';

export const selectTriggerClass =
	'w-full rounded-sm border-line-strong bg-surface-100 px-3 shadow-none data-[size=default]:h-11 dark:bg-surface-100 dark:hover:bg-surface-300';

/** Hint and help text under a control: 12/18, muted. */
export const hintClass = 'text-xs leading-[18px] font-normal text-ink-muted';

/** Field label: 13px, medium. */
export const labelClass = 'text-[13px] leading-5 font-medium text-ink';

/**
 * Column name above a field in a repeating row (ListEditor), for widths where the header row
 * is hidden. Hide it where the header row shows, e.g. `${rowLabelClass} sm:hidden`, and add
 * aria-hidden="true": the field's own aria-label ("Year of achievement 1") already names it.
 */
export const rowLabelClass = 'text-label text-[11px] leading-4 text-ink-muted';
