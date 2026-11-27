/**
 * Short confirmations on the public site ("Link copied", "Copied"). The site mounts no Toaster
 * up front, so svelte-sonner and its stylesheet load with the first toast; where a page already
 * has a Toaster (the admin, which shows posts in its preview) that one is used.
 *
 *     void notify('Link copied');
 *     void notify('Could not copy the link', 'error', { description: url });
 */
import type { Component } from 'svelte';

export type NotifyOptions = {
	/** Replaces an open toast with the same id instead of stacking another. */
	id?: string;
	/** A second, smaller line. */
	description?: string;
};

let mounting: Promise<void> | null = null;

/** svelte-sonner's Toaster renders `<section aria-label="Notifications …" aria-live>`. */
const hasToaster = () => document.querySelector('section[aria-label^="Notifications"][aria-live]') !== null;

function ensureToaster(): Promise<void> {
	if (!mounting && hasToaster()) return Promise.resolve();
	mounting ??= (async () => {
		const [{ mount }, { Toaster }] = await Promise.all([
			import('svelte'),
			import('#lib/components/ui/sonner/index.js')
		]);
		if (!hasToaster()) {
			mount(Toaster as unknown as Component<Record<string, unknown>>, {
				target: document.body,
				props: { position: 'bottom-center' }
			});
		}
		// Give the toaster a frame to subscribe before the first toast.
		await new Promise((done) => requestAnimationFrame(() => done(null)));
	})();
	return mounting;
}

/** Show a toast, mounting a Toaster first when the page has none. */
export async function notify(
	message: string,
	kind: 'success' | 'error' = 'success',
	options: NotifyOptions = {}
): Promise<void> {
	const [{ toast }] = await Promise.all([import('svelte-sonner'), ensureToaster()]);
	if (kind === 'error') toast.error(message, options);
	else toast.success(message, options);
}
