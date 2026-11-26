import { fail } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { readText } from '#lib/components/admin/form-data.ts';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor, type SessionEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { messages } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The inbox shows this many messages, newest first. */
const LIMIT = 500;

export const load: PageServerLoad = async ({ locals }) => {
	requireEditor(locals);
	const rows = await db
		.select({
			id: messages.id,
			name: messages.name,
			email: messages.email,
			topic: messages.topic,
			body: messages.body,
			readAt: messages.readAt,
			archived: messages.archived,
			createdAt: messages.createdAt
		})
		.from(messages)
		.orderBy(desc(messages.createdAt), desc(messages.id))
		.limit(LIMIT);
	return { messages: rows, limit: LIMIT, now: new Date() };
};

async function readId(request: Request): Promise<string | null> {
	const form = await request.formData();
	const id = readText(form, 'id', { max: 64 });
	return UUID.test(id) ? id : null;
}

const GONE = 'That message is no longer in the inbox. It may have been deleted.';

/** Run an update on one message and log it. Returns the action result. */
async function change(
	editor: SessionEditor,
	id: string | null,
	set: Partial<typeof messages.$inferInsert>,
	activity: string | null,
	message: string
) {
	if (!id) return fail(400, { message: GONE });
	const [row] = await db
		.update(messages)
		.set(set)
		.where(eq(messages.id, id))
		.returning({ id: messages.id, name: messages.name });
	if (!row) return fail(404, { message: GONE });
	if (activity) {
		await logActivity(editor, { entityType: 'message', entityId: row.id, label: `Message from ${row.name}`, action: activity });
	}
	return { message };
}

export const actions = {
	/** Sent by the page when a message is opened. Not logged: reading is not an edit. */
	read: async ({ locals, request }) => {
		requireEditor(locals);
		const id = await readId(request);
		if (!id) return fail(400, { message: GONE });
		await db
			.update(messages)
			.set({ readAt: new Date() })
			.where(and(eq(messages.id, id), isNull(messages.readAt)));
		return { message: 'Marked as read.' };
	},

	unread: async ({ locals, request }) => {
		const editor = requireEditor(locals);
		return change(editor, await readId(request), { readAt: null }, 'marked unread', 'Marked as unread.');
	},

	archive: async ({ locals, request }) => {
		const editor = requireEditor(locals);
		return change(editor, await readId(request), { archived: true }, 'archived', 'Archived.');
	},

	unarchive: async ({ locals, request }) => {
		const editor = requireEditor(locals);
		return change(editor, await readId(request), { archived: false }, 'moved to inbox', 'Moved back to the inbox.');
	},

	delete: async ({ locals, request }) => {
		const editor = requireEditor(locals);
		const id = await readId(request);
		if (!id) return fail(400, { message: GONE });
		const [row] = await db
			.delete(messages)
			.where(eq(messages.id, id))
			.returning({ id: messages.id, name: messages.name });
		if (!row) return fail(404, { message: GONE });
		await logActivity(editor, { entityType: 'message', entityId: row.id, label: `Message from ${row.name}`, action: 'deleted' });
		return { message: 'Message deleted.' };
	}
} satisfies Actions;
