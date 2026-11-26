import { fail } from '@sveltejs/kit';
import { asc, count, desc, eq } from 'drizzle-orm';
import { readText } from '#lib/components/admin/form-data.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { editors, media } from '#lib/server/db/schema.ts';
import { deleteMedia } from '#lib/server/storage.ts';
import { storageConfigured } from '#lib/server/supabase.ts';
import { isUuid } from '../projects/projects.server.ts';
import type { Actions, PageServerLoad } from './$types';

/** Newest files loaded at once. The page filters and searches them in the browser. */
const LIMIT = 1000;
const ALT_MAX = 300;

export const load: PageServerLoad = async ({ locals }) => {
	requireEditor(locals);

	const [files, [{ total }]] = await Promise.all([
		db
			.select({
				id: media.id,
				path: media.path,
				url: media.url,
				filename: media.filename,
				mimeType: media.mimeType,
				size: media.size,
				alt: media.alt,
				uploadedBy: media.uploadedBy,
				uploaderName: editors.name,
				createdAt: media.createdAt
			})
			.from(media)
			.leftJoin(editors, eq(editors.email, media.uploadedBy))
			.orderBy(desc(media.createdAt), asc(media.id))
			.limit(LIMIT),
		db.select({ total: count() }).from(media)
	]);

	return { files, total, limit: LIMIT, storageReady: storageConfigured, now: new Date() };
};

export const actions = {
	/** Change a file's alt text (used when its Markdown is copied). */
	alt: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const id = readText(form, 'id', { max: 60 });
		const raw = form.get('alt');
		const alt = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
		if (!isUuid(id)) return fail(400, { message: 'Pick a file first.' });
		if (alt.length > ALT_MAX) {
			return fail(400, { message: 'Check the alt text.', errors: { alt: `Keep it under ${ALT_MAX} characters.` } });
		}
		const [row] = await db.update(media).set({ alt }).where(eq(media.id, id)).returning({ filename: media.filename });
		if (!row) return fail(404, { message: 'That file is not in the library any more.' });
		await logActivity(editor, { entityType: 'media', entityId: id, label: row.filename, action: 'updated' });
		return { message: alt ? 'Alt text saved.' : 'Alt text removed.' };
	},

	/** Delete the file from Storage, then its row. Pages that still use it show a broken image. */
	delete: async ({ request, locals }) => {
		const editor = requireEditor(locals);
		const form = await request.formData();
		const id = readText(form, 'id', { max: 60 });
		if (!isUuid(id)) return fail(400, { message: 'Pick a file to delete.' });
		const [row] = await db
			.select({ path: media.path, filename: media.filename })
			.from(media)
			.where(eq(media.id, id))
			.limit(1);
		if (!row) return fail(404, { message: 'That file was already deleted.' });

		// Storage first: if it refuses, the row stays and the file is still listed (throws 502/503).
		await deleteMedia(row.path);
		await db.delete(media).where(eq(media.id, id));
		await logActivity(editor, { entityType: 'media', entityId: id, label: row.filename, action: 'deleted' });
		return { message: `${row.filename} deleted.` };
	}
} satisfies Actions;
