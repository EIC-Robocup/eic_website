/**
 * A copy of the post editor's fields in this browser's localStorage, so nothing typed is lost
 * to a closed tab, a crash or an expired session. One key per post ("new" for a post that is
 * not saved yet). Storage can be blocked or full: every call fails quietly.
 */

export type LocalDraft<T> = {
	/** When the copy was taken (ms since 1970). */
	savedAt: number;
	/** The post's updated_at when the editor opened it (ISO), to tell stale copies apart. */
	base: string | null;
	values: T;
};

const PREFIX = 'eic:post-draft:';

export function draftKey(id: string | null | undefined): string {
	return `${PREFIX}${id || 'new'}`;
}

export function readDraft<T>(key: string): LocalDraft<T> | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<LocalDraft<T>>;
		if (typeof parsed?.savedAt !== 'number' || !parsed.values || typeof parsed.values !== 'object') return null;
		return { savedAt: parsed.savedAt, base: typeof parsed.base === 'string' ? parsed.base : null, values: parsed.values };
	} catch {
		return null;
	}
}

/** True when the copy was stored. */
export function writeDraft<T>(key: string, draft: LocalDraft<T>): boolean {
	try {
		localStorage.setItem(key, JSON.stringify(draft));
		return true;
	} catch {
		return false;
	}
}

export function clearDraft(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage blocked: nothing was stored either.
	}
}
