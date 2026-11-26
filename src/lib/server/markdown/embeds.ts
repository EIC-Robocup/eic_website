/**
 * Embeds and media placeholders. Nothing here loads a third-party frame: the stored HTML only
 * holds a poster and a link, and PostBody turns the poster into a player when it is clicked.
 *
 * - A paragraph that is only a YouTube, Vimeo or GitHub repository URL becomes an embed.
 *   `![Title](https://youtu.be/ID "Caption")` does the same with a title and a numbered caption.
 * - Image syntax with a video file (`.mp4`, `.webm`) gives a <video>; with a 3D model
 *   (`.glb`, `.gltf`) a <model-viewer> placeholder.
 */
import { escapeHtml, isExternalUrl, pad2 } from './util.ts';

export type Embed =
	| { kind: 'youtube'; id: string; start: number; url: string }
	| { kind: 'vimeo'; id: string; hash: string | null; start: number; url: string }
	| { kind: 'github'; owner: string; repo: string; url: string };

/** "90", "90s", "1m30s", "1h2m3s" → seconds. */
function parseTime(value: string | null | undefined): number {
	if (!value) return 0;
	const v = value.trim().toLowerCase();
	if (/^\d+$/.test(v)) return Math.min(Number(v), 86400);
	const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(v);
	if (!match) return 0;
	const total = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
	return Math.min(total, 86400);
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/** GitHub top-level paths that are not owners. */
const GITHUB_RESERVED = new Set([
	'about', 'apps', 'collections', 'contact', 'customer-stories', 'enterprise', 'events', 'explore',
	'features', 'issues', 'login', 'marketplace', 'new', 'notifications', 'orgs', 'organizations',
	'pricing', 'pulls', 'search', 'security', 'settings', 'site', 'sponsors', 'topics', 'trending',
	'codespaces', 'join', 'readme'
]);

/** Recognise an embeddable URL, or null. */
export function parseEmbedUrl(raw: string): Embed | null {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	const host = url.hostname.toLowerCase();
	const parts = url.pathname.split('/').filter(Boolean);

	if (YOUTUBE_HOSTS.has(host) || host === 'youtu.be') {
		let id: string | null = null;
		if (host === 'youtu.be') id = parts[0] ?? null;
		else if (parts[0] === 'watch') id = url.searchParams.get('v');
		else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1] ?? null;
		if (!id || !YOUTUBE_ID.test(id)) return null;
		const start = parseTime(url.searchParams.get('t') ?? url.searchParams.get('start') ?? url.hash.replace(/^#t=/, ''));
		return { kind: 'youtube', id, start, url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}` };
	}

	if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
		const index = parts.findIndex((p) => /^\d{1,12}$/.test(p));
		if (index < 0) return null;
		const id = parts[index];
		const next = parts[index + 1];
		const hash = url.searchParams.get('h') ?? (next && /^[0-9a-f]{6,20}$/i.test(next) ? next : null);
		const start = parseTime(/t=([\dhms]+)/i.exec(url.hash)?.[1]);
		const safeHash = hash && /^[0-9a-f]{6,20}$/i.test(hash) ? hash : null;
		return { kind: 'vimeo', id, hash: safeHash, start, url: `https://vimeo.com/${id}${safeHash ? `/${safeHash}` : ''}` };
	}

	if (host === 'github.com' || host === 'www.github.com') {
		if (parts.length !== 2 || url.search || url.hash) return null;
		const [owner, repoRaw] = parts;
		const repo = repoRaw.replace(/\.git$/i, '');
		if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || GITHUB_RESERVED.has(owner.toLowerCase())) return null;
		if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo) || repo === '.' || repo === '..') return null;
		return { kind: 'github', owner, repo, url: `https://github.com/${owner}/${repo}` };
	}

	return null;
}

const VIDEO_EXT = /\.(mp4|webm|m4v|ogv)$/i;
const MODEL_EXT = /\.(glb|gltf)$/i;

/** 'video', 'model' or null, by the file extension of the URL's path. */
export function mediaKind(url: string): 'video' | 'model' | null {
	let path = url;
	try {
		path = new URL(url, 'https://site.invalid').pathname;
	} catch {
		return null;
	}
	if (VIDEO_EXT.test(path)) return 'video';
	if (MODEL_EXT.test(path)) return 'model';
	return null;
}

/** `<figcaption>` with the mono "Fig. 0N" label, or '' without a caption. */
export function figcaption(caption: string | null | undefined, figure: number | null): string {
	if (!caption) return '';
	const label = figure ? `<span class="fig-label">Fig. ${pad2(figure)}</span>` : '';
	return `<figcaption>${label}<span class="fig-text">${escapeHtml(caption)}</span></figcaption>`;
}

const NEW_TAB = ' target="_blank" rel="noopener noreferrer"';
const NEW_TAB_HINT = '<span class="sr-only"> (opens in a new tab)</span>';

/** HTML for an embed placeholder (a fragment: it carries data-* attributes). */
export function embedHtml(embed: Embed, opts: { title?: string; caption?: string | null; figure?: number | null } = {}): string {
	const title = opts.title?.trim() || '';
	const caption = figcaption(opts.caption, opts.figure ?? null);

	if (embed.kind === 'github') {
		return (
			`<div class="embed embed-repo">` +
			`<a class="repo-card" href="${escapeHtml(embed.url)}"${NEW_TAB}>` +
			`<span class="repo-icon" aria-hidden="true"></span>` +
			`<span class="repo-text"><span class="repo-label">${title ? escapeHtml(title) : 'GitHub repository'}</span>` +
			`<span class="repo-name">${escapeHtml(embed.owner)}/${escapeHtml(embed.repo)}</span></span>` +
			`<span class="repo-cta">View on GitHub<span class="repo-arrow" aria-hidden="true"></span></span>${NEW_TAB_HINT}` +
			`</a>${caption}</div>`
		);
	}

	const provider = embed.kind === 'youtube' ? 'YouTube' : 'Vimeo';
	const label = title || `Video on ${provider}`;
	const poster =
		embed.kind === 'youtube'
			? `<img class="embed-thumb" src="https://i.ytimg.com/vi/${embed.id}/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360">`
			: '';
	const data =
		` data-provider="${embed.kind}" data-id="${escapeHtml(embed.id)}"` +
		(embed.start ? ` data-start="${embed.start}"` : '') +
		(embed.kind === 'vimeo' && embed.hash ? ` data-hash="${escapeHtml(embed.hash)}"` : '') +
		` data-title="${escapeHtml(label)}"`;
	return (
		`<figure class="embed embed-video embed-${embed.kind}"${data}>` +
		`<a class="embed-poster" href="${escapeHtml(embed.url)}"${NEW_TAB}>` +
		poster +
		`<span class="embed-play" aria-hidden="true"></span>` +
		`<span class="embed-meta"><span class="embed-provider">${provider}</span><span class="embed-title">${escapeHtml(label)}</span></span>` +
		`<span class="sr-only">Play video: ${escapeHtml(label)}, ${provider}</span>` +
		`</a>${caption}</figure>`
	);
}

/** <video> figure for .mp4/.webm in image syntax. */
export function videoHtml(src: string, alt: string, caption: string | null, figure: number | null): string {
	const href = escapeHtml(src);
	const name = alt ? ` aria-label="${escapeHtml(alt)}"` : '';
	const external = isExternalUrl(src) ? NEW_TAB : '';
	return (
		`<figure class="media media-video">` +
		`<video controls preload="metadata" playsinline src="${href}"${name}>` +
		`<a href="${href}"${external}>Download the video${alt ? `: ${escapeHtml(alt)}` : ''}</a>` +
		`</video>${figcaption(caption, figure)}</figure>`
	);
}

/** 3D model placeholder for .glb/.gltf in image syntax; PostBody loads <model-viewer> into it. */
export function modelHtml(src: string, alt: string, caption: string | null, figure: number | null): string {
	const name = alt || '3D model';
	return (
		`<figure class="media media-model" data-src="${escapeHtml(src)}" data-alt="${escapeHtml(name)}">` +
		`<div class="model-stage">` +
		`<div class="model-poster"><span class="model-icon" aria-hidden="true"></span>` +
		`<span class="model-label">3D model · ${escapeHtml(name)}</span>` +
		`<a class="model-link" href="${escapeHtml(src)}" download>Download the model</a></div>` +
		`</div>${figcaption(caption, figure)}</figure>`
	);
}
