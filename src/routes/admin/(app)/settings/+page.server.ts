import { fail } from '@sveltejs/kit';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { dev } from '$app/env';
import { DEV_AUTH_EMAIL } from '$app/env/private';
import { EDITOR_ROLE_LABELS } from '#lib/content/labels.ts';
import { readText } from '#lib/components/admin/form-data.ts';
import { logActivity } from '#lib/server/activity.ts';
import { isBootstrapEmail, normalizeEmail, requireEditor, requireOwner } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { EDITOR_ROLES, editors, type EditorRole } from '#lib/server/db/schema.ts';
import { MEDIA_BUCKET } from '#lib/server/storage.ts';
import { authConfigured, getAdminClient, storageConfigured } from '#lib/server/supabase.ts';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRole = (value: string): value is EditorRole => (EDITOR_ROLES as readonly string[]).includes(value);
const displayName = (row: { name: string | null; email: string }) => row.name?.trim() || row.email;

type StorageCheck = { ok: boolean; message: string };

/** Ask Supabase Storage for the media bucket (4 s at most). Never rejects. */
async function checkStorage(): Promise<StorageCheck> {
	const client = getAdminClient();
	if (!client) return { ok: false, message: 'Not set up' };
	try {
		const result = await Promise.race([
			client.storage.getBucket(MEDIA_BUCKET),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
		]);
		if (result.error) {
			return { ok: false, message: `The "${MEDIA_BUCKET}" bucket could not be read: ${result.error.message}` };
		}
		return { ok: true, message: `The "${MEDIA_BUCKET}" bucket is ready.` };
	} catch (err) {
		return {
			ok: false,
			message: err instanceof Error && err.message === 'timeout' ? 'Supabase Storage did not answer in time.' : 'Supabase Storage could not be reached.'
		};
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const me = requireEditor(locals);

	let rows: {
		id: string;
		email: string;
		name: string | null;
		role: EditorRole;
		lastSignInAt: Date | null;
		createdAt: Date;
	}[] = [];
	let database = true;
	try {
		rows = await db
			.select({
				id: editors.id,
				email: editors.email,
				name: editors.name,
				role: editors.role,
				lastSignInAt: editors.lastSignInAt,
				createdAt: editors.createdAt
			})
			.from(editors)
			// Owners first, then the order people were invited.
			.orderBy(desc(sql`${editors.role} = 'owner'`), asc(editors.createdAt));
	} catch (err) {
		console.error('Could not load the editors', err);
		database = false;
	}

	return {
		me: { id: me.id, role: me.role },
		canManage: me.role === 'owner',
		editors: rows.map((row) => ({ ...row, alwaysAllowed: isBootstrapEmail(row.email) })),
		status: {
			database,
			auth: authConfigured,
			storage: storageConfigured,
			devSignIn: dev && DEV_AUTH_EMAIL ? DEV_AUTH_EMAIL : null
		},
		// Streamed: the page renders first, the bucket check fills in.
		storageCheck: storageConfigured ? checkStorage() : null,
		now: new Date()
	};
};

export const actions = {
	/** Add someone to the editors list. They can sign in straight away. */
	invite: async ({ locals, request }) => {
		const me = requireOwner(locals);
		const form = await request.formData();
		const email = normalizeEmail(readText(form, 'email', { max: 320 }));
		const name = readText(form, 'name', { max: 200 });
		const role = readText(form, 'role') || 'editor';

		const errors: Record<string, string> = {};
		if (!email) errors.email = 'Add their email address.';
		else if (email.length > 254 || !EMAIL.test(email)) errors.email = 'Use a full email address, like name@example.com.';
		if (name.length > 100) errors.name = 'Keep the name under 100 characters.';
		if (!isRole(role)) errors.role = 'Choose Editor or Owner.';
		if (Object.keys(errors).length) return fail(400, { message: 'Check the highlighted fields.', errors });

		const [row] = await db
			.insert(editors)
			.values({ email, name: name || null, role: role as EditorRole, invitedBy: me.email })
			.onConflictDoNothing({ target: editors.email })
			.returning({ id: editors.id });
		if (!row) {
			return fail(400, { message: `${email} is already on the list.`, errors: { email: 'This email is already an editor.' } });
		}

		await logActivity(me, { entityType: 'editor', entityId: row.id, label: name || email, action: 'invited' });
		return { message: `${name || email} can sign in now.` };
	},

	/** Make an editor an owner, or an owner an editor. */
	role: async ({ locals, request }) => {
		const me = requireOwner(locals);
		const form = await request.formData();
		const id = readText(form, 'id', { max: 64 });
		const role = readText(form, 'role');
		if (!UUID.test(id) || !isRole(role)) return fail(400, { message: 'That change could not be read. Reload the page and try again.' });
		if (id === me.id) return fail(400, { message: 'You can’t change your own role. Ask another owner.' });

		const outcome = await db.transaction(async (tx) => {
			// Lock the owners so two owners can't demote each other at the same time.
			const owners = await tx.select({ id: editors.id }).from(editors).where(eq(editors.role, 'owner')).for('update');
			const [target] = await tx.select().from(editors).where(eq(editors.id, id)).for('update');
			if (!target) return { error: 'That editor is no longer on the list.' } as const;
			if (target.role === role) return { target, unchanged: true } as const;
			if (target.role === 'owner' && owners.length <= 1) return { error: 'The site needs at least one owner.' } as const;
			await tx.update(editors).set({ role }).where(eq(editors.id, id));
			return { target } as const;
		});

		if ('error' in outcome) return fail(400, { message: outcome.error });
		const label = displayName(outcome.target);
		if ('unchanged' in outcome) return { message: `${label} is already ${role === 'owner' ? 'an owner' : 'an editor'}.` };

		await logActivity(me, {
			entityType: 'editor',
			entityId: id,
			label: `${label} · ${EDITOR_ROLE_LABELS[role]}`,
			action: 'updated'
		});
		return { message: role === 'owner' ? `${label} is now an owner.` : `${label} is now an editor.` };
	},

	/** Take someone off the list. They can't sign in any more. */
	remove: async ({ locals, request }) => {
		const me = requireOwner(locals);
		const form = await request.formData();
		const id = readText(form, 'id', { max: 64 });
		if (!UUID.test(id)) return fail(400, { message: 'That editor could not be found. Reload the page.' });
		if (id === me.id) return fail(400, { message: 'You can’t remove yourself. Ask another owner.' });

		const outcome = await db.transaction(async (tx) => {
			const owners = await tx.select({ id: editors.id }).from(editors).where(eq(editors.role, 'owner')).for('update');
			const [target] = await tx.select().from(editors).where(eq(editors.id, id)).for('update');
			if (!target) return { error: 'That editor is no longer on the list.' } as const;
			if (target.role === 'owner' && owners.length <= 1) return { error: 'The site needs at least one owner.' } as const;
			await tx.delete(editors).where(eq(editors.id, id));
			return { target } as const;
		});

		if ('error' in outcome) return fail(400, { message: outcome.error });
		const label = displayName(outcome.target);
		await logActivity(me, { entityType: 'editor', entityId: id, label, action: 'deleted' });

		if (isBootstrapEmail(outcome.target.email)) {
			return {
				message: `${label} was removed, but their email is in ADMIN_EMAILS, so they become an owner again when they next sign in. Remove it there too.`
			};
		}
		return { message: `${label} can no longer sign in.` };
	}
} satisfies Actions;
