import type { TrackMetadata } from "./types";

export const videoQuery = ({ artist, title }: TrackMetadata): string => `${artist} ${title} official music video`.trim();

export const findYouTubeVideo = async (track: TrackMetadata, apiKey: string, signal: AbortSignal): Promise<string | null> => {
	if (!apiKey.trim()) return null;
	const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "1", q: videoQuery(track), key: apiKey.trim() });
	const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal });
	if (!response.ok) throw new Error(`YouTube search failed (${response.status})`);
	const payload = await response.json() as { items?: Array<{ id?: { videoId?: string } }> };
	return payload.items?.[0]?.id?.videoId ?? null;
};
