import { isHttpError } from '@sveltejs/kit';
import { logActivity } from '#lib/server/activity.ts';
import { requireEditor, type SessionEditor } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { media } from '#lib/server/db/schema.ts';
import {
	buildObjectPath,
	checkUploadSize,
	createSignedUpload,
	deleteMedia,
	resolveUploadType,
	uploadMedia
} from '#lib/server/storage.ts';
import { storageConfigured } from '#lib/server/supabase.ts';
import { parseSubmittedJson, stripNul } from '#lib/components/admin/form-data.ts';
import { UPLOAD_FOLDERS } from '#lib/components/admin/upload.ts';
import { clip } from '#lib/utils.js';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

function problem(status: number, message: string, errors?: Record<string, string>): Response {
	return Response.json(errors ? { message, errors } : { message }, { status, headers: NO_STORE });
}

function readDimension(value: unknown): number | null {
	const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null;
}

/**
 * Step 1 of an upload (see uploadFile() in src/lib/components/admin/upload.ts).
 *
 * JSON `{ filename, mimeType, size, folder, width?, height? }`: checks the folder, the type
 * (by MIME type, or by extension for .glb/.gltf that browsers report as octet-stream) and the
 * size limit for that type, then answers `{ path, signedUrl, token, publicUrl, mimeType }`.
 * The browser uploads the file to `signedUrl` itself (no Vercel body limit) and then calls
 * POST /admin/api/upload/complete.
 *
 * Multipart `file`, `folder`, `alt` still works for small files (Vercel caps bodies at 4.5 MB):
 * the server uploads and answers the media row like /complete does.
 *
 * Errors: `{ message, errors? }` with 400 (invalid), 401 (signed out), 413 (too big),
 * 503 (storage not configured) or 502 (Storage refused).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	let editor;
	try {
		editor = requireEditor(locals);
	} catch (err) {
		if (isHttpError(err)) return problem(err.status, err.body.message);
		throw err;
	}

	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('multipart/form-data')) return multipartUpload(request, editor);

	let body: Record<string, unknown>;
	try {
		const text = await request.text();
		if (text.length > 4096) return problem(413, 'The upload request is too large.');
		body = parseSubmittedJson(text) as Record<string, unknown>;
		if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
	} catch {
		return problem(400, 'Send the upload details as JSON: filename, mimeType, size and folder.');
	}

	const filename = typeof body.filename === 'string' ? body.filename.trim().slice(0, 300) : '';
	const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
	const size = typeof body.size === 'number' ? body.size : Number(body.size);
	const folder = typeof body.folder === 'string' ? body.folder : '';

	const errors: Record<string, string> = {};
	if (!(UPLOAD_FOLDERS as readonly string[]).includes(folder)) {
		errors.folder = `Unknown upload folder. Use one of: ${UPLOAD_FOLDERS.join(', ')}.`;
	}
	if (!filename) errors.filename = 'The file needs a name.';
	const resolved = resolveUploadType(filename || 'file', mimeType);
	if ('message' in resolved) errors.mimeType = resolved.message;
	else {
		const tooBig = checkUploadSize(size, resolved);
		if (tooBig) errors.size = tooBig;
	}
	const first = Object.values(errors)[0];
	if (first || 'message' in resolved) return problem(400, first ?? 'Check the file.', errors);

	if (!storageConfigured) {
		return problem(503, 'Uploads are not set up yet: add SUPABASE_URL and SUPABASE_SECRET_KEY to the environment.');
	}

	const isImage = resolved.rule.kind === 'image';
	const path = buildObjectPath(folder, filename, resolved.extension, {
		width: isImage ? readDimension(body.width) : null,
		height: isImage ? readDimension(body.height) : null
	});

	try {
		const signed = await createSignedUpload(path);
		return Response.json(
			{
				path: signed.path,
				signedUrl: signed.signedUrl,
				token: signed.token,
				publicUrl: signed.publicUrl,
				mimeType: resolved.mimeType,
				maxBytes: resolved.rule.maxBytes
			},
			{ headers: NO_STORE }
		);
	} catch (err) {
		if (isHttpError(err)) return problem(err.status, err.body.message);
		console.error('Could not start the upload', err);
		return problem(500, 'Could not start the upload. Try again.');
	}
};

/** The old one-request upload, for small files and clients that post multipart. */
async function multipartUpload(request: Request, editor: SessionEditor): Promise<Response> {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return problem(400, 'Send the file as multipart form data.');
	}

	const file = form.get('file');
	const folder = String(form.get('folder') ?? '');
	const altRaw = form.get('alt');
	const alt = typeof altRaw === 'string' ? clip(stripNul(altRaw).trim(), 300) : '';

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
				filename: clip(stripNul(uploaded.filename), 300),
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

	await logActivity(editor, { entityType: 'media', entityId: row.id, label: uploaded.filename, action: 'uploaded' });

	return Response.json(
		{
			id: row.id,
			url: uploaded.url,
			path: uploaded.path,
			filename: uploaded.filename,
			mimeType: uploaded.mimeType,
			size: uploaded.size,
			alt
		},
		{ status: 201, headers: NO_STORE }
	);
}
