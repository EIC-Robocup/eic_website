import { sequence, type Handle, type HandleServerError } from '@sveltejs/kit/hooks';

import { dev } from '$app/env';
import { DEV_AUTH_EMAIL, VERCEL_ENV } from '$app/env/private';
import { findEditor } from '#lib/server/auth.js';
import { createRequestClient } from '#lib/server/supabase.js';

/** Attach a per-request Supabase auth client and a cached, verified user lookup. */
const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createRequestClient(event);
	event.locals.editor = null;

	let userPromise: Promise<App.AuthUser | null> | undefined;
	event.locals.getUser = () => {
		userPromise ??= (async () => {
			if (dev && DEV_AUTH_EMAIL) return { id: null, email: DEV_AUTH_EMAIL };
			const client = event.locals.supabase;
			if (!client) return null;
			// getClaims() verifies the session token; never trust getSession() on the server.
			const { data, error } = await client.auth.getClaims();
			if (error || !data?.claims?.sub) return null;
			const email = typeof data.claims.email === 'string' ? data.claims.email : null;
			if (!email) return null;
			return { id: data.claims.sub, email };
		})().catch((err) => {
			console.error('Could not verify the session', err);
			return null;
		});
		return userPromise;
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

/** Admin routes (by route id) that work without being signed in. */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/logout']);

/**
 * Guard the admin panel. Sets `locals.editor` for invited editors. Requests that
 * change data (anything but GET/HEAD) and admin API routes are refused here when
 * nobody is signed in; page loads are redirected to sign in by the admin layout.
 */
const admin: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	// Kit matches routes on the decoded path, so /%61dmin/... reaches the admin routes: test
	// the matched route as well as the raw path.
	const routeId: string = event.route.id ?? '';
	const isAdmin = routeId.startsWith('/admin/') || path === '/admin' || path.startsWith('/admin/');
	if (!isAdmin) return resolve(event);

	const user = await event.locals.getUser();
	if (user) {
		try {
			event.locals.editor = await findEditor(user.email, user.id ?? undefined);
		} catch (err) {
			console.error('Could not look up the editor', err);
			event.locals.editor = null;
		}
	}

	// The public pages' route ids equal their paths. An unmatched path (a 404) is never public.
	const isPublic = PUBLIC_ADMIN_PATHS.has(routeId);
	const changesData = event.request.method !== 'GET' && event.request.method !== 'HEAD';
	const isApi = routeId.startsWith('/admin/(app)/api/') || path.startsWith('/admin/api/');
	if (!event.locals.editor && !isPublic && (changesData || isApi)) {
		return new Response('Sign in to continue.', {
			status: 401,
			headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
		});
	}

	const response = await resolve(event);
	response.headers.set('cache-control', 'private, no-store');
	response.headers.set('x-robots-tag', 'noindex, nofollow');
	return response;
};

/**
 * If Supabase falls back to the Site URL (a redirect URL that is not on its allow list),
 * sign in links arrive at "/?token_hash=..." or "/?code=...". Send them to /auth/confirm.
 */
const authFallback: Handle = async ({ event, resolve }) => {
	const { url } = event;
	if (url.pathname === '/' && (url.searchParams.has('token_hash') || url.searchParams.has('code'))) {
		return new Response(null, {
			status: 303,
			headers: { location: `/auth/confirm${url.search}`, 'cache-control': 'no-store' }
		});
	}
	return resolve(event);
};

/** Routes whose responses are the same for every visitor (no (site) load reads the user). */
const SHARED_ROUTES = new Set(['/rss.xml', '/sitemap.xml']);

/**
 * Let Vercel's CDN keep public pages (and their __data.json) for a minute and serve a stale
 * copy for ten more while it refreshes, so most views run no function and no queries. Editors'
 * changes show on the site within about a minute. Only a response that is safe to share gets
 * this: a GET or HEAD answered 200 on a public route, with no cookie and no cache header of its
 * own, and no load on it failed with a server error (`locals.serverError`, set by handleError
 * below: Kit answers __data.json 200 even when a load threw, with the error inside). The one
 * exception is Kit's `private, no-store` on __data.json, which it sets because a load might
 * read cookies: no (site) load does, and hover preloads fetch these. /about's
 * contact form token stays valid in a cached page: it must be at least 3 seconds and at most
 * 24 hours old, and a cached copy is at most 11 minutes old.
 */
const publicCache: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const method = event.request.method;
	const routeId: string = event.route.id ?? '';
	if (
		(method === 'GET' || method === 'HEAD') &&
		response.status === 200 &&
		!event.locals.serverError &&
		(routeId.startsWith('/(site)') || SHARED_ROUTES.has(routeId)) &&
		!response.headers.has('set-cookie') &&
		(!response.headers.has('cache-control') ||
			(event.isDataRequest && response.headers.get('cache-control') === 'private, no-store'))
	) {
		response.headers.set('cache-control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
	}
	return response;
};

/** Baseline security headers for every response. */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-frame-options', 'SAMEORIGIN');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	// Preview deployments share content with production: keep them out of search engines.
	if (VERCEL_ENV === 'preview') response.headers.set('x-robots-tag', 'noindex, nofollow');
	return response;
};

export const handle = sequence(securityHeaders, publicCache, authFallback, supabase, admin);

/**
 * Marks a request whose load (or endpoint) failed with a server error, so publicCache never
 * shares the answer. This replaces Kit's default handleError, so it logs unknown errors the
 * way Kit does; app and framework errors (404s and the like) are not logged, as before.
 */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind === 'unknown') {
		event.locals.serverError = true;
		console.error(error);
	} else if (kind !== 'validation' && error.status >= 500) {
		event.locals.serverError = true;
	}
};
