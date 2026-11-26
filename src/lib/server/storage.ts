import { error } from '@sveltejs/kit';
import { getAdminClient } from './supabase';

export const MEDIA_BUCKET = 'media';

/**
 * Matches the bucket's allowed types in supabase/migrations and config.toml.
 * No SVG: an SVG in the bucket could run scripts on the supabase.co origin.
 */
export const ALLOWED_UPLOAD_TYPES = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
	'image/avif',
	'application/pdf'
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function safeName(name: string): string {
	const dot = name.lastIndexOf('.');
	const base = (dot > 0 ? name.slice(0, dot) : name)
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
	return `${base || 'file'}${ext ? `.${ext}` : ''}`;
}

export type UploadResult = { path: string; url: string; filename: string; mimeType: string; size: number };

/**
 * Upload a file to the public media bucket under `folder/`. Throws a 400 for
 * files of the wrong type or size and a 503 when storage is not configured.
 */
export async function uploadMedia(file: File, folder = 'uploads'): Promise<UploadResult> {
	const client = getAdminClient();
	if (!client) error(503, 'Uploads are not set up yet: add SUPABASE_URL and SUPABASE_SECRET_KEY.');
	if (!(file instanceof File) || file.size === 0) error(400, 'Choose a file to upload.');
	if (file.size > MAX_UPLOAD_BYTES) error(400, 'Files must be 10 MB or smaller.');
	if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
		error(400, 'Upload a PNG, JPEG, WebP, GIF, AVIF or PDF file.');
	}

	const cleanFolder = folder.replace(/[^a-z0-9/-]/gi, '').replace(/^\/+|\/+$/g, '') || 'uploads';
	const path = `${cleanFolder}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;

	const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
		contentType: file.type,
		cacheControl: '31536000',
		upsert: false
	});
	if (uploadError) {
		console.error('Upload failed', uploadError);
		error(502, `Upload failed: ${uploadError.message}`);
	}

	const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
	return { path, url: data.publicUrl, filename: file.name, mimeType: file.type, size: file.size };
}

/** Delete a file from the media bucket. Missing files are ignored. */
export async function deleteMedia(path: string): Promise<void> {
	const client = getAdminClient();
	if (!client) error(503, 'Uploads are not set up yet.');
	const { error: removeError } = await client.storage.from(MEDIA_BUCKET).remove([path]);
	if (removeError) {
		console.error('Delete failed', removeError);
		error(502, `Could not delete the file: ${removeError.message}`);
	}
}
