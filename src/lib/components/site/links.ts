/** The main site sections, shared by the Nav and the Footer. */
export const NAV_LINKS = [
	{ label: 'Projects', href: '/projects' },
	{ label: 'People', href: '/people' },
	{ label: 'Blog', href: '/blog' },
	{ label: 'About', href: '/about' }
] as const;

/** True when `pathname` is `href` or a page below it ("/projects/walkie-4" for "/projects"). */
export function isActivePath(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	return pathname === href || pathname.startsWith(href + '/');
}
