import { redirect } from '@sveltejs/kit';
import {
	authErrorCode,
	completeSignIn,
	errorFromRedirect,
	loginUrl,
	takeNext
} from '../session.server.ts';
import type { RequestHandler } from './$types';

/**
 * Where GitHub and Google sign in (and PKCE email links) come back to:
 * `/auth/callback?code=...&next=/admin/...` (plus `sb_flow_id` when several flows are in flight).
 * Exchanges the code for a session, then lets only invited editors in.
 */
export const GET: RequestHandler = async (event) => {
	const { url, locals, cookies } = event;
	const next = takeNext(cookies, url.searchParams.get('next'));

	const redirectError = errorFromRedirect(url);
	if (redirectError) redirect(303, loginUrl(redirectError, next));

	if (!locals.supabase) redirect(303, loginUrl('not_configured'));

	const code = url.searchParams.get('code');
	if (!code) redirect(303, loginUrl('auth_failed', next));

	const flowId = url.searchParams.get('sb_flow_id');
	let failure: ReturnType<typeof authErrorCode> | null = null;
	try {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(
			code,
			flowId ? { flowId } : undefined
		);
		if (error) {
			console.warn('Code exchange failed', error.code ?? error.name, error.message);
			failure = authErrorCode(error);
		}
	} catch (err) {
		console.error('Code exchange failed', err);
		failure = authErrorCode(err as { code?: string; name?: string });
	}
	// No new session was created, so an editor who is already signed in stays signed in.
	if (failure) redirect(303, loginUrl(failure, next));

	redirect(303, await completeSignIn(event, next));
};
