export type AudioQualityLabel =
	| "LOW"
	| "HIGH"
	| "LOSSLESS"
	| "HI_RES"
	| "MAX"
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
	channels?: number | null;
	bitrateKbps?: number | null;
	fileHash?: string | null;
}

export interface CachedTrackAudioQuality {
	trackId: string;
	quality: TrackAudioQuality;
	cachedAt: number;
	expiresAt: number;
	cacheVersion: number;
}
