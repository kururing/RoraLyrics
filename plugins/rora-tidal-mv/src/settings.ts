import { ReactiveStore } from "@luna/core";

export type MvQuality = "auto" | "hd720" | "hd1080" | "highres";

export interface MvSettings {
	youtubeApiKey: string;
	enableMvButton: boolean;
	resumeTidalOnClose: boolean;
	preferOfficialMv: boolean;
	mvQuality: MvQuality;
	rememberMvResults: boolean;
}

export const settings = await ReactiveStore.getPluginStorage<MvSettings>("RoraTidalMv", {
	youtubeApiKey: "",
	enableMvButton: true,
	resumeTidalOnClose: true,
	preferOfficialMv: true,
	mvQuality: "auto",
	rememberMvResults: true,
});

const listeners = new Set<() => void>();
export const setSetting = <K extends keyof MvSettings>(key: K, value: MvSettings[K]): void => {
	settings[key] = value;
	for (const listener of listeners) listener();
};
export const subscribeSettings = (listener: () => void): (() => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
