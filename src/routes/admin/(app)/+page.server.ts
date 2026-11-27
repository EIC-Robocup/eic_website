import { isPageKey } from '#lib/content/sections.ts';
import { requireEditor } from '#lib/server/auth.ts';
import {
	getDashboardCounts,
	listDraftPosts,
	listRecentActivity,
	type DashboardCounts,
	type DraftPost
} from '#lib/server/queries/admin.ts';
import type { PageServerLoad } from './$types';

const TYPE_LABELS: Record<string, string> = {
	page: 'Page',
	post: 'Post',
	project: 'Project',
	person: 'Person',
	team: 'Team',
	achievement: 'Achievement',
	publication: 'Paper',
	archive: 'Archive photo',
	sponsor: 'Sponsor',
	media: 'Media',
	editor: 'Editor',
	message: 'Message'
};

const typeLabel = (type: string) =>
	TYPE_LABELS[type] ?? (type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/[-_]/g, ' ') : 'Edit');

/** List sections on /admin/lists, by activity type (their editors' element ids). */
const LIST_ANCHORS: Record<string, string> = {
	achievement: 'achievements',
	archive: 'archive',
	sponsor: 'sponsors',
	publication: 'publications'
};

/**
 * Where an activity row links to: the item's own editor when it has one, else the admin page
 * where it is edited. Deleted items link nowhere. Types come from the logActivity calls under
 * src/routes/admin/(app).
 */
function activityHref(type: string, id: string | null, action: string): string | null {
	if (action === 'deleted') return null;
	switch (type) {
		case 'post':
			return id ? `/admin/posts/${id}` : '/admin/posts';
		case 'project':
			return id ? `/admin/projects/${id}` : '/admin/projects';
		case 'page': {
			const page = id?.split('.')[0] ?? '';
			return isPageKey(page) ? `/admin/pages/${page}` : '/admin/pages';
		}
		// /admin/people opens a person's sheet from ?person=<id>.
		case 'person':
			return id ? `/admin/people?person=${encodeURIComponent(id)}` : '/admin/people';
		// Teams are edited in the Manage teams dialog on /admin/people.
		case 'team':
			return '/admin/people';
		case 'media':
			return '/admin/media';
		case 'message':
			return '/admin/inbox';
		case 'editor':
			return '/admin/settings';
		default:
			return Object.hasOwn(LIST_ANCHORS, type) ? `/admin/lists#${LIST_ANCHORS[type]}` : null;
	}
}

type DashboardEdit = {
	id: string;
	label: string;
	type: string;
	action: string;
	by: string | null;
	byEmail: string | null;
	at: Date;
	href: string | null;
};

export const load: PageServerLoad = async ({ locals }) => {
	requireEditor(locals);

	let counts: DashboardCounts | null = null;
	let edits: DashboardEdit[] = [];
	let drafts: DraftPost[] = [];
	try {
		const [c, activity, d] = await Promise.all([getDashboardCounts(), listRecentActivity(8), listDraftPosts(5)]);
		counts = c;
		drafts = d;
		edits = activity.map((row) => ({
			id: row.id,
			label: row.label,
			type: typeLabel(row.entityType),
			action: row.action,
			// The name when there is one, else the start of the email ("dev" for dev@...).
			by: row.actorName && row.actorName !== row.actorEmail ? row.actorName : (row.actorEmail?.split('@')[0] ?? null),
			byEmail: row.actorEmail,
			at: row.createdAt,
			href: activityHref(row.entityType, row.entityId, row.action)
		}));
	} catch (err) {
		// Render the page with a notice instead of an error page.
		console.error('Could not load the dashboard', err);
	}

	return { counts, edits, drafts, now: new Date() };
};
