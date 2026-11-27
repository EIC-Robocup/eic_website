/**
 * Helpers for the Media library: file kinds, sizes from file names, the Markdown to paste into
 * a post, and copying to the clipboard. Client safe.
 */
import { formatBytes } from '../upload.ts';

export type MediaKind = 'image' | 'video' | 'pdf' | 'model' | 'other';

/** The fields of a media row the library uses. */
export type MediaFile = {
	id: string;
	path: string;
	url: string;
	filename: string;
	mimeType: string;
	size: number;
	alt: string;
	uploadedBy: string | null;
	uploaderName: string | null;
	createdAt: Date | string;
};

/** Filter labels, in the order of the filter buttons. */
export const KIND_FILTERS: { value: Exclude<MediaKind, 'other'>; label: string; singular: string }[] = [
	{ value: 'image', label: 'Images', singular: 'Image' },
	{ value: 'video', label: 'Videos', singular: 'Video' },
	{ value: 'pdf', label: 'PDFs', singular: 'PDF' },
	{ value: 'model', label: '3D models', singular: '3D model' }
];

export function mediaKind(file: Pick<MediaFile, 'mimeType' | 'path'>): MediaKind {
	const type = file.mimeType.toLowerCase();
	if (type.startsWith('image/')) return 'image';
	if (type.startsWith('video/')) return 'video';
	if (type === 'application/pdf') return 'pdf';
	if (type.startsWith('model/') || /\.(glb|gltf)$/i.test(file.path)) return 'model';
	return 'other';
}

export function kindLabel(kind: MediaKind): string {
	return KIND_FILTERS.find((k) => k.value === kind)?.singular ?? 'File';
}

/** "WEBP", "PDF", "GLB". */
export function extensionLabel(path: string): string {
	const dot = path.lastIndexOf('.');
	return dot > 0 ? path.slice(dot + 1).toUpperCase() : '';
}

/** Pixel size from upload names like `...-2400x1600.webp`, or null. */
export function dimensions(path: string): { width: number; height: number } | null {
	const match = /-(\d{1,5})x(\d{1,5})\.[a-z0-9]+$/i.exec(path);
	return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

/** The folder in the bucket ("posts", "projects", "media"...). */
export function folderOf(path: string): string {
	return path.includes('/') ? path.slice(0, path.indexOf('/')) : '';
}

/** "dev" for dev@eicchula.club when there is no name. */
export function uploaderLabel(file: Pick<MediaFile, 'uploadedBy' | 'uploaderName'>): string {
	if (file.uploaderName?.trim()) return file.uploaderName.trim();
	return file.uploadedBy?.split('@')[0] ?? 'Unknown';
}

/** "WEBP · 405 KB · 2400 × 1600" */
export function metaLine(file: Pick<MediaFile, 'path' | 'size'>): string {
	const dims = dimensions(file.path);
	return [extensionLabel(file.path), formatBytes(file.size), dims && `${dims.width} × ${dims.height}`]
		.filter(Boolean)
		.join(' · ');
}

const escapeText = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/([\\[\]])/g, '\\$1');
const escapeUrl = (url: string) => (/[\s()<>]/.test(url) ? `<${url.replace(/[<>]/g, encodeURIComponent)}>` : url);
const baseName = (filename: string) => filename.replace(/\.[^.]+$/, '');

/**
 * The Markdown for a post: `![alt](url)` for images, videos and 3D models (the post renderer
 * turns .mp4/.webm into a player and .glb/.gltf into a 3D viewer), `[name](url)` for PDFs.
 */
export function markdownFor(file: Pick<MediaFile, 'url' | 'alt' | 'filename' | 'mimeType' | 'path'>): string {
	const kind = mediaKind(file);
	const url = escapeUrl(file.url);
	if (kind === 'pdf' || kind === 'other') return `[${escapeText(file.alt || baseName(file.filename))}](${url})`;
	return `![${escapeText(file.alt)}](${url})`;
}

/** Copy text; falls back to a hidden textarea where the Clipboard API is missing. */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Fall through to the old way (some browsers refuse without a recent click).
	}
	try {
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.append(area);
		area.select();
		const ok = document.execCommand('copy');
		area.remove();
		return ok;
	} catch {
		return false;
	}
}
