import { MediaItem, redux, TidalApi } from "@luna/lib";
import type { TrackMetadata } from "./types";
import {
	findTidalVideoWithFetcher,
	playTidalVideoWithDeps,
	type PlayTidalVideoOutcome,
	type TidalVideoDependencies,
	type TidalVideoRelationship,
	type TidalVideoResource,
} from "./tidalVideoLookup";

export type {
	PlayTidalVideoOutcome,
	TidalVideoDependencies,
	TidalVideoRelationship,
	TidalVideoResource,
	TidalVideoResult,
} from "./tidalVideoLookup";
export {
	findTidalVideoWithFetcher,
	getStoreCountryCode,
	getStoreLocale,
	pickBestVideo,
	playTidalVideoWithDeps,
	toTidalVideoResult,
} from "./tidalVideoLookup";

/**
 * Look up TIDAL's own music video for the current track using TIDAL's catalog
 * relationships endpoint. Returns `null` when a verified empty list or no match
 * is found. Throws on network/API failure or undefined response.
 */
export const findTidalVideo = async (
	track: TrackMetadata,
	signal?: AbortSignal,
	fetcher?: (url: string) => Promise<TidalVideoRelationship | undefined>,
	store?: { getState?: () => unknown },
): Promise<TidalVideoResource | null> => {
	const fetchFn =
		fetcher ??
		((targetUrl: string) => TidalApi.fetch<TidalVideoRelationship>(targetUrl));
	return findTidalVideoWithFetcher(
		track,
		signal,
		fetchFn,
		store ?? redux.store,
	);
};

/**
 * Look up the TIDAL video for the track and play it through TIDAL's own
 * player. Preserves the user's audio queue and playback context by enqueueing
 * the video next and advancing to it.
 */
export const playTidalVideo = async (
	track: TrackMetadata,
	signal?: AbortSignal,
	deps?: TidalVideoDependencies,
): Promise<PlayTidalVideoOutcome> => {
	const fetchRelations =
		deps?.fetchVideoRelations ??
		(async (url: string) => {
			try {
				const res = await TidalApi.fetch<TidalVideoRelationship>(url);
				if (res) return res;
			} catch {
				// try fallback host
			}
			if (url.includes("api.tidal.com")) {
				const fallback = url.replace("api.tidal.com", "desktop.tidal.com");
				try {
					const res = await TidalApi.fetch<TidalVideoRelationship>(fallback);
					if (res) return res;
				} catch {
					// ignore
				}
			}
			return { data: [] };
		});

	const loadMedia =
		deps?.loadMediaItem ??
		(async (id: string | number, type: "video") => {
			try {
				const item = await MediaItem.fromId(id, type);
				return item ?? { id: String(id), type };
			} catch {
				return { id: String(id), type };
			}
		});

	return playTidalVideoWithDeps(track, signal, {
		fetchVideoRelations: fetchRelations,
		loadMediaItem: loadMedia,
		reduxStore: deps?.reduxStore ?? redux.store,
		reduxActions: deps?.reduxActions ?? redux.actions,
	});
};
