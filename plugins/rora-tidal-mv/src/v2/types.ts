export interface TrackMetadata {
	trackId: string;
	title: string;
	artist: string;
	album?: string;
}

export type ButtonState = "idle" | "loading" | "no-mv";

export interface Button {
	unmount(): void;
	setState(state: ButtonState): void;
	ensureMounted?(): void;
}
