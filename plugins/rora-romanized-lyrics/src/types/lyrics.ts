export type LyricsSource = "tidal";

export interface TrackMetadata {
	id?: string;
	title: string;
	artist: string;
	album: string;
	durationMs?: number;
	version?: string;
}

export interface LyricLine {
	id: string;
	startTimeMs: number;
	endTimeMs?: number;
	original: string;
	romanized?: string;
	translation?: string;
}

export interface LyricsResult {
	source: LyricsSource;
	originalLyrics: string | null;
	syncedLyrics: string | null;
	lines: LyricLine[];
	instrumental: boolean;
	confidence: number;
	metadata: Record<string, string | number | boolean | undefined>;
	error?: string;
}

export interface LyricsProvider {
	id: LyricsSource;
	getLyrics(track: TrackMetadata, signal?: AbortSignal): Promise<LyricsResult>;
}
