export type AudioQualityLabel =
	| "LOW"
	| "HIGH"
	| "LOSSLESS"
	| "HI_RES"
	| "UNKNOWN";

export type QualitySource =
	| "track-metadata"
	| "playback-manifest"
	| "current-playback"
	| "unknown";

export interface TrackAudioQuality {
	trackId: string;
	bitDepth: number | null;
	sampleRateHz: number | null;
	codec: string | null;
	qualityLabel: AudioQualityLabel;
	isSpatial: boolean;
	source: QualitySource;
	isConfirmed: boolean;
}

export interface CachedTrackAudioQuality {
	trackId: string;
	quality: TrackAudioQuality;
	cachedAt: number;
	expiresAt: number;
	cacheVersion: number;
}

export type DisplayMode = "full" | "compact" | "catalog";
export type UnknownDisplay = "dash" | "hide";
