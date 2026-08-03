import type { CachedTrackAudioQuality, TrackAudioQuality } from "./types";

export class QualityCache {
	static readonly VERSION = 1;
	private readonly entries = new Map<string, CachedTrackAudioQuality>();

	constructor(
		private readonly maxEntries = 500,
		private readonly ttlMs = 24 * 60 * 60 * 1000,
	) {}

	get(trackId: string, now = Date.now()): TrackAudioQuality | null {
		const entry = this.entries.get(trackId);
		if (
			!entry ||
			entry.cacheVersion !== QualityCache.VERSION ||
			entry.expiresAt <= now
		) {
			this.entries.delete(trackId);
			return null;
		}
		this.entries.delete(trackId);
		this.entries.set(trackId, entry);
		return entry.quality;
	}

	set(quality: TrackAudioQuality, now = Date.now()): void {
		this.entries.delete(quality.trackId);
		this.entries.set(quality.trackId, {
			trackId: quality.trackId,
			quality,
			cachedAt: now,
			expiresAt: now + this.ttlMs,
			cacheVersion: QualityCache.VERSION,
		});
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next().value;
			if (oldest === undefined) break;
			this.entries.delete(oldest);
		}
	}

	clear(): void {
		this.entries.clear();
	}
}

export class RequestPool<T> {
	private active = 0;
	private readonly queue: Array<{
		start: () => void;
		reject: (reason: Error) => void;
	}> = [];
	private readonly pending = new Map<string, Promise<T>>();
	private disposed = false;

	constructor(private readonly concurrency = 4) {}

	run(key: string, task: () => Promise<T>): Promise<T> {
		if (this.disposed)
			return Promise.reject(new Error("Request pool disposed"));
		const existing = this.pending.get(key);
		if (existing) return existing;
		const promise = new Promise<T>((resolve, reject) => {
			const start = () => {
				if (this.disposed) {
					reject(new Error("Request pool disposed"));
					return;
				}
				this.active++;
				void task()
					.then(resolve, reject)
					.finally(() => {
						this.active--;
						this.pending.delete(key);
						this.queue.shift()?.start();
					});
			};
			if (this.active < this.concurrency) start();
			else this.queue.push({ start, reject });
		});
		this.pending.set(key, promise);
		return promise;
	}

	dispose(): void {
		this.disposed = true;
		const error = new Error("Request pool disposed");
		for (const queued of this.queue) queued.reject(error);
		this.queue.length = 0;
		this.pending.clear();
	}
}
