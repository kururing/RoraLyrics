import type { CachedTrackAudioQuality, TrackAudioQuality } from "./types";

export interface QualityStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
	key?(index: number): string | null;
	readonly length?: number;
}

const resolveDefaultStorage = (): QualityStorage | undefined => {
	try {
		if (typeof localStorage !== "undefined" && localStorage !== null) {
			return localStorage;
		}
	} catch {
		// Ignore restricted iframe / storage access errors
	}
	return undefined;
};

const STORAGE_PREFIX = "rora_aq_v1_";

export class QualityCache {
	static readonly VERSION = 1;
	private readonly entries = new Map<string, CachedTrackAudioQuality>();
	private readonly storage?: QualityStorage;

	constructor(
		private readonly maxEntries = 500,
		private readonly ttlMs = 30 * 24 * 60 * 60 * 1000,
		storage?: QualityStorage,
	) {
		this.storage = storage ?? resolveDefaultStorage();
	}

	get(trackId: string, now = Date.now()): TrackAudioQuality | null {
		const entry = this.entries.get(trackId);
		if (entry) {
			if (
				entry.cacheVersion !== QualityCache.VERSION ||
				entry.expiresAt <= now
			) {
				this.entries.delete(trackId);
				this.removePersistent(trackId);
				return null;
			}
			this.entries.delete(trackId);
			this.entries.set(trackId, entry);
			return entry.quality;
		}

		const persistent = this.readPersistent(trackId);
		if (persistent) {
			if (
				persistent.cacheVersion !== QualityCache.VERSION ||
				persistent.expiresAt <= now
			) {
				this.removePersistent(trackId);
				return null;
			}
			this.entries.set(trackId, persistent);
			this.enforceLimit();
			return persistent.quality;
		}

		return null;
	}

	set(
		quality: TrackAudioQuality,
		now = Date.now(),
		customTtlMs?: number,
	): void {
		const existing = this.get(quality.trackId, now);
		if (existing?.isConfirmed && !quality.isConfirmed) {
			return;
		}

		const expiresAt = now + (customTtlMs ?? this.ttlMs);
		const cached: CachedTrackAudioQuality = {
			trackId: quality.trackId,
			quality,
			cachedAt: now,
			expiresAt,
			cacheVersion: QualityCache.VERSION,
		};

		this.entries.delete(quality.trackId);
		this.entries.set(quality.trackId, cached);
		this.enforceLimit();
		this.writePersistent(quality.trackId, cached);
	}

	setNegative(
		trackId: string,
		now = Date.now(),
		negativeTtlMs = 60 * 60 * 1000,
	): void {
		const existing = this.get(trackId, now);
		if (existing) return;

		const fallbackQuality: TrackAudioQuality = {
			trackId,
			bitDepth: null,
			sampleRateHz: null,
			codec: null,
			qualityLabel: "UNKNOWN",
			isSpatial: false,
			source: "unknown",
			isConfirmed: false,
		};

		this.set(fallbackQuality, now, negativeTtlMs);
	}

	invalidate(trackId: string): void {
		this.entries.delete(trackId);
		this.removePersistent(trackId);
	}

	clear(): void {
		this.entries.clear();
		if (this.storage) {
			try {
				if (
					typeof this.storage.length === "number" &&
					typeof this.storage.key === "function"
				) {
					const toDelete: string[] = [];
					for (let i = 0; i < this.storage.length; i++) {
						const k = this.storage.key(i);
						if (k?.startsWith(STORAGE_PREFIX)) {
							toDelete.push(k);
						}
					}
					for (let i = 0; i < toDelete.length; i++) {
						this.storage.removeItem(toDelete[i]);
					}
				}
			} catch {
				// Ignore storage clear errors
			}
		}
	}

	private readPersistent(trackId: string): CachedTrackAudioQuality | null {
		if (!this.storage) return null;
		try {
			const raw = this.storage.getItem(STORAGE_PREFIX + trackId);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as CachedTrackAudioQuality;
			if (
				parsed &&
				typeof parsed === "object" &&
				parsed.trackId === trackId &&
				parsed.quality &&
				typeof parsed.expiresAt === "number"
			) {
				return parsed;
			}
			this.removePersistent(trackId);
		} catch {
			this.removePersistent(trackId);
		}
		return null;
	}

	private writePersistent(
		trackId: string,
		cached: CachedTrackAudioQuality,
	): void {
		if (!this.storage) return;
		try {
			this.storage.setItem(STORAGE_PREFIX + trackId, JSON.stringify(cached));
		} catch {
			// Storage quota exceeded or blocked - ignore gracefully
		}
	}

	private removePersistent(trackId: string): void {
		if (!this.storage) return;
		try {
			this.storage.removeItem(STORAGE_PREFIX + trackId);
		} catch {
			// Ignore
		}
	}

	private enforceLimit(): void {
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next().value;
			if (oldest === undefined) break;
			this.entries.delete(oldest);
		}
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
