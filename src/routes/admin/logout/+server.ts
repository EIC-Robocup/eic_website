import { redirect } from '@sveltejs/kit';
import { signOutQuietly } from '../../auth/session.server.ts';
import type { RequestHandler } from './$types';

/** The sidebar's "Sign out" form. POST only, so a link or a prefetch can't sign anyone out. */
export const POST: RequestHandler = async (event) => {
	await signOutQuietly(event);
	redirect(303, '/admin/login');
};

/** Someone typed the address: nothing to do, back to the admin (or its sign in page). */
export const GET: RequestHandler = () => {
	redirect(303, '/admin');
};
