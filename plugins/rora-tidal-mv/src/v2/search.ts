export interface CurrentTrack { title: string; artist: string }

export const searchVideo = async (track: CurrentTrack, apiKey: string, signal: AbortSignal): Promise<string> => {
	if (!apiKey.trim()) throw new Error("MISSING_API_KEY");
	const query = `${track.artist} ${track.title} official music video`.trim();
	const params = new URLSearchParams({ part: "snippet", type: "video", videoEmbeddable: "true", maxResults: "1", order: "relevance", q: query, key: apiKey.trim() });
	const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal });
	if (!response.ok) throw new Error(`SEARCH_${response.status}`);
	const body = await response.json() as { items?: Array<{ id?: { videoId?: string } }> };
	const videoId = body.items?.[0]?.id?.videoId;
	if (!videoId) throw new Error("VIDEO_NOT_FOUND");
	return videoId;
};
