declare module "file://styles.css?minify" {
	const styles: string;
	export default styles;
}

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
	export type LunaUnload = () => void;
	export interface LunaMediaItem {
		id: string | number;
		contentType?: "track" | "video";
		tidalItem?: Record<string, unknown> & {
			id?: string | number;
			title?: string;
			artist?: { name?: string; id?: string | number };
			artists?: Array<{ name?: string; id?: string | number }>;
			album?: { title?: string; id?: string | number };
			type?: string;
			duration?: number;
			version?: string;
			quality?: string;
			imageId?: string;
		};
	}
	export const PlayState: {
		play(mediaItemId?: string | number): void;
		pause(): void;
		next(): void;
		previous(): void;
		seek(seconds: number): void;
		readonly playing: boolean;
		readonly playbackContext:
			| {
					actualProductId?: string | number;
					actualDuration?: number;
			  }
			| undefined;
		readonly playbackControls: {
			readonly latestCurrentTime: number;
			readonly latestCurrentTimeSyncTimestamp: number;
			readonly playbackContext?: {
				readonly actualDuration?: number;
			};
		};
	};
	export const MediaItem: {
		fromPlaybackContext(ctx?: {
			actualProductId?: string | number;
		}): Promise<LunaMediaItem | undefined>;
	};
	export const redux: {
		store: {
			getState(): Record<string, unknown>;
		};
		intercept<T = unknown>(
			actionType: string | string[],
			unloads: Set<() => void>,
			callback: (payload: T, action?: unknown) => boolean | void,
		): () => void;
	};
	export class StyleTag {
		constructor(name: string, unloads: Set<() => void>, styles: string);
	}
	export const observe: <T extends Element = Element>(
		unloads: Set<() => void>,
		selector: string,
		callback: (element: T) => void,
	) => void;
	export const safeInterval: (
		unloads: Set<() => void>,
		callback: () => void,
		ms: number,
	) => number;
}

declare module "@luna/ui" {
	import type React from "react";
	export const LunaSettings: React.ComponentType<React.PropsWithChildren>;
	export const LunaSwitchSetting: React.ComponentType<Record<string, unknown>>;
}
