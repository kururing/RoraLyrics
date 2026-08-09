import { ReactiveStore } from "@luna/core";
export interface MvSettings { youtubeApiKey: string; resumeTidalOnClose: boolean; }
export const settings = await ReactiveStore.getPluginStorage<MvSettings>("RoraTidalMv", { youtubeApiKey: "", resumeTidalOnClose: true });
let listeners = new Set<() => void>();
export const setSetting = <K extends keyof MvSettings>(key: K, value: MvSettings[K]) => { settings[key] = value; listeners.forEach((l) => l()); };
export const subscribeSettings = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
