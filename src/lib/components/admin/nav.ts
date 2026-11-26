/** The admin sidebar's links, in the groups of the AdminNav design. */

/** Counts the admin layout loads for the sidebar badges (null when the database is unreachable). */
export type AdminCounts = {
	projects: number;
	posts: number;
	/** People with `visible` on. */
	people: number;
	achievements: number;
	/** Inbox messages not read and not archived. */
	unread: number;
};

export type AdminNavKey =
	| 'dashboard'
	| 'pages'
	| 'projects'
	| 'posts'
	| 'people'
	| 'achievements'
	| 'media'
	| 'inbox'
	| 'settings';

export type AdminNavLink = {
	key: AdminNavKey;
	label: string;
	href: string;
	/** Which count to show as a badge. `pages` is the number of editable pages. */
	count?: keyof AdminCounts | 'pages';
};

export type AdminNavGroup = { label: string; links: AdminNavLink[] };

export const ADMIN_NAV: AdminNavGroup[] = [
	{
		label: 'Site',
		links: [
			{ key: 'dashboard', label: 'Dashboard', href: '/admin' },
			{ key: 'pages', label: 'Pages', href: '/admin/pages', count: 'pages' }
		]
	},
	{
		label: 'Content',
		links: [
			{ key: 'projects', label: 'Projects', href: '/admin/projects', count: 'projects' },
			{ key: 'posts', label: 'Posts', href: '/admin/posts', count: 'posts' },
			{ key: 'people', label: 'People', href: '/admin/people', count: 'people' },
			{ key: 'achievements', label: 'Achievements', href: '/admin/lists', count: 'achievements' }
		]
	},
	{
		label: 'Library',
		links: [
			{ key: 'media', label: 'Media', href: '/admin/media' },
			{ key: 'inbox', label: 'Inbox', href: '/admin/inbox', count: 'unread' },
			{ key: 'settings', label: 'Settings', href: '/admin/settings' }
		]
	}
];

/** Whether `href` is the current section: the dashboard only on /admin itself, others on any sub page. */
export function isActiveAdminPath(pathname: string, href: string): boolean {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	if (href === '/admin') return path === '/admin';
	return path === href || path.startsWith(`${href}/`);
}
