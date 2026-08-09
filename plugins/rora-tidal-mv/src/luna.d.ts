declare module "file://styles.css?minify" { const styles: string; export default styles }
declare module "file://../styles.css?minify" { const styles: string; export default styles }
declare module "@luna/core" {
	export type LunaUnload = () => void;
	export const ReactiveStore: { getPluginStorage<T>(name: string, defaults: T): Promise<T> };
}
declare module "@luna/lib" {
	export const PlayState: { playing: boolean; play(): void; pause(): void };
	export const MediaItem: { fromPlaybackContext(): Promise<{ tidalItem?: Record<string, unknown> } | null> };
	export class StyleTag { constructor(name: string, unloads: Set<() => void>, styles: string) }
}
declare module "@luna/ui" {
	import type React from "react";
	export const LunaSettings: React.ComponentType<React.PropsWithChildren>;
	export const LunaTextSetting: React.ComponentType<Record<string, unknown>>;
	export const LunaSwitchSetting: React.ComponentType<Record<string, unknown>>;
}
