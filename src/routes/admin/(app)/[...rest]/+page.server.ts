import { error } from '@sveltejs/kit';
import { requireEditor } from '#lib/server/auth.ts';
import type { PageServerLoad } from './$types';

/**
 * Any /admin/... address with no page of its own: a 404 inside the admin shell (+error.svelte
 * next to the layout), not the public error page. Signed out visitors are sent to sign in
 * first by the layout.
 */
export const load: PageServerLoad = ({ locals }) => {
	requireEditor(locals);
	error(404, 'There is no admin page at this address.');
};
