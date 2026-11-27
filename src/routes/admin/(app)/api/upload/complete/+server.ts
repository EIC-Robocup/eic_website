import { isHttpError } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { media } from '#lib/server/db/schema.ts';
import {
	UPLOAD_RULES,
	deleteMedia,
	formatBytes,
	isValidObjectPath,
	publicUrl,
	statMedia,
	typeForPath
} from '#lib/server/storage.ts';
import { storageConfigured } from '#lib/server/supabase.ts';
import { parseSubmittedJson } from '#lib/components/admin/form-data.ts';
import { UPLOAD_FOLDERS } from '#lib/components/admin/upload.ts';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

function problem(status: number, message: string, errors?: Record<string, string>): Response {
	return Response.json(errors ? { message, errors } : { message }, { status, headers: NO_STORE });
}

function readDimension(value: unknown): number | null {
	const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null;
}

/** Remove an object that failed the checks, so the bucket holds only files in the library. */
async function discard(path: string) {
	try {
		await deleteMedia(path);
	} catch (err) {
		console.error('Could not remove the refused upload', path, err);
	}
}

/**
 * Step 3 of an upload: after the browser has PUT the file to the signed URL.
 *
 * JSON `{ path, filename, mimeType, size, width?, height?, alt? }`. Checks that `path` is one
 * we hand out, that the object really is in Storage, and that its stored size and type are
 * within the limits (refused files are deleted). Then it records the media row and the
 * activity entry and answers 201 `{ id, url, path, filename, mimeType, size, width, height, alt }`.
 * Calling it twice for the same path returns the same row.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	let editor;
	try {
		editor = requireEditor(locals);
	} catch (err) {
		if (isHttpError(err)) return problem(err.status, err.body.message);
		throw err;
	}

	let body: Record<string, unknown>;
	try {
		const text = await request.text();
		if (text.length > 8192) return problem(413, 'The request is too large.');
		body = parseSubmittedJson(text) as Record<string, unknown>;
		if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
	} catch {
		return problem(400, 'Send the upload details as JSON.');
	}

	const path = typeof body.path === 'string' ? body.path : '';
	const filename = (typeof body.filename === 'string' ? body.filename.trim() : '').slice(0, 300) || path.split('/').pop() || 'file';
	const alt = (typeof body.alt === 'string' ? body.alt.trim() : '').slice(0, 300);
	const width = readDimension(body.width);
	const height = readDimension(body.height);

	if (!isValidObjectPath(path, UPLOAD_FOLDERS)) {
		return problem(400, 'That upload path is not one this site hands out.', { path: 'Unknown upload path.' });
	}
	const expected = typeForPath(path);
	if (!expected) return problem(400, 'Unknown file type.', { path: 'Unknown file type.' });
	if (typeof body.mimeType === 'string' && body.mimeType && body.mimeType !== expected) {
		return problem(400, 'The file type does not match the upload.', { mimeType: `Expected ${expected}.` });
	}

	if (!storageConfigured) {
		return problem(503, 'Uploads are not set up yet: add SUPABASE_URL and SUPABASE_SECRET_KEY to the environment.');
	}

	try {
		// Already recorded (a retried request): answer with the same row.
		const [existing] = await db.select().from(media).where(eq(media.path, path)).limit(1);
		if (existing) {
			return Response.json(
				{ id: existing.id, url: existing.url, path, filename: existing.filename, mimeType: existing.mimeType, size: existing.size, width, height, alt: existing.alt },
				{ status: 200, headers: NO_STORE }
			);
		}

		const stored = await statMedia(path);
		if (!stored) return problem(400, 'The file did not reach storage. Upload it again.');

		const rule = UPLOAD_RULES[expected];
		const size = stored.size ?? (typeof body.size === 'number' ? body.size : 0);
		if (!size || size > rule.maxBytes) {
			await discard(path);
			return problem(400, `That file is too large. The limit for this type is ${formatBytes(rule.maxBytes)}.`);
		}
		const storedType = stored.mimeType?.split(';')[0].trim().toLowerCase() ?? null;
		if (storedType && storedType !== expected) {
			await discard(path);
			return problem(400, 'Storage received a different file type than expected. Upload it again.');
		}

		const url = publicUrl(path);
		const [row] = await db
			.insert(media)
			.values({ path, url, filename, mimeType: expected, size, alt, uploadedBy: editor.email })
			.onConflictDoNothing({ target: media.path })
			.returning({ id: media.id });
		const id = row?.id ?? (await db.select({ id: media.id }).from(media).where(eq(media.path, path)).limit(1))[0]?.id;
		if (!id) return problem(500, 'The file uploaded but could not be saved to the library. Try again.');

		if (row) await logActivity(editor, { entityType: 'media', entityId: id, label: filename, action: 'uploaded' });

		return Response.json(
			{ id, url, path, filename, mimeType: expected, size, width, height, alt },
			{ status: 201, headers: NO_STORE }
		);
	} catch (err) {
		if (isHttpError(err)) return problem(err.status, err.body.message);
		console.error('Could not finish the upload', err);
		return problem(500, 'Could not finish the upload. Try again.');
	}
};
