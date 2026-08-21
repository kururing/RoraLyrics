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
	export interface PlaybackManifest {
		codecs?: string | null;
	}
	export interface PlaybackInfo {
		audioQuality?: string;
		bitDepth?: number | null;
		sampleRate?: number | null;
		mimeType?: string | null;
		manifest?: PlaybackManifest;
	}
	export interface LunaMediaItem {
		id: string | number;
		contentType?: "track" | "video";
		playbackInfo(): Promise<PlaybackInfo>;
		tidalItem?: Record<string, unknown> & {
			id?: string | number;
			title?: string;
			artist?: { name?: string; id?: string | number };
			artists?: Array<{ name?: string; id?: string | number }>;
			album?: { title?: string; id?: string | number };
			type?: string;
			quality?: string;
			imageId?: string;
		};
	}
	export const MediaItem: {
		fromId(
			itemId: string | number,
			contentType?: "track" | "video",
		): Promise<LunaMediaItem | undefined>;
		fromPlaybackContext(ctx?: {
			actualProductId?: string | number;
		}): Promise<LunaMediaItem | undefined>;
		onMediaTransition(
			unloads: Set<() => void>,
			callback: (item: LunaMediaItem) => void,
		): void;
	};
	export class StyleTag {
		constructor(name: string, unloads: Set<() => void>, styles: string);
	}
	export const observe: <T extends Element = Element>(
		unloads: Set<() => void>,
		selector: string,
		callback: (element: T) => void,
	) => void;
}

declare module "@luna/ui" {
	import type React from "react";
	export const LunaSettings: React.ComponentType<React.PropsWithChildren>;
	export const LunaSwitchSetting: React.ComponentType<Record<string, unknown>>;
}
