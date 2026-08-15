import { ReactiveStore } from "@luna/core";
import { isCacheEntryExpired } from "./cachePolicy";
import type { MvCacheEntry, MvResult } from "./types";

const store = ReactiveStore.getStore("RoraTidalMvCache");

const key = (trackId: string): string => `track:${trackId}`;

export const getCachedMv = async (trackId: string): Promise<MvResult | null> => {
	const entry = await store.get<MvCacheEntry>(key(trackId));
	if (!entry) return null;
	if (isCacheEntryExpired(entry, Date.now())) {
		await store.del(key(trackId));
		return null;
	}
	const { timestampCached: _timestampCached, ...result } = entry;
	return result;
};

export const cacheMv = async (trackId: string, result: MvResult): Promise<void> => {
	await store.set<MvCacheEntry>(key(trackId), { ...result, timestampCached: Date.now() });
};

export const invalidateMv = async (trackId: string): Promise<void> => {
	await store.del(key(trackId));
};

export { isUnavailableError } from "./cachePolicy";
