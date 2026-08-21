import { ReactiveStore } from "@luna/core";

export interface MvSettings {
	enableMvButton: boolean;
}

export const settings = await ReactiveStore.getPluginStorage<MvSettings>(
	"RoraTidalMv",
	{
		enableMvButton: true,
	},
);

const listeners = new Set<() => void>();
export const setSetting = <K extends keyof MvSettings>(
	key: K,
	value: MvSettings[K],
): void => {
	settings[key] = value;
	for (const listener of listeners) listener();
};
export const subscribeSettings = (listener: () => void): (() => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
