export interface TrackMetadata { title: string; artist: string }
export interface YouTubePlayer {
	destroy(): void;
	playVideo(): void;
	pauseVideo(): void;
	setVolume(volume: number): void;
	getAvailableQualityLevels?(): string[];
	setPlaybackQuality?(quality: string): void;
}
export interface YouTubeNamespace {
	Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer;
}
declare global {
	interface Window { YT?: YouTubeNamespace; onYouTubeIframeAPIReady?: () => void }
}
