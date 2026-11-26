import { isHttpError } from '@sveltejs/kit';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { media } from '#lib/server/db/schema.ts';
import { deleteMedia, uploadMedia } from '#lib/server/storage.ts';
import { UPLOAD_FOLDERS } from '#lib/components/admin/upload.ts';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

function problem(status: number, message: string): Response {
	return Response.json({ message }, { status, headers: NO_STORE });
}

/**
 * Upload one file into the media bucket: multipart `file`, `folder` (one of UPLOAD_FOLDERS)
 * and an optional `alt`. Answers `{ id, url, path, filename, mimeType, size }`, or
 * `{ message }` with a 4xx/5xx status. Used by ImageField through uploadFile() in
 * src/lib/components/admin/upload.ts.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	let editor;
	try {
		editor = requireEditor(locals);
	} catch (err) {
		if (isHttpError(err)) return problem(err.status, err.body.message);
		throw err;
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return problem(400, 'Send the file as multipart form data.');
	}

	const file = form.get('file');
	const folder = String(form.get('folder') ?? '');
	const altRaw = form.get('alt');
	const alt = typeof altRaw === 'string' ? altRaw.trim().slice(0, 300) : '';

	if (!(UPLOAD_FOLDERS as readonly string[]).includes(folder)) {
		return problem(400, `Unknown upload folder. Use one of: ${UPLOAD_FOLDERS.join(', ')}.`);
	}
	if (!(file instanceof File)) return problem(400, 'Choose a file to upload.');

	let uploaded;
	try {
		uploaded = await uploadMedia(file, folder);
	} catch (err) {
		if (isHttpError(err)) return problem(err.status, err.body.message);
		console.error('Upload failed', err);
		return problem(500, 'Upload failed. Try again.');
	}

	let row: { id: string } | undefined;
	try {
		[row] = await db
			.insert(media)
			.values({
				path: uploaded.path,
				url: uploaded.url,
				filename: uploaded.filename.slice(0, 300),
				mimeType: uploaded.mimeType,
				size: uploaded.size,
				alt,
				uploadedBy: editor.email
			})
			.returning({ id: media.id });
	} catch (err) {
		console.error('Could not record the upload', err);
	}
	if (!row) {
		// Don't leave a file in the bucket that the Media library can't see.
		try {
			await deleteMedia(uploaded.path);
		} catch (err) {
			console.error('Could not remove the unrecorded upload', uploaded.path, err);
		}
		return problem(500, 'The file uploaded but could not be saved to the library. Try again.');
	}

	await logActivity(editor, {
		entityType: 'media',
		entityId: row.id,
		label: uploaded.filename,
		action: 'uploaded'
	});

	return Response.json(
		{
			id: row.id,
			url: uploaded.url,
			path: uploaded.path,
			filename: uploaded.filename,
			mimeType: uploaded.mimeType,
			size: uploaded.size
		},
		{ status: 201, headers: NO_STORE }
	);
};
