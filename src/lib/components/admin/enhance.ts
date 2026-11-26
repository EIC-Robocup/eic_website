/**
 * `use:enhance` for admin forms: toasts for every outcome, form values kept on failure, and
 * a pending flag for spinners. Most pages use the `AdminForm` class from form.svelte.ts,
 * which wraps this and tracks `pending` and field `errors` as $state. Use this function
 * directly when you only need the toasts:
 *
 *     <form method="POST" action="?/save" use:enhance={toastEnhance({ success: 'Saved.' })}>
 *
 * What happens to each action result:
 * - success: refreshes page data, keeps the form's values (no reset unless `reset: true`),
 *   toasts `data.message` (or the `success` option, or "Saved.").
 * - failure (`return fail(400, { message, errors })`): keeps the values, updates the page's
 *   `form` prop, toasts `data.message` (or "Check the highlighted fields.").
 * - redirect: toasts the `success` option when it is a string, then follows the redirect.
 * - error (a thrown `error()` or a crash): toasts the message and leaves the page alone; for
 *   an expired session the toast has a "Sign in" button.
 */
import type { ActionResult, SubmitFunction } from '$app/forms';
import { toast } from 'svelte-sonner';

/** What admin actions return: `{ message }` on success, `fail(400, { message, errors })` on failure. */
export type AdminActionData = {
	message?: string;
	errors?: Record<string, string>;
	[key: string]: unknown;
};

type Data = Record<string, unknown> | undefined;
type SubmitInput = Parameters<SubmitFunction>[0];

export type ToastEnhanceOptions = {
	/**
	 * Success toast: a string, a function of the returned data, or `false` for none.
	 * By default the action's `message`, else "Saved.". Also shown before a redirect when it is a string.
	 */
	success?: string | false | ((data: Data) => string | false | null | undefined);
	/** Failure toast when the action returns no `message`. */
	failure?: string;
	/** Reset the form after success (for "add" forms). Default false. */
	reset?: boolean;
	/** Re-run every load after success. Default true. */
	refreshAll?: boolean;
	/**
	 * Follow `result.location` to the page that owns the action. Default false: results are
	 * applied to the current page, even when the action lives on another route.
	 */
	navigate?: boolean;
	/** Before sending. Return false to cancel (e.g. a client-side check failed). */
	onSubmit?: (input: SubmitInput) => void | boolean | Promise<void | boolean>;
	/** True while the request is in flight. */
	onPending?: (pending: boolean) => void;
	onSuccess?: (data: Data) => void | Promise<void>;
	onFailure?: (data: Data, status: number) => void;
	onError?: (message: string, status: number | undefined) => void;
};

/** Field errors from a failure's data (`errors: { title: 'Add a title.' }`). */
export function readErrors(data: unknown): Record<string, string> {
	const errors = (data as AdminActionData | undefined)?.errors;
	if (!errors || typeof errors !== 'object') return {};
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(errors)) {
		if (typeof value === 'string' && value) out[key] = value;
	}
	return out;
}

function readMessage(data: unknown): string | undefined {
	const message = (data as AdminActionData | undefined)?.message;
	return typeof message === 'string' && message ? message : undefined;
}

function successText(option: ToastEnhanceOptions['success'], data: Data): string | null {
	if (option === false) return null;
	if (typeof option === 'function') return option(data) || null;
	return readMessage(data) ?? option ?? 'Saved.';
}

const SESSION_ENDED = 'Sign in to continue.';

function errorText(result: Extract<ActionResult, { type: 'error' }>): { message: string; signIn: boolean } {
	const message = result.error?.message;
	if (result.status === 401 || message === SESSION_ENDED) {
		return { message: 'Your session has ended. Sign in again, then retry.', signIn: true };
	}
	if (message && message !== 'Internal Error') return { message, signIn: false };
	if (result.status === undefined) {
		return { message: 'Could not reach the server. Check your connection and try again.', signIn: false };
	}
	return { message: 'Something went wrong on the server. Try again.', signIn: false };
}

function signInHref(): string {
	const here = `${location.pathname}${location.search}`;
	return `/admin/login?next=${encodeURIComponent(here)}`;
}

/** A SubmitFunction for `use:enhance` with admin toasts. See the file comment. */
export function toastEnhance(options: ToastEnhanceOptions = {}): SubmitFunction {
	let busy = false;

	return async (input) => {
		// One submission at a time per form.
		if (busy) {
			input.cancel();
			return;
		}
		if (options.onSubmit && (await options.onSubmit(input)) === false) {
			input.cancel();
			return;
		}
		busy = true;
		options.onPending?.(true);

		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					const text = successText(options.success, result.data);
					if (text) toast.success(text);
					await update({
						reset: options.reset ?? false,
						refreshAll: options.refreshAll ?? true,
						navigate: options.navigate ?? false
					});
					await options.onSuccess?.(result.data);
				} else if (result.type === 'failure') {
					const errors = readErrors(result.data);
					toast.error(
						readMessage(result.data) ??
							options.failure ??
							(Object.keys(errors).length ? 'Check the highlighted fields.' : 'That did not work. Try again.')
					);
					await update({ reset: false, navigate: options.navigate ?? false });
					options.onFailure?.(result.data, result.status);
				} else if (result.type === 'redirect') {
					if (typeof options.success === 'string') toast.success(options.success);
					await update();
				} else {
					const { message, signIn } = errorText(result);
					toast.error(
						message,
						signIn
							? { action: { label: 'Sign in', onClick: () => location.assign(signInHref()) } }
							: undefined
					);
					options.onError?.(message, result.status);
				}
			} finally {
				busy = false;
				options.onPending?.(false);
			}
		};
	};
}
