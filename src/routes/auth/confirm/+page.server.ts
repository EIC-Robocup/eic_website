import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';
import {
	authErrorCode,
	completeSignIn,
	errorFromRedirect,
	loginUrl,
	takeNext
} from '../session.server.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * Sign in emails link here: `/auth/confirm?token_hash=...&type=email` (see
 * supabase/templates). Opening the link only shows a "Continue" button; the one-time token
 * is used when that button is pressed, so email scanners that open links (Microsoft Safe
 * Links and the like) can't use it up first.
 *
 * Links that carry a PKCE `?code=` (Supabase's default templates, or the Site URL fallback
 * in hooks.server.ts) are handed to /auth/callback.
 */

const OTP_TYPES = ['email', 'magiclink', 'signup', 'invite', 'recovery'] as const satisfies EmailOtpType[];
type OtpType = (typeof OTP_TYPES)[number];

function readType(value: string | null): OtpType | null {
	return OTP_TYPES.find((t) => t === value) ?? null;
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	try {
		setHeaders({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
	} catch {
		// Already set (the Supabase cookie writer sets cache headers when it writes cookies).
	}

	const redirectError = errorFromRedirect(url);
	if (redirectError) redirect(303, loginUrl(redirectError, url.searchParams.get('next')));

	if (url.searchParams.has('code') && !url.searchParams.has('token_hash')) {
		redirect(303, `/auth/callback${url.search}`);
	}

	const tokenHash = url.searchParams.get('token_hash');
	if (!tokenHash || !readType(url.searchParams.get('type'))) {
		redirect(303, loginUrl('link_expired', url.searchParams.get('next')));
	}
	return {};
};

export const actions = {
	default: async (event) => {
		const { url, locals, cookies } = event;
		const next = takeNext(cookies, url.searchParams.get('next'));
		if (!locals.supabase) redirect(303, loginUrl('not_configured'));

		const tokenHash = url.searchParams.get('token_hash');
		const type = readType(url.searchParams.get('type'));
		if (!tokenHash || !type) redirect(303, loginUrl('link_expired', next));

		let failure: ReturnType<typeof authErrorCode> | null = null;
		try {
			const { error } = await locals.supabase.auth.verifyOtp({ type, token_hash: tokenHash });
			if (error) {
				console.warn('Email link verification failed', error.code ?? error.name, error.message);
				failure = error.status === 403 || error.code === 'otp_expired' ? 'link_expired' : authErrorCode(error);
			}
		} catch (err) {
			console.error('Email link verification failed', err);
			failure = 'auth_failed';
		}
		if (failure) redirect(303, loginUrl(failure, next));

		redirect(303, await completeSignIn(event, next));
	}
} satisfies Actions;
