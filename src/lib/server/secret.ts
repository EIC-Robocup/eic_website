/**
 * Keys derived from the server's own secrets, for signing and keyed hashes (contact form
 * tokens, hashed client addresses). The secret itself is never used directly: each purpose
 * gets its own key through HKDF with a distinct `info` label.
 */
import {
	DATABASE_URL,
	POSTGRES_URL,
	SUPABASE_SECRET_KEY,
	SUPABASE_SERVICE_ROLE_KEY
} from '$app/env/private';

const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

/**
 * An HMAC-SHA-256 key for `info`, derived from SUPABASE_SECRET_KEY (or the legacy service role
 * key, or the database URL). With no secret at all (a build or a bare preview) a random key per
 * instance still works; it just doesn't survive a cold start.
 */
export function hmacKey(info: string): Promise<CryptoKey> {
	let key = keys.get(info);
	if (!key) {
		key = (async () => {
			const secret = SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY ?? DATABASE_URL ?? POSTGRES_URL;
			const material = secret ? encoder.encode(secret) : crypto.getRandomValues(new Uint8Array(32));
			const base = await crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveKey']);
			return crypto.subtle.deriveKey(
				{ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('eic-chula'), info: encoder.encode(info) },
				base,
				{ name: 'HMAC', hash: 'SHA-256', length: 256 },
				false,
				['sign', 'verify']
			);
		})();
		keys.set(info, key);
	}
	return key;
}

/** Base64url without padding. */
export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	return btoa(String.fromCharCode(...view))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

/** A keyed hash of `value` (HMAC with the key for `info`), base64url. */
export async function keyedHash(info: string, value: string): Promise<string> {
	const signature = await crypto.subtle.sign('HMAC', await hmacKey(info), encoder.encode(value));
	return toBase64Url(signature);
}
