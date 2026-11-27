/**
 * One admin form's submit state, for `use:enhance`. Wraps `toastEnhance` (see enhance.ts) and
 * keeps `pending`, the field `errors` and the last `message` as $state, so several forms on
 * one page (a save form and a delete form) never share errors.
 *
 *     <script lang="ts">
 *       import { enhance } from '$app/forms';
 *       import { AdminForm } from '#lib/components/admin/form.svelte.ts';
 *       const save = new AdminForm({ success: 'Project saved.' });
 *     </script>
 *
 *     <form method="POST" action="?/save" use:enhance={save.submit}>
 *       <FormField label="Title" error={save.errors.title}>...</FormField>
 *       <AdminButton type="submit" pending={save.pending}>Save project</AdminButton>
 *     </form>
 */
import type { SubmitFunction } from '$app/forms';
import { readErrors, toastEnhance, type ToastEnhanceOptions } from './enhance.ts';

export class AdminForm {
	/** True while the form is submitting. */
	pending = $state(false);
	/** Field errors from the last failure, keyed by field name. Cleared on success. */
	errors = $state<Record<string, string>>({});
	/** `message` from the last result, if any. */
	message = $state<string | null>(null);
	/** Pass to `use:enhance`. */
	readonly submit: SubmitFunction;

	constructor(options: ToastEnhanceOptions = {}) {
		this.submit = toastEnhance({
			...options,
			onPending: (pending) => {
				this.pending = pending;
				options.onPending?.(pending);
			},
			onSuccess: async (data) => {
				this.errors = {};
				this.message = typeof data?.message === 'string' ? data.message : null;
				await options.onSuccess?.(data);
			},
			onFailure: (data, status) => {
				this.errors = readErrors(data);
				this.message = typeof data?.message === 'string' ? data.message : null;
				options.onFailure?.(data, status);
			},
			onError: (message, status) => {
				this.message = message;
				options.onError?.(message, status);
			}
		});
	}

	/** The error for one field, or undefined. */
	error(field: string): string | undefined {
		return this.errors[field];
	}

	/** Forget the errors, e.g. when a dialog closes. */
	clear(): void {
		this.errors = {};
		this.message = null;
	}
}
