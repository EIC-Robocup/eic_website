import type { Cookies } from '@sveltejs/kit';

/**
 * A one-time message for the Projects list after an action that redirects there (deleting a
 * project): the list's load reads it, clears it and the page shows it as a toast.
 */
export const FLASH_COOKIE = 'eic_admin_flash';

export function setFlash(cookies: Cookies, message: string): void {
	cookies.set(FLASH_COOKIE, message.slice(0, 300), { path: '/admin', httpOnly: true, sameSite: 'lax', maxAge: 60 });
}
