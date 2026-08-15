import type { MvCacheEntry } from "./types";

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const isCacheEntryExpired = (entry: MvCacheEntry, now: number): boolean =>
	now - entry.timestampCached > CACHE_TTL_MS;

/** YouTube error codes that mean the cached video is gone / unembeddable. */
export const isUnavailableError = (code: number): boolean => code === 100 || code === 101 || code === 150;
