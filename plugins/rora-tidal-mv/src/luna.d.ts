declare module "file://styles.css?minify" { const styles: string; export default styles }
declare module "file://../styles.css?minify" { const styles: string; export default styles }
declare module "@luna/core" {
	export type LunaUnload = () => void;
	export const ReactiveStore: {
		getPluginStorage<T>(name: string, defaults?: T): Promise<T>;
		getStore(name: string): {
			getReactive<T>(key: string, defaultValue?: T): Promise<T>;
			get<T>(key: string): Promise<T | undefined>;
			set<T>(key: string, value: T): Promise<T>;
			del(key: string): Promise<void>;
		};
	};
}
declare module "@luna/lib" {
	export const PlayState: { playing: boolean; play(): void; pause(): void };
	export type LunaMediaItem = { id: string | number; tidalItem?: Record<string, unknown> };
	export const MediaItem: {
		fromPlaybackContext(): Promise<LunaMediaItem | null>;
		onMediaTransition(unloads: Set<() => void>, callback: (item: LunaMediaItem) => void): void;
	};
	export class StyleTag { constructor(name: string, unloads: Set<() => void>, styles: string) }
}
declare module "@luna/ui" {
	import type React from "react";
	export const LunaSettings: React.ComponentType<React.PropsWithChildren>;
	export const LunaTextSetting: React.ComponentType<Record<string, unknown>>;
	export const LunaSwitchSetting: React.ComponentType<Record<string, unknown>>;
	export const LunaSelectSetting: React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;
	export const LunaSelectItem: React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;
}
