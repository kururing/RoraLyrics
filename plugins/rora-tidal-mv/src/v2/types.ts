export interface TrackMetadata {
	trackId: string;
	title: string;
	artist: string;
	album?: string;
}

export interface MvResult {
	videoId: string;
	title: string;
	channel: string;
	thumbnail: string;
	isOfficial: boolean;
}

export interface MvCacheEntry extends MvResult {
	timestampCached: number;
}

export type MvPlayState = "unstarted" | "playing" | "paused" | "ended";

export interface PlayerController {
	play(): void;
	pause(): void;
	seek(seconds: number): void;
	volume(value: number): void;
	mute(muted: boolean): void;
	quality(value: string): void;
	destroy(): void;
	qualities: string[];
	onState(listener: (state: MvPlayState) => void): () => void;
	onError(listener: (code: number) => void): () => void;
}

export interface YouTubePlayer {
	destroy(): void;
	playVideo(): void;
	pauseVideo(): void;
	seekTo(seconds: number, allowSeekAhead: boolean): void;
	setVolume(volume: number): void;
	mute(): void;
	unMute(): void;
	setPlaybackQuality?(quality: string): void;
	getAvailableQualityLevels?(): string[];
}

export interface YouTubeNamespace {
	Player: new (
		element: HTMLElement,
		options: Record<string, unknown>,
	) => YouTubePlayer;
}

declare global {
	interface Window {
		YT?: YouTubeNamespace;
		onYouTubeIframeAPIReady?: () => void;
	}
}
