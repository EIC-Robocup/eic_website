import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { ADMIN_EMAILS } from '$app/env/private';
import { db } from './db';
import { editors, type EditorRole } from './db/schema';

/** The signed-in editor, available as `locals.editor` on admin routes. */
export type SessionEditor = {
	id: string;
	email: string;
	name: string | null;
	role: EditorRole;
};

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

const bootstrapEmails = new Set(
	(ADMIN_EMAILS ?? '')
		.split(',')
		.map((e) => normalizeEmail(e))
		.filter(Boolean)
);

/** Emails from ADMIN_EMAILS may always sign in and become owners on first sign in. */
export function isBootstrapEmail(email: string): boolean {
	return bootstrapEmails.has(normalizeEmail(email));
}

/** Whether this email may sign in (it is invited, or listed in ADMIN_EMAILS). */
export async function isInvited(email: string): Promise<boolean> {
	const normalized = normalizeEmail(email);
	if (isBootstrapEmail(normalized)) return true;
	const [row] = await db
		.select({ id: editors.id })
		.from(editors)
		.where(eq(editors.email, normalized))
		.limit(1);
	return Boolean(row);
}

/**
 * Find the editor for a verified email, creating an owner row for ADMIN_EMAILS.
 * Returns null when the email is not invited.
 */
export async function findEditor(email: string, userId?: string): Promise<SessionEditor | null> {
	const normalized = normalizeEmail(email);
	let [row] = await db.select().from(editors).where(eq(editors.email, normalized)).limit(1);

	if (!row && isBootstrapEmail(normalized)) {
		[row] = await db
			.insert(editors)
			.values({ email: normalized, role: 'owner', invitedBy: 'ADMIN_EMAILS' })
			.onConflictDoUpdate({ target: editors.email, set: { role: 'owner' } })
			.returning();
	}
	if (!row) return null;

	return { id: row.id, email: row.email, name: row.name, role: row.role };
}

/** Record a successful sign in (links the Supabase user id on first sign in). */
export async function markSignedIn(editorId: string, userId: string | null): Promise<void> {
	await db
		.update(editors)
		.set({ lastSignInAt: new Date(), ...(userId ? { userId } : {}) })
		.where(eq(editors.id, editorId));
}

/** For admin actions: the signed-in editor, or a 401. */
export function requireEditor(locals: App.Locals): SessionEditor {
	if (!locals.editor) error(401, 'Sign in to continue.');
	return locals.editor;
}

/** For owner-only actions such as inviting editors. */
export function requireOwner(locals: App.Locals): SessionEditor {
	const editor = requireEditor(locals);
	if (editor.role !== 'owner') error(403, 'Only owners can do this.');
	return editor;
}

/** Only allow redirects back into the admin panel after sign in. */
export function safeNext(next: string | null | undefined): string {
	if (!next || !next.startsWith('/admin') || next.startsWith('//')) return '/admin';
	if (next.startsWith('/admin/login')) return '/admin';
	return next;
}
