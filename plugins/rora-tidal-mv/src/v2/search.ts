import { rankVideos, toMvResult, type VideoCandidate } from "./score";
import type { MvResult, TrackMetadata } from "./types";

/** Candidate queries, most official-first. */
export const buildQueries = (track: { title: string; artist: string }): string[] => {
	const artist = track.artist.trim();
	const title = track.title.trim();
	return [
		`${artist} ${title} official music video`,
		`${artist} - ${title} official MV`,
		`${title} ${artist} official video`,
	]
		.map((query) => query.trim())
		.filter((query) => query.length > 0);
};

const searchYouTube = async (query: string, apiKey: string, signal: AbortSignal): Promise<VideoCandidate[]> => {
	const params = new URLSearchParams({
		part: "snippet",
		type: "video",
		videoEmbeddable: "true",
		maxResults: "10",
		order: "relevance",
		q: query,
		key: apiKey,
	});
	const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal });
	if (!response.ok) throw new Error(`SEARCH_${response.status}`);
	const payload = await response.json() as {
		items?: Array<{
			id?: { videoId?: string };
			snippet?: {
				title?: string;
				channelTitle?: string;
				description?: string;
				thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } };
			};
		}>;
	};
	const candidates: VideoCandidate[] = [];
	for (const item of payload.items ?? []) {
		const videoId = item.id?.videoId;
		const snippet = item.snippet;
		if (!videoId || !snippet?.title) continue;
		candidates.push({
			videoId,
			title: snippet.title,
			channelTitle: snippet.channelTitle ?? "",
			description: snippet.description ?? "",
			thumbnail: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? "",
		});
	}
	return candidates;
};

/**
 * Search for the best matching music video. Tries the query variants in order and
 * short-circuits as soon as an official result is found (when preferring official).
 * Returns null when no API key is configured or nothing is found.
 */
export const findYouTubeVideo = async (
	track: TrackMetadata,
	apiKey: string,
	signal: AbortSignal,
	preferOfficial: boolean,
): Promise<MvResult | null> => {
	const key = apiKey.trim();
	if (!key) return null;

	const candidates: VideoCandidate[] = [];
	const seen = new Set<string>();
	for (const query of buildQueries(track)) {
		if (signal.aborted) return null;
		const results = await searchYouTube(query, key, signal);
		for (const candidate of results) {
			if (seen.has(candidate.videoId)) continue;
			seen.add(candidate.videoId);
			candidates.push(candidate);
		}
		if (signal.aborted) return null;
		if (preferOfficial) {
			const official = rankVideos(track, candidates, true);
			if (official?.isOfficial) return toMvResult(official);
		}
	}

	const best = rankVideos(track, candidates, preferOfficial);
	return best ? toMvResult(best) : null;
};
