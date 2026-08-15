import type { MvResult } from "./types";

export interface VideoCandidate {
	videoId: string;
	title: string;
	channelTitle: string;
	description: string;
	thumbnail: string;
}

export interface ScoredVideo extends VideoCandidate {
	score: number;
	isOfficial: boolean;
}

const normalize = (value: string): string =>
	value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const words = (value: string): string[] => normalize(value).split(" ").filter((word) => word.length > 0);

// Words that mark a non-official / low-value result. "Audio only", "lyric",
// "live", "cover", "reaction" and "fanmade" come straight from the spec.
const NEGATIVE_WORDS = new Set([
	"lyric", "lyrics", "audio", "live", "cover", "reaction", "fanmade", "fan",
	"remix", "karaoke", "acoustic", "instrumental", "nightcore", "slowed", "reverb",
	"8d", "mashup", "parody", "tutorial", "edit", "sped", "concert", "session",
]);

/** A channel looks official when it carries the artist name and an official marker. */
export const looksOfficialChannel = (channel: string, artist: string): boolean => {
	const c = normalize(channel);
	const a = normalize(artist);
	if (!a) return false;
	const channelWords = new Set(words(c));
	const artistWords = words(a);
	const artistPresent = artistWords.length > 0 && artistWords.every((word) => channelWords.has(word) || c.includes(word));
	const officialMarker = /(vevo|official|records|music|entertainment|label|warner|universal|sony)/.test(c);
	return artistPresent && officialMarker;
};

/** Score a single search result against the track. Higher is better. */
export const scoreVideo = (track: { title: string; artist: string }, video: VideoCandidate): { score: number; isOfficial: boolean } => {
	const title = normalize(video.title);
	const channel = normalize(video.channelTitle);
	const description = normalize(video.description);
	const artist = normalize(track.artist);

	let score = 0;

	// Title overlap: how much of the track title appears in the video title.
	const trackWords = words(track.title);
	const titleWords = new Set(words(video.title));
	if (trackWords.length > 0) {
		const overlap = trackWords.filter((word) => titleWords.has(word)).length;
		score += (overlap / trackWords.length) * 40;
	}

	// Artist match in title or channel.
	const artistWords = words(track.artist);
	const artistInTitle = artistWords.length > 0 && artistWords.every((word) => titleWords.has(word));
	const artistInChannel = artist !== "" && channel.includes(artist);
	if (artistInTitle || artistInChannel) score += 20;

	// Official signals.
	const hasOfficial = /\bofficial\b/.test(`${title} ${channel} ${description}`);
	const hasMusicVideo = /(\bmusic video\b|\bofficial (video|mv)\b|\bmv\b)/.test(title);
	const officialChannel = looksOfficialChannel(video.channelTitle, track.artist);
	if (hasOfficial) score += 15;
	if (hasMusicVideo) score += 10;
	if (officialChannel) score += 15;

	// Negative signals.
	if ([...words(video.title), ...words(video.channelTitle)].some((word) => NEGATIVE_WORDS.has(word))) {
		score -= 30;
	}

	const isOfficial = hasOfficial || officialChannel || (hasMusicVideo && artistInTitle);
	return { score, isOfficial };
};

/**
 * Rank candidates. When `preferOfficial` is true an official result wins even if a
 * fan upload scores slightly higher; otherwise the highest-scoring result is used.
 */
export const rankVideos = (track: { title: string; artist: string }, videos: VideoCandidate[], preferOfficial: boolean): ScoredVideo | null => {
	if (videos.length === 0) return null;
	const scored = videos
		.map((video) => ({ ...video, ...scoreVideo(track, video) }))
		.sort((a, b) => b.score - a.score);
	if (!preferOfficial) return scored[0];
	return scored.find((video) => video.isOfficial) ?? scored[0];
};

export const toMvResult = (video: ScoredVideo): MvResult => ({
	videoId: video.videoId,
	title: video.title,
	channel: video.channelTitle,
	thumbnail: video.thumbnail,
	isOfficial: video.isOfficial,
});
