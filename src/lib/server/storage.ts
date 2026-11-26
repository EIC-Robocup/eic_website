import { error } from '@sveltejs/kit';
import { getAdminClient } from './supabase';

/**
 * Files in the public Supabase Storage "media" bucket.
 *
 * Uploads from the admin panel go straight from the browser to Storage with a signed upload
 * URL, so Vercel's 4.5 MB request limit never applies (see src/routes/admin/(app)/api/upload):
 *   1. `createSignedUpload(path)` after the server has checked folder, type and size;
 *   2. the browser PUTs the file to the signed URL;
 *   3. `statMedia(path)` confirms the object exists (and its real size and type) before the
 *      media row is written.
 *
 * The types and limits below match the bucket in supabase/migrations (media_bucket_types) and
 * [storage.buckets.media] in supabase/config.toml. No SVG: an SVG in the bucket could run
 * scripts on the storage origin.
 */

export const MEDIA_BUCKET = 'media';

const MB = 1024 * 1024;

export type UploadKind = 'image' | 'pdf' | 'video' | 'model';

export type UploadRule = {
	kind: UploadKind;
	/** File extensions, the first is the one we save with. */
	extensions: readonly string[];
	maxBytes: number;
};

export const UPLOAD_RULES = {
	'image/png': { kind: 'image', extensions: ['png'], maxBytes: 10 * MB },
	'image/jpeg': { kind: 'image', extensions: ['jpg', 'jpeg', 'jfif'], maxBytes: 10 * MB },
	'image/webp': { kind: 'image', extensions: ['webp'], maxBytes: 10 * MB },
	'image/gif': { kind: 'image', extensions: ['gif'], maxBytes: 10 * MB },
	'image/avif': { kind: 'image', extensions: ['avif'], maxBytes: 10 * MB },
	'application/pdf': { kind: 'pdf', extensions: ['pdf'], maxBytes: 20 * MB },
	'video/mp4': { kind: 'video', extensions: ['mp4', 'm4v'], maxBytes: 50 * MB },
	'video/webm': { kind: 'video', extensions: ['webm'], maxBytes: 50 * MB },
	'model/gltf-binary': { kind: 'model', extensions: ['glb'], maxBytes: 25 * MB },
	'model/gltf+json': { kind: 'model', extensions: ['gltf'], maxBytes: 25 * MB }
} as const satisfies Record<string, UploadRule>;

export type UploadMimeType = keyof typeof UPLOAD_RULES;

export const ALLOWED_UPLOAD_TYPES = Object.keys(UPLOAD_RULES) as UploadMimeType[];

/** The bucket's own limit (the largest per-type limit). */
export const MAX_UPLOAD_BYTES = 50 * MB;

/** Browsers send these (or nothing) for files they don't know, like .glb. */
const GENERIC_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-binary']);

/** Types browsers use for files we know under another name. */
const TYPE_ALIASES: Record<string, UploadMimeType> = {
	'image/jpg': 'image/jpeg',
	'image/pjpeg': 'image/jpeg',
	'image/x-png': 'image/png',
	'model/gltf.binary': 'model/gltf-binary',
	'model/glb': 'model/gltf-binary',
	'video/x-m4v': 'video/mp4'
};

function extensionOf(filename: string): string {
	const dot = filename.lastIndexOf('.');
	return dot > 0 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

function typeForExtension(ext: string): UploadMimeType | null {
	for (const [type, rule] of Object.entries(UPLOAD_RULES)) {
		if ((rule.extensions as readonly string[]).includes(ext)) return type as UploadMimeType;
	}
	return null;
}

export function formatBytes(bytes: number): string {
	if (bytes >= MB) return `${Math.round((bytes / MB) * 10) / 10} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${bytes} bytes`;
}

const KIND_NAMES: Record<UploadKind, string> = { image: 'Images', pdf: 'PDFs', video: 'Videos', model: '3D models' };

export const TYPES_HINT = 'Upload a PNG, JPEG, WebP, GIF or AVIF image, a PDF, an MP4 or WebM video, or a GLB or glTF model.';

export type ResolvedType = { mimeType: UploadMimeType; extension: string; rule: UploadRule };

/**
 * The upload type for a file, from what the browser reported and the file name. Browsers
 * often report '' or application/octet-stream for .glb/.gltf, so those go by extension.
 * Returns a message (for a 400) when the file isn't allowed.
 */
export function resolveUploadType(filename: string, reported: string): ResolvedType | { message: string } {
	const ext = extensionOf(filename);
	let type = reported.split(';')[0].trim().toLowerCase();
	type = TYPE_ALIASES[type] ?? type;
	if (type === 'image/svg+xml' || ext === 'svg' || ext === 'svgz') {
		return { message: 'SVG files are not allowed. Export the image as PNG or WebP.' };
	}
	if (GENERIC_TYPES.has(type) || (type === 'application/json' && ext === 'gltf')) {
		const byExt = typeForExtension(ext);
		if (!byExt) return { message: TYPES_HINT };
		type = byExt;
	}
	if (!(type in UPLOAD_RULES)) return { message: TYPES_HINT };
	const mimeType = type as UploadMimeType;
	const rule: UploadRule = UPLOAD_RULES[mimeType];
	// Save under the extension that matches the type (a photo.jpeg re-encoded to WebP is .webp).
	const extension = (rule.extensions as readonly string[]).includes(ext) && ext !== 'jfif' ? ext : rule.extensions[0];
	return { mimeType, extension, rule };
}

/** A message when `size` is over the limit for the type (or empty), else null. */
export function checkUploadSize(size: number, resolved: ResolvedType): string | null {
	if (!Number.isFinite(size) || size <= 0) return 'That file is empty.';
	if (size > resolved.rule.maxBytes) {
		return `${KIND_NAMES[resolved.rule.kind]} must be ${formatBytes(resolved.rule.maxBytes)} or smaller. This one is ${formatBytes(size)}.`;
	}
	return null;
}

function safeBase(name: string): string {
	const dot = name.lastIndexOf('.');
	return (
		(dot > 0 ? name.slice(0, dot) : name)
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60)
			.replace(/-+$/g, '') || 'file'
	);
}

/**
 * The object path for a new upload: `posts/m3k9x2a1-4f9c2e1b-walkie-arm-2400x1600.webp`. Images
 * carry their pixel size in the name, so the post renderer can set width and height (no layout
 * shift) without a database lookup.
 */
export function buildObjectPath(
	folder: string,
	filename: string,
	extension: string,
	size?: { width?: number | null; height?: number | null }
): string {
	const stamp = Date.now().toString(36);
	const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
	const w = size?.width && Number.isInteger(size.width) && size.width > 0 && size.width <= 20000 ? size.width : null;
	const h = size?.height && Number.isInteger(size.height) && size.height > 0 && size.height <= 20000 ? size.height : null;
	const dims = w && h ? `-${w}x${h}` : '';
	return `${folder}/${stamp}-${random}-${safeBase(filename)}${dims}.${extension}`;
}

/** Paths made by buildObjectPath in one of `folders` (refuses `..`, slashes in names, etc.). */
export function isValidObjectPath(path: string, folders: readonly string[]): boolean {
	const match = /^([a-z]+)\/[a-z0-9]{6,12}-[a-f0-9]{8}-[a-z0-9-]{1,60}(?:-\d{1,5}x\d{1,5})?\.([a-z0-9]{2,5})$/.exec(path);
	return Boolean(match && folders.includes(match[1]) && typeForExtension(match[2]));
}

/** The MIME type an object path's extension stands for. */
export function typeForPath(path: string): UploadMimeType | null {
	return typeForExtension(extensionOf(path));
}

function requireClient() {
	const client = getAdminClient();
	if (!client) error(503, 'Uploads are not set up yet: add SUPABASE_URL and SUPABASE_SECRET_KEY.');
	return client;
}

/** Public URL of an object in the media bucket. */
export function publicUrl(path: string): string {
	return requireClient().storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export type SignedUpload = { path: string; signedUrl: string; token: string; publicUrl: string };

/**
 * A signed URL the browser can upload one file to (valid for 2 hours, no overwrite). Throws a
 * 503 when storage is not configured and a 502 when Storage refuses.
 */
export async function createSignedUpload(path: string): Promise<SignedUpload> {
	const client = requireClient();
	const bucket = client.storage.from(MEDIA_BUCKET);
	const { data, error: signError } = await bucket.createSignedUploadUrl(path);
	if (signError || !data) {
		console.error('Could not create a signed upload URL', signError);
		error(502, `Storage refused the upload: ${signError?.message ?? 'no URL returned'}.`);
	}
	return { path: data.path, signedUrl: data.signedUrl, token: data.token, publicUrl: bucket.getPublicUrl(path).data.publicUrl };
}

/** Size and type of an uploaded object, or null when it isn't there. */
export async function statMedia(path: string): Promise<{ size: number | null; mimeType: string | null } | null> {
	const client = requireClient();
	const { data, error: infoError } = await client.storage.from(MEDIA_BUCKET).info(path);
	if (infoError || !data) {
		const status = (infoError as { status?: number; statusCode?: string | number } | null)?.status;
		if (status === 404 || status === 400 || /not.?found|NoSuchKey/i.test(infoError?.message ?? '')) return null;
		console.error('Could not read the uploaded file', infoError);
		error(502, 'Could not check the upload with Storage. Try again.');
	}
	const info = data as Record<string, unknown> & { metadata?: Record<string, unknown> | null };
	const size = Number(info.size ?? info.metadata?.size ?? info.metadata?.contentLength);
	const type = info.contentType ?? info.metadata?.mimetype ?? info.metadata?.contentType;
	return { size: Number.isFinite(size) ? size : null, mimeType: typeof type === 'string' ? type : null };
}

export type UploadResult = { path: string; url: string; filename: string; mimeType: string; size: number };

/**
 * Upload a file from the server (used by the multipart fallback of /admin/api/upload, which
 * Vercel limits to about 4.5 MB). Throws a 400 for files of the wrong type or size and a 503
 * when storage is not configured.
 */
export async function uploadMedia(file: File, folder = 'media'): Promise<UploadResult> {
	const client = requireClient();
	if (!(file instanceof File) || file.size === 0) error(400, 'Choose a file to upload.');
	const resolved = resolveUploadType(file.name, file.type);
	if ('message' in resolved) error(400, resolved.message);
	const tooBig = checkUploadSize(file.size, resolved);
	if (tooBig) error(400, tooBig);

	const cleanFolder = folder.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'media';
	const path = buildObjectPath(cleanFolder, file.name, resolved.extension);
	const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
		contentType: resolved.mimeType,
		cacheControl: '31536000',
		upsert: false
	});
	if (uploadError) {
		console.error('Upload failed', uploadError);
		error(502, `Upload failed: ${uploadError.message}`);
	}
	const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
	return { path, url: data.publicUrl, filename: file.name, mimeType: resolved.mimeType, size: file.size };
}

/** Delete a file from the media bucket. Missing files are ignored. */
export async function deleteMedia(path: string): Promise<void> {
	const client = requireClient();
	const { error: removeError } = await client.storage.from(MEDIA_BUCKET).remove([path]);
	if (removeError) {
		console.error('Delete failed', removeError);
		error(502, `Could not delete the file: ${removeError.message}`);
	}
}
