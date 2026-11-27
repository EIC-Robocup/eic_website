/**
 * A queue of uploads for the Media library: several files at once, three uploading at a time,
 * each with progress and a Cancel. Every finished upload calls `onUploaded` (the page reloads
 * its list there); a toast sums up each batch.
 *
 *     const queue = new UploadQueue({ folder: 'media', onUploaded: () => refreshAll() });
 *     queue.add(files, { keepOriginal });
 *     {#each queue.items as item (item.id)} {item.filename} {item.progress}% {/each}
 */
import { toast } from 'svelte-sonner';
import { checkFile, formatBytes, uploadFile, type UploadFolder, type UploadedMedia } from '../upload.ts';

export type QueuedUpload = {
	id: number;
	filename: string;
	size: number;
	/** 0 to 100. */
	progress: number;
	status: 'waiting' | 'uploading' | 'saving';
	/** An object URL for images, to show while uploading. */
	preview: string | null;
};

type Job = { item: QueuedUpload; file: File; keepOriginal: boolean; controller: AbortController };

export class UploadQueue {
	/** Uploads waiting or in progress, in the order they were added. */
	items = $state<QueuedUpload[]>([]);

	readonly #folder: UploadFolder;
	readonly #concurrency: number;
	readonly #onUploaded: (media: UploadedMedia) => void | Promise<void>;
	readonly #jobs = new Map<number, Job>();
	readonly #waiting: Job[] = [];
	#active = 0;
	#nextId = 1;
	#batch = { ok: 0, failed: 0, before: 0, after: 0 };

	constructor(options: {
		folder: UploadFolder;
		concurrency?: number;
		onUploaded: (media: UploadedMedia) => void | Promise<void>;
	}) {
		this.#folder = options.folder;
		this.#concurrency = options.concurrency ?? 3;
		this.#onUploaded = options.onUploaded;
	}

	get busy(): boolean {
		return this.items.length > 0;
	}

	/** Queue files. Refused files (wrong type, empty, too big) toast and are skipped. Returns how many were queued. */
	add(files: Iterable<File>, { keepOriginal = false }: { keepOriginal?: boolean } = {}): number {
		let added = 0;
		for (const file of files) {
			const problem = checkFile(file);
			if (problem) {
				toast.error(`${file.name}: ${problem}`);
				continue;
			}
			const item: QueuedUpload = {
				id: this.#nextId++,
				filename: file.name,
				size: file.size,
				progress: 0,
				status: 'waiting',
				preview: file.type.startsWith('image/') && file.type !== 'image/svg+xml' ? URL.createObjectURL(file) : null
			};
			this.items.push(item);
			const job: Job = { item: this.items[this.items.length - 1], file, keepOriginal, controller: new AbortController() };
			this.#jobs.set(item.id, job);
			this.#waiting.push(job);
			added++;
		}
		this.#pump();
		return added;
	}

	/** Stop one upload (waiting or running). */
	cancel(id: number): void {
		const job = this.#jobs.get(id);
		if (!job) return;
		job.controller.abort();
		const index = this.#waiting.indexOf(job);
		if (index !== -1) {
			this.#waiting.splice(index, 1);
			this.#settle(job);
		}
		toast('Upload cancelled.', { description: job.item.filename });
	}

	/** Stop everything (when the page closes). */
	destroy(): void {
		for (const job of this.#jobs.values()) job.controller.abort();
		this.#waiting.length = 0;
	}

	#pump() {
		while (this.#active < this.#concurrency && this.#waiting.length) {
			const job = this.#waiting.shift()!;
			this.#active++;
			void this.#run(job).finally(() => {
				this.#active--;
				this.#pump();
				if (this.#active === 0 && this.#waiting.length === 0) this.#finishBatch();
			});
		}
	}

	async #run(job: Job) {
		const { item, file, keepOriginal, controller } = job;
		if (controller.signal.aborted) return;
		item.status = 'uploading';
		try {
			const media = await uploadFile(file, {
				folder: this.#folder,
				keepOriginal,
				signal: controller.signal,
				onProgress: (fraction) => {
					item.progress = Math.round(fraction * 100);
					if (fraction >= 0.96) item.status = 'saving';
				}
			});
			this.#batch.ok++;
			this.#batch.before += media.originalSize;
			this.#batch.after += media.size;
			await this.#onUploaded(media);
		} catch (error) {
			const cancelled = error instanceof DOMException && error.name === 'AbortError';
			if (!cancelled) {
				this.#batch.failed++;
				toast.error(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed.'}`);
			}
		} finally {
			this.#settle(job);
		}
	}

	#settle(job: Job) {
		if (!this.#jobs.delete(job.item.id)) return;
		if (job.item.preview) URL.revokeObjectURL(job.item.preview);
		const index = this.items.findIndex((i) => i.id === job.item.id);
		if (index !== -1) this.items.splice(index, 1);
	}

	#finishBatch() {
		const { ok, before, after } = this.#batch;
		this.#batch = { ok: 0, failed: 0, before: 0, after: 0 };
		if (!ok) return;
		const saved = after < before ? `Compressed ${formatBytes(before)} → ${formatBytes(after)}.` : undefined;
		toast.success(ok === 1 ? 'File uploaded.' : `${ok} files uploaded.`, saved ? { description: saved } : undefined);
	}
}
