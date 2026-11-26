/**
 * Browser side of uploads: POST a file to /admin/api/upload as multipart form data and get
 * back the stored media row. ImageField uses this; call it directly for anything else
 * (a Media library page, a PDF field...).
 *
 *     const media = await uploadFile(file, { folder: 'posts', onProgress: (p) => (percent = p) });
 *     media.url  // public URL in the Supabase "media" bucket
 */

/** Folders the upload endpoint accepts (the first path segment inside the bucket). */
export const UPLOAD_FOLDERS = ['projects', 'posts', 'people', 'pages', 'archive', 'sponsors', 'media'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** Keep in sync with ALLOWED_UPLOAD_TYPES in src/lib/server/storage.ts (no SVG). */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'] as const;
export const UPLOAD_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

/**
 * Vercel functions accept request bodies up to 4.5 MB, below the bucket's 10 MB limit, so
 * large photos are resized in the browser first (see `prepareImage`).
 */
export const MAX_REQUEST_BYTES = 4.4 * 1024 * 1024;

export type UploadedMedia = {
	id: string;
	url: string;
	path: string;
	filename: string;
	mimeType: string;
	size: number;
};

export type UploadOptions = {
	folder: UploadFolder;
	/** Alt text to store on the media row. */
	alt?: string;
	/** Called with 0 to 100 as the file goes up. */
	onProgress?: (percent: number) => void;
	signal?: AbortSignal;
};

export class UploadError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'UploadError';
	}
}

function readMessage(xhr: XMLHttpRequest): string {
	try {
		const body = JSON.parse(xhr.responseText) as { message?: unknown };
		if (typeof body.message === 'string' && body.message) return body.message;
	} catch {
		// Not JSON: the admin hook answers 401 in plain text, Vercel answers 413 in HTML.
	}
	if (xhr.status === 401) return 'Your session has ended. Sign in again, then retry the upload.';
	if (xhr.status === 413) return 'That file is too big to upload. Use one under 4 MB.';
	if (xhr.status === 0) return 'The upload did not reach the server. Check your connection.';
	const text = xhr.responseText.trim();
	return text && text.length < 200 && !text.startsWith('<') ? text : `Upload failed (${xhr.status}).`;
}

/** Upload one file. Rejects with an UploadError carrying a message fit for a toast. */
export function uploadFile(file: File, options: UploadOptions): Promise<UploadedMedia> {
	const { folder, alt, onProgress, signal } = options;
	return new Promise((resolve, reject) => {
		if (signal?.aborted) return reject(new DOMException('Upload cancelled', 'AbortError'));

		const body = new FormData();
		body.set('file', file);
		body.set('folder', folder);
		if (alt) body.set('alt', alt);

		const xhr = new XMLHttpRequest();
		xhr.open('POST', '/admin/api/upload');
		xhr.setRequestHeader('accept', 'application/json');
		xhr.responseType = 'text';

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					resolve(JSON.parse(xhr.responseText) as UploadedMedia);
				} catch {
					reject(new UploadError('The server sent an unexpected answer.', xhr.status));
				}
			} else {
				reject(new UploadError(readMessage(xhr), xhr.status));
			}
		};
		xhr.onerror = () => reject(new UploadError(readMessage(xhr), xhr.status));
		xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
		signal?.addEventListener('abort', () => xhr.abort(), { once: true });

		onProgress?.(0);
		xhr.send(body);
	});
}

/** A message for a file the endpoint would refuse, or null when it looks fine. */
export function checkFile(file: File, accept: readonly string[] = UPLOAD_TYPES): string | null {
	if (!accept.includes(file.type)) {
		const images = accept.every((t) => t.startsWith('image/'));
		return images
			? 'Upload a PNG, JPEG, WebP, GIF or AVIF image. SVG is not allowed.'
			: 'Upload a PNG, JPEG, WebP, GIF, AVIF or PDF file.';
	}
	if (file.size === 0) return 'That file is empty.';
	return null;
}

const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Shrink big photos before upload: JPEG, PNG and WebP images larger than `maxEdge` pixels or
 * `maxBytes` are redrawn at most `maxEdge` wide or tall and saved as WebP. Other files, and
 * images the browser can't decode, come back unchanged. Returns a message instead when the
 * file would still be too large to send.
 */
export async function prepareImage(
	file: File,
	{ maxEdge = 2560, maxBytes = 3 * 1024 * 1024 }: { maxEdge?: number; maxBytes?: number } = {}
): Promise<File | string> {
	let result = file;
	if (RESIZABLE.has(file.type) && typeof createImageBitmap === 'function') {
		try {
			const bitmap = await createImageBitmap(file);
			const longest = Math.max(bitmap.width, bitmap.height);
			if (longest > maxEdge || file.size > maxBytes) {
				const scale = Math.min(1, maxEdge / longest);
				const width = Math.round(bitmap.width * scale);
				const height = Math.round(bitmap.height * scale);
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
				const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.86));
				if (blob && blob.type === 'image/webp' && blob.size < file.size) {
					const base = file.name.replace(/\.[^.]+$/, '') || 'image';
					result = new File([blob], `${base}.webp`, { type: 'image/webp', lastModified: Date.now() });
				}
			}
			bitmap.close();
		} catch {
			// The browser could not decode it; send the original and let the server decide.
		}
	}
	if (result.size > MAX_REQUEST_BYTES) {
		return 'That file is over 4 MB, too big to upload here. Export a smaller version and try again.';
	}
	return result;
}
