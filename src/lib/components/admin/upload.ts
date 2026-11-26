/**
 * Browser side of uploads. Files go straight from the browser to Supabase Storage, so Vercel's
 * 4.5 MB request limit never applies:
 *
 *   1. POST /admin/api/upload { filename, mimeType, size, folder, width, height } → the server
 *      checks folder, type and size and answers a signed upload URL;
 *   2. the file is PUT to that URL (XMLHttpRequest, for progress events), the same request
 *      supabase-js `uploadToSignedUrl` makes;
 *   3. POST /admin/api/upload/complete → the server checks the stored object and records the
 *      media row (and an activity entry).
 *
 * Every image is compressed first (compressImage): JPEG, PNG and WebP are resized to at most
 * 2400px on the long side and re-encoded as WebP, which also drops EXIF data such as the GPS
 * location. GIFs (animation) and AVIFs are left alone, and a file is never made bigger.
 *
 *     const media = await uploadFile(file, { folder: 'posts', onProgress: (f) => (progress = f) });
 *     media.url                                    // public URL in the "media" bucket
 *     toast.success(`Uploaded. ${savings(media)}`) // "4.2 MB → 380 KB"
 */

/** Folders the upload endpoint accepts (the first path segment inside the bucket). */
export const UPLOAD_FOLDERS = ['projects', 'posts', 'people', 'pages', 'archive', 'sponsors', 'media'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** Keep in sync with UPLOAD_RULES in src/lib/server/storage.ts (no SVG). */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'] as const;
export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;
export const MODEL_TYPES = ['model/gltf-binary', 'model/gltf+json'] as const;
export const UPLOAD_TYPES = [...IMAGE_TYPES, 'application/pdf', ...VIDEO_TYPES, ...MODEL_TYPES] as const;

const MB = 1024 * 1024;

/** Largest file per type, after compression (the server checks the same limits). */
export const UPLOAD_LIMITS: Record<string, number> = {
	'image/png': 10 * MB,
	'image/jpeg': 10 * MB,
	'image/webp': 10 * MB,
	'image/gif': 10 * MB,
	'image/avif': 10 * MB,
	'application/pdf': 20 * MB,
	'video/mp4': 50 * MB,
	'video/webm': 50 * MB,
	'model/gltf-binary': 25 * MB,
	'model/gltf+json': 25 * MB
};

/** File extensions, for browsers that don't know a type (.glb is usually reported as ''). */
const EXTENSION_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	jfif: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	pdf: 'application/pdf',
	mp4: 'video/mp4',
	m4v: 'video/mp4',
	webm: 'video/webm',
	glb: 'model/gltf-binary',
	gltf: 'model/gltf+json'
};

/** For <input type="file" accept>: MIME types plus the extensions browsers don't map. */
export function acceptAttribute(types: readonly string[] = UPLOAD_TYPES): string {
	const extensions = Object.entries(EXTENSION_TYPES)
		.filter(([, type]) => types.includes(type))
		.map(([ext]) => `.${ext}`);
	return [...types, ...extensions].join(',');
}

/** @deprecated Uploads no longer pass through Vercel; kept for older callers. */
export const MAX_REQUEST_BYTES = 4.4 * MB;

export type UploadedMedia = {
	/** media row id */
	id: string;
	/** Public URL. */
	url: string;
	/** Object path in the bucket. */
	path: string;
	filename: string;
	mimeType: string;
	/** Bytes uploaded (after compression). */
	size: number;
	/** Bytes of the file that was picked. */
	originalSize: number;
	/** Pixel size, for images. */
	width?: number;
	height?: number;
	alt: string;
	/** True when the image was resized or re-encoded. */
	compressed: boolean;
};

export type UploadOptions = {
	/** Folder in the bucket, one of UPLOAD_FOLDERS. */
	folder: UploadFolder | (string & {});
	/** Alt text to store on the media row. */
	alt?: string;
	/** Called with 0 to 1 as the file goes up. */
	onProgress?: (fraction: number) => void;
	/** Skip resizing and re-encoding ("Keep original quality"). EXIF is still removed from JPEGs. */
	keepOriginal?: boolean;
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

/** "4.2 MB", "380 KB". */
export function formatBytes(bytes: number): string {
	if (bytes >= MB) return `${(bytes / MB).toFixed(1).replace(/\.0$/, '')} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${bytes} bytes`;
}

/** "4.2 MB → 380 KB" when the upload was compressed, else ''. For toasts. */
export function savings(media: Pick<UploadedMedia, 'originalSize' | 'size' | 'compressed'>): string {
	if (!media.compressed || media.size >= media.originalSize) return '';
	return `${formatBytes(media.originalSize)} → ${formatBytes(media.size)}`;
}

function extensionOf(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** The upload type of a file: its MIME type, or by extension when the browser reports none. */
export function fileType(file: File): string {
	const reported = file.type.toLowerCase();
	if (reported === 'image/jpg') return 'image/jpeg';
	if (reported && reported !== 'application/octet-stream' && !(reported === 'application/json' && extensionOf(file.name) === 'gltf')) {
		return reported;
	}
	return EXTENSION_TYPES[extensionOf(file.name)] ?? reported;
}

function typesMessage(accept: readonly string[]): string {
	if (accept.every((t) => t.startsWith('image/'))) return 'Upload a PNG, JPEG, WebP, GIF or AVIF image. SVG is not allowed.';
	return 'Upload a PNG, JPEG, WebP, GIF or AVIF image, a PDF, an MP4 or WebM video, or a GLB or glTF model.';
}

/**
 * A message for a file the endpoint would refuse, or null when it looks fine. Images are
 * checked against the limit after compression, in uploadFile.
 */
export function checkFile(file: File, accept: readonly string[] = UPLOAD_TYPES): string | null {
	const type = fileType(file);
	if (type === 'image/svg+xml' || extensionOf(file.name) === 'svg') return 'SVG files are not allowed. Export the image as PNG or WebP.';
	if (!accept.includes(type)) return typesMessage(accept);
	if (file.size === 0) return 'That file is empty.';
	const limit = UPLOAD_LIMITS[type];
	// Photos shrink a lot before upload, so only refuse the truly huge ones here.
	const ceiling = RESIZABLE.has(type) ? 60 * MB : limit;
	if (limit && file.size > ceiling) return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(limit)}.`;
	return null;
}

/* ------------------------------------------------------------------------------------------ */
/* Image compression                                                                           */
/* ------------------------------------------------------------------------------------------ */

const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type PreparedImage = {
	file: File;
	width?: number;
	height?: number;
	originalSize: number;
	compressed: boolean;
};

export type CompressOptions = {
	/** Longest side in pixels. Default 2400. */
	maxEdge?: number;
	/** WebP quality, 0 to 1. Default 0.82. */
	quality?: number;
	/** Don't resize or re-encode (EXIF is still removed from JPEGs). */
	keepOriginal?: boolean;
};

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(width: number, height: number): AnyCanvas {
	if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

function encode(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob | null> {
	if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality }).catch(() => null);
	return new Promise((done) => (canvas as HTMLCanvasElement).toBlob(done, type, quality));
}

function hasTransparency(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number): boolean {
	const { data } = ctx.getImageData(0, 0, width, height);
	for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
	return false;
}

/** EXIF orientation (1 to 8) of a JPEG, 1 when there is none. */
export function jpegOrientation(bytes: Uint8Array): number {
	if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
	let i = 2;
	while (i + 4 <= bytes.length && bytes[i] === 0xff) {
		const marker = bytes[i + 1];
		if (marker === 0xda || marker === 0xd9) break;
		const length = (bytes[i + 2] << 8) | bytes[i + 3];
		if (length < 2) break;
		const isExif =
			marker === 0xe1 && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66;
		if (isExif) {
			const tiff = i + 10;
			const end = Math.min(bytes.length, i + 2 + length);
			const little = bytes[tiff] === 0x49;
			const r16 = (o: number) => (o + 1 < end ? (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]) : -1);
			const r32 = (o: number) =>
				o + 3 < end
					? little
						? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
						: ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0
					: -1;
			const ifd = tiff + r32(tiff + 4);
			const count = r16(ifd);
			for (let k = 0; k < count && k < 500; k++) {
				const entry = ifd + 2 + k * 12;
				if (r16(entry) === 0x0112) {
					const value = r16(entry + 8);
					return value >= 1 && value <= 8 ? value : 1;
				}
			}
			return 1;
		}
		i += 2 + length;
	}
	return 1;
}

/**
 * The JPEG without its metadata segments (APP1 Exif/XMP with GPS and camera details, APP13
 * IPTC, comments). Lossless: the image data is untouched. Null when it isn't a plain JPEG.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
	if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
	const parts: Uint8Array[] = [bytes.subarray(0, 2)];
	let i = 2;
	while (i < bytes.length) {
		if (bytes[i] !== 0xff) return null;
		while (bytes[i + 1] === 0xff) i++; // fill bytes
		const marker = bytes[i + 1];
		if (marker === 0xda) {
			parts.push(bytes.subarray(i)); // start of scan: the rest is image data
			break;
		}
		if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
			parts.push(bytes.subarray(i, i + 2));
			i += 2;
			continue;
		}
		if (i + 4 > bytes.length) return null;
		const length = (bytes[i + 2] << 8) | bytes[i + 3];
		if (length < 2 || i + 2 + length > bytes.length) return null;
		if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) parts.push(bytes.subarray(i, i + 2 + length));
		i += 2 + length;
	}
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function renamed(name: string, ext: string): string {
	return `${name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`;
}

/**
 * Compress an image for the web: at most `maxEdge` (2400) pixels on the long side, re-encoded
 * as WebP at `quality` (0.82), EXIF orientation applied and metadata (GPS) removed. GIFs and
 * AVIFs, files the browser can't decode and results that would be bigger come back unchanged
 * (JPEGs still lose their metadata). Never throws.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<PreparedImage> {
	const { maxEdge = 2400, quality = 0.82, keepOriginal = false } = options;
	const type = fileType(file);
	const original: PreparedImage = { file, originalSize: file.size, compressed: false };
	if (!type.startsWith('image/') || typeof createImageBitmap !== 'function') return original;

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		return original; // The browser can't decode it; let the server decide.
	}
	const width = bitmap.width;
	const height = bitmap.height;
	const result: PreparedImage = { ...original, width, height };

	try {
		if (!RESIZABLE.has(type)) return result; // GIF keeps its animation; AVIF is already small.

		let orientation = 1;
		let bytes: Uint8Array | null = null;
		if (type === 'image/jpeg') {
			bytes = new Uint8Array(await file.arrayBuffer());
			orientation = jpegOrientation(bytes);
		}
		/** The original, minus JPEG metadata when that is safe (upright photos). */
		const keepAsIs = (): PreparedImage => {
			if (bytes && orientation === 1) {
				const stripped = stripJpegMetadata(bytes);
				if (stripped && stripped.length < file.size) {
					const blob = new Blob([stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength) as ArrayBuffer], { type: 'image/jpeg' });
					return { ...result, file: new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) };
				}
			}
			return result;
		};

		const longest = Math.max(width, height);
		const scale = keepOriginal ? 1 : Math.min(1, maxEdge / longest);
		const targetW = Math.max(1, Math.round(width * scale));
		const targetH = Math.max(1, Math.round(height * scale));

		// A rotated JPEG kept "as is" would lose its orientation with its EXIF, so it is
		// re-encoded upright at high quality instead.
		if (keepOriginal && !(bytes && orientation !== 1)) return keepAsIs();

		const canvas = makeCanvas(targetW, targetH);
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
		if (!ctx) return keepAsIs();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bitmap, 0, 0, targetW, targetH);

		let blob: Blob | null;
		let ext = 'webp';
		if (keepOriginal) {
			blob = await encode(canvas, 'image/jpeg', 0.95);
			ext = 'jpg';
		} else {
			blob = await encode(canvas, 'image/webp', quality);
			if (!blob || blob.type !== 'image/webp') {
				// No WebP encoder (older Safari): JPEG for photos, PNG when there is transparency.
				const alpha = type !== 'image/jpeg' && hasTransparency(ctx, targetW, targetH);
				blob = await encode(canvas, alpha ? 'image/png' : 'image/jpeg', alpha ? undefined : 0.85);
				ext = alpha ? 'png' : 'jpg';
			}
		}
		if (!blob) return keepAsIs();

		const mustReencode = bytes !== null && orientation !== 1;
		if (blob.size >= file.size && !mustReencode) {
			// Never upload a bigger file. Keep the original (a PNG with transparency stays a PNG).
			return keepAsIs();
		}
		return {
			file: new File([blob], renamed(file.name, ext), { type: blob.type, lastModified: Date.now() }),
			width: targetW,
			height: targetH,
			originalSize: file.size,
			compressed: true
		};
	} catch {
		return result;
	} finally {
		bitmap.close();
	}
}

/**
 * @deprecated Use compressImage (uploadFile calls it for you). Kept for older callers:
 * returns the compressed file, or a message when the file is still too large.
 */
export async function prepareImage(file: File, { maxEdge = 2400 }: { maxEdge?: number; maxBytes?: number } = {}): Promise<File | string> {
	const prepared = await compressImage(file, { maxEdge });
	const limit = UPLOAD_LIMITS[fileType(prepared.file)];
	if (limit && prepared.file.size > limit) return `That file is ${formatBytes(prepared.file.size)}. The limit is ${formatBytes(limit)}.`;
	return prepared.file;
}

/* ------------------------------------------------------------------------------------------ */
/* Upload                                                                                       */
/* ------------------------------------------------------------------------------------------ */

function messageFrom(status: number, text: string): string {
	try {
		const body = JSON.parse(text) as { message?: unknown };
		if (typeof body.message === 'string' && body.message) return body.message;
	} catch {
		// Not JSON: the admin hook answers 401 in plain text, proxies answer in HTML.
	}
	if (status === 401) return 'Your session has ended. Sign in again, then retry the upload.';
	if (status === 403) return 'You are not allowed to upload files.';
	if (status === 413) return 'That file is too big to upload.';
	if (status === 0) return 'The upload did not reach the server. Check your connection.';
	const trimmed = text.trim();
	return trimmed && trimmed.length < 200 && !trimmed.startsWith('<') ? trimmed : `Upload failed (${status}).`;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify(body),
			signal
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') throw err;
		throw new UploadError(messageFrom(0, ''), 0);
	}
	const text = await response.text();
	if (!response.ok) throw new UploadError(messageFrom(response.status, text), response.status);
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new UploadError('The server sent an unexpected answer.', response.status);
	}
}

function storageMessage(status: number, text: string): string {
	try {
		const body = JSON.parse(text) as { message?: unknown; error?: unknown };
		const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : '';
		if (/size|too large|exceeded/i.test(message) || status === 413) return 'Storage refused the file: it is too large.';
		if (/mime|type/i.test(message)) return 'Storage refused the file type.';
		if (/expired|signature|token/i.test(message)) return 'The upload link expired. Try again.';
		if (message) return `Storage refused the file: ${message}`;
	} catch {
		// fall through
	}
	return status === 0 ? 'The upload did not reach storage. Check your connection.' : `Storage refused the file (${status}).`;
}

/**
 * PUT the file to a Supabase signed upload URL, like storage-js `uploadToSignedUrl` does in a
 * browser: multipart form data with `cacheControl` and the file, and `x-upsert: false`.
 */
function putToSignedUrl(signedUrl: string, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) return reject(new DOMException('Upload cancelled', 'AbortError'));
		const body = new FormData();
		body.append('cacheControl', '31536000');
		body.append('', file);

		const xhr = new XMLHttpRequest();
		xhr.open('PUT', signedUrl);
		xhr.setRequestHeader('x-upsert', 'false');
		xhr.responseType = 'text';
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else reject(new UploadError(storageMessage(xhr.status, xhr.responseText), xhr.status));
		};
		xhr.onerror = () => reject(new UploadError(storageMessage(0, ''), 0));
		xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
		signal?.addEventListener('abort', () => xhr.abort(), { once: true });
		xhr.send(body);
	});
}

type SignedUpload = { path: string; signedUrl: string; token: string; publicUrl: string; mimeType: string };
type CompletedUpload = { id: string; url: string; path: string; filename: string; mimeType: string; size: number; alt: string };

/**
 * Upload one file (images are compressed first). Rejects with an UploadError whose message is
 * fit for a toast, or a DOMException named AbortError when `signal` aborts.
 */
export async function uploadFile(file: File, options: UploadOptions): Promise<UploadedMedia> {
	const { folder, alt = '', onProgress, keepOriginal = false, signal } = options;
	const report = (fraction: number) => onProgress?.(Math.max(0, Math.min(1, fraction)));
	report(0);

	const problem = checkFile(file);
	if (problem) throw new UploadError(problem, 400);

	const prepared = await compressImage(file, { keepOriginal });
	if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
	const type = fileType(prepared.file);
	const limit = UPLOAD_LIMITS[type];
	if (limit && prepared.file.size > limit) {
		throw new UploadError(`That file is ${formatBytes(prepared.file.size)} even after compression. The limit is ${formatBytes(limit)}.`, 400);
	}
	report(0.02);

	// 1. Ask for a signed upload URL.
	const signed = await postJson<SignedUpload>(
		'/admin/api/upload',
		{
			filename: prepared.file.name,
			mimeType: type,
			size: prepared.file.size,
			folder,
			width: prepared.width,
			height: prepared.height
		},
		signal
	);

	// 2. Send the file to Storage with the type the server settled on (.glb arrives as '').
	const typed = prepared.file.type === signed.mimeType ? prepared.file : new File([prepared.file], prepared.file.name, { type: signed.mimeType });
	await putToSignedUrl(signed.signedUrl, typed, (f) => report(0.02 + f * 0.93), signal);
	report(0.96);

	// 3. Record it.
	const done = await postJson<CompletedUpload>(
		'/admin/api/upload/complete',
		{
			path: signed.path,
			filename: prepared.file.name,
			mimeType: signed.mimeType,
			size: typed.size,
			width: prepared.width,
			height: prepared.height,
			alt
		},
		signal
	);
	report(1);

	return {
		id: done.id,
		url: done.url,
		path: done.path,
		filename: done.filename,
		mimeType: done.mimeType,
		size: done.size,
		originalSize: prepared.originalSize,
		width: prepared.width,
		height: prepared.height,
		alt: done.alt ?? alt,
		compressed: prepared.compressed
	};
}
