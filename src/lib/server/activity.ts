import { db } from './db';
import { activity } from './db/schema';
import type { SessionEditor } from './auth';

export type ActivityInput = {
	/** e.g. 'post', 'project', 'person', 'page', 'achievement', 'media', 'editor' */
	entityType: string;
	entityId?: string | null;
	/** Human label, e.g. the post title or "Home · Hero". */
	label: string;
	/** e.g. 'created', 'updated', 'deleted', 'published' */
	action: string;
};

/** Record an edit for the dashboard's "Recent edits". Never throws. */
export async function logActivity(editor: SessionEditor | null, input: ActivityInput): Promise<void> {
	try {
		await db.insert(activity).values({
			entityType: input.entityType,
			entityId: input.entityId ?? null,
			label: input.label.slice(0, 300),
			action: input.action,
			actorEmail: editor?.email ?? null,
			actorName: editor?.name ?? editor?.email ?? null
		});
	} catch (err) {
		console.error('Could not record activity', err);
	}
}
