import { ReactiveStore } from "@luna/core";

export interface AudioQualitySettings {
	enableTrackList: boolean;
}

export const settings =
	await ReactiveStore.getPluginStorage<AudioQualitySettings>(
		"RoraAudioQuality",
		{
			enableTrackList: true,
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
