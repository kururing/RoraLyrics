import { ReactiveStore } from "@luna/core";
import type { DisplayMode, UnknownDisplay } from "./types";

export interface AudioQualitySettings {
	enableTrackList: boolean;
	enableNowPlaying: boolean;
	displayMode: DisplayMode;
	showCodec: boolean;
	showTooltip: boolean;
	unknownDisplay: UnknownDisplay;
	debugLogging: boolean;
}

export const settings =
	await ReactiveStore.getPluginStorage<AudioQualitySettings>(
		"RoraAudioQuality",
		{
			enableTrackList: true,
			enableNowPlaying: true,
			displayMode: "full",
			showCodec: false,
			showTooltip: true,
			unknownDisplay: "dash",
			debugLogging: false,
		},
	);

const listeners = new Set<() => void>();
export const setSetting = <K extends keyof AudioQualitySettings>(
	key: K,
	value: AudioQualitySettings[K],
): void => {
	settings[key] = value;
	for (const listener of listeners) listener();
};
export const subscribeSettings = (listener: () => void): (() => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
