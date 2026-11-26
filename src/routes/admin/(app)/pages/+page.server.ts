import { redirect } from '@sveltejs/kit';
import { requireEditor } from '#lib/server/auth.ts';
import type { PageServerLoad } from './$types';

/** /admin/pages opens the first page, Home. */
export const load: PageServerLoad = async ({ locals }) => {
	requireEditor(locals);
	redirect(307, '/admin/pages/home');
};
