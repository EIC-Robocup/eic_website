/**
 * Spam protection for the contact form, best effort and without third parties:
 *
 * 1. A signed render time. The page carries `<issuedAt>.<hmac>`; a submission must bring
 *    it back unchanged, at least MIN_AGE after the page was rendered (bots post at once)
 *    and within MAX_AGE. The key is derived from a server secret, so it can't be forged.
 * 2. A per-IP limit kept in memory. On serverless each instance has its own memory,
 *    so this only slows a burst down; the per-email check in the database is the backstop.
 *
 * The honeypot field is checked in the action.
 */
import {
	DATABASE_URL,
	POSTGRES_URL,
	SUPABASE_SECRET_KEY,
	SUPABASE_SERVICE_ROLE_KEY
} from '$app/env/private';

export const MIN_AGE_MS = 3_000;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

let keyPromise: Promise<CryptoKey> | undefined;

/** HMAC key derived (HKDF) from a server secret, so the secret itself is never used directly. */
function signingKey(): Promise<CryptoKey> {
	keyPromise ??= (async () => {
		const secret = SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY ?? DATABASE_URL ?? POSTGRES_URL;
		// No secret at all (a build or a bare preview): a random key per instance still works,
		// it just doesn't survive a cold start.
		const material = secret ? encoder.encode(secret) : crypto.getRandomValues(new Uint8Array(32));
		const base = await crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveKey']);
		return crypto.subtle.deriveKey(
			{
				name: 'HKDF',
				hash: 'SHA-256',
				salt: encoder.encode('eic-chula'),
				info: encoder.encode('contact-form-token-v1')
			},
			base,
			{ name: 'HMAC', hash: 'SHA-256', length: 256 },
			false,
			['sign', 'verify']
		);
	})();
	return keyPromise;
}

const toBase64Url = (bytes: ArrayBuffer) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]{20,100}$/.test(text)) return null;
	try {
		const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		return null;
	}
}

const payload = (issuedAt: number) => encoder.encode(`contact:${issuedAt}`);

/** A token for a form rendered now. */
export async function issueToken(now = Date.now()): Promise<string> {
	const signature = await crypto.subtle.sign('HMAC', await signingKey(), payload(now));
	return `${now}.${toBase64Url(signature)}`;
}

export type TokenCheck = 'ok' | 'invalid' | 'too-fast' | 'expired';

export async function checkToken(token: string, now = Date.now()): Promise<TokenCheck> {
	const match = /^(\d{13})\.(.+)$/.exec(token);
	if (!match) return 'invalid';
	const issuedAt = Number(match[1]);
	const signature = fromBase64Url(match[2]);
	if (!signature) return 'invalid';
	// crypto.subtle.verify compares in constant time.
	const valid = await crypto.subtle.verify('HMAC', await signingKey(), signature, payload(issuedAt));
	if (!valid) return 'invalid';
	const age = now - issuedAt;
	if (age < -60_000) return 'invalid'; // from the future: clock skew beyond a minute
	if (age < MIN_AGE_MS) return 'too-fast';
	if (age > MAX_AGE_MS) return 'expired';
	return 'ok';
}

/* ------------------------------------------------------------------------- */
/* Per-IP rate limit (in memory)                                              */
/* ------------------------------------------------------------------------- */

export const IP_WINDOW_MS = 10 * 60 * 1000;
export const IP_MAX = 5;
const MAX_TRACKED = 5_000;

const recent = new Map<string, number[]>();

function prune(now: number) {
	for (const [ip, times] of recent) {
		const kept = times.filter((t) => now - t < IP_WINDOW_MS);
		if (kept.length === 0) recent.delete(ip);
		else recent.set(ip, kept);
	}
}

/** True when this address has already sent IP_MAX messages in the window. */
export function isRateLimited(ip: string, now = Date.now()): boolean {
	const times = recent.get(ip);
	if (!times) return false;
	return times.filter((t) => now - t < IP_WINDOW_MS).length >= IP_MAX;
}

/** Count a message sent from this address. */
export function recordSend(ip: string, now = Date.now()): void {
	if (recent.size >= MAX_TRACKED) prune(now);
	// Still full of live entries (a flood of addresses): drop the oldest one.
	if (recent.size >= MAX_TRACKED) {
		const oldest = recent.keys().next().value;
		if (oldest !== undefined) recent.delete(oldest);
	}
	const times = (recent.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
	times.push(now);
	// Re-insert so the Map's order stays "least recently used first".
	recent.delete(ip);
	recent.set(ip, times);
}
