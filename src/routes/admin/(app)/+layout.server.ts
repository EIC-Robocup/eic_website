import { redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { PAGE_KEYS } from '#lib/content/sections.ts';
import type { AdminCounts } from '#lib/components/admin/nav.ts';
import { db } from '#lib/server/db/index.ts';
import { achievements, messages, people, posts, projects } from '#lib/server/db/schema.ts';
import type { LayoutServerLoad } from './$types';

/** The sidebar badges, in one round trip. */
async function loadCounts(): Promise<AdminCounts> {
	const rows = await db.execute<Record<keyof AdminCounts, number | string | null>>(sql`
		select
			(select count(*) from ${projects})::int as projects,
			(select count(*) from ${posts})::int as posts,
			(select count(*) from ${people} where ${people.visible})::int as people,
			(select count(*) from ${achievements})::int as achievements,
			(select count(*) from ${messages} where ${messages.readAt} is null and not ${messages.archived})::int as unread
	`);
	const row = rows[0];
	const n = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
	return {
		projects: n(row?.projects),
		posts: n(row?.posts),
		people: n(row?.people),
		achievements: n(row?.achievements),
		unread: n(row?.unread)
	};
}

/**
 * Every admin page needs a signed-in, invited editor (set on locals by hooks.server.ts).
 * Pages still call requireEditor(locals) in their own loads and actions.
 */
export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	if (!locals.editor) {
		redirect(303, `/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	depends('admin:counts');

	let counts: AdminCounts | null = null;
	try {
		counts = await loadCounts();
	} catch (err) {
		// The shell still renders; the badges just go missing.
		console.error('Could not load the admin counts', err);
	}

	return { editor: locals.editor, counts, pageCount: PAGE_KEYS.length };
};
