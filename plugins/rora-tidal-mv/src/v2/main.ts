import styles from "file://../styles.css?minify";
import type { LunaUnload } from "@luna/core";
import { MediaItem, redux, StyleTag } from "@luna/lib";
import { Settings } from "../SettingsPage";
import { settings, subscribeSettings } from "../settings";
import { playTidalVideo } from "./tidalVideo";
import type { Button, TrackMetadata } from "./types";
import { mountFooterButton } from "./button";
import { dismissToast, showToast } from "./notification";

export { Settings };
export const unloads = new Set<LunaUnload>();
new StyleTag("RoraTidalMv", unloads, styles);

/**
 * Centralised state for the plugin. All mutable runtime state lives on a
 * single instance so we don't have to reason about scattered module-level
 * `let` variables that could be mutated from concurrent async paths (button
 * click, media transition, unload handler).
 *
 * `openMv` is guarded by `openInFlight` so a second click during an in-flight
 * call is ignored — the previous call already covers the same user intent.
 */
class MvController {
	private button: Button | null = null;
	private operation: AbortController | null = null;
	private currentTrackId: string | null = null;
	private openInFlight = false;

	private async currentTrack(): Promise<TrackMetadata | null> {
		let item:
			| { id?: unknown; contentType?: unknown; tidalItem?: unknown }
			| undefined;
		try {
			item = await MediaItem.fromPlaybackContext();
		} catch {
			// ignore
		}

		if (item?.contentType && item.contentType !== "track") return null;

		const raw = (item?.tidalItem ?? {}) as {
			id?: unknown;
			title?: unknown;
			artist?: { name?: unknown };
			artists?: Array<{ name?: unknown }>;
			album?: { title?: unknown };
		};

		const store = (redux.store?.getState?.() ?? {}) as {
			playbackControls?: {
				playbackContext?: {
					actualProductId?: unknown;
				};
			};
			entities?: {
				tracks?: {
					entities?: Record<
						string,
						{
							title?: unknown;
							attributes?: { title?: unknown };
							artist?: { name?: unknown };
							artists?: Array<{ name?: unknown }>;
							relationships?: {
								artists?: { data?: Array<{ name?: unknown }> };
							};
							album?: { title?: unknown };
						}
					>;
				};
			};
		};

		const contextProductId =
			store.playbackControls?.playbackContext?.actualProductId;

		const trackId = String(item?.id ?? raw.id ?? contextProductId ?? "").trim();
		let title = String(raw.title ?? "").trim();
		let artist = String(
			raw.artist?.name ?? raw.artists?.[0]?.name ?? "",
		).trim();
		let album = raw.album?.title ? String(raw.album.title) : undefined;

		if (
			(!title || !artist) &&
			trackId &&
			store.entities?.tracks?.entities?.[trackId]
		) {
			const entity = store.entities.tracks.entities[trackId];
			title = title || String(entity.title ?? entity.attributes?.title ?? "");
			artist =
				artist ||
				String(
					entity.artist?.name ??
						entity.artists?.[0]?.name ??
						entity.relationships?.artists?.data?.[0]?.name ??
						"",
				);
			album =
				album || (entity.album?.title ? String(entity.album.title) : undefined);
		}

		if (!trackId || !title) return null;

		return {
			trackId,
			title,
			artist,
			album,
		};
	}

	openMv = async (): Promise<void> => {
		if (this.openInFlight) return;
		this.openInFlight = true;
		try {
			await this.runOpenMv();
		} finally {
			this.openInFlight = false;
		}
	};

	private async runOpenMv(): Promise<void> {
		this.operation?.abort();
		this.operation = new AbortController();
		const signal = this.operation.signal;

		this.button?.setState("loading");
		const track = await this.currentTrack();
		if (signal.aborted) return;
		if (!track) {
			this.button?.setState("no-mv");
			showToast("No music video available for this track");
			return;
		}

		try {
			const outcome = await playTidalVideo(track, signal);
			if (signal.aborted) return;

			if (outcome.kind === "played") {
				this.button?.setState("idle");
				return;
			}

			if (outcome.kind === "notFound") {
				this.button?.setState("no-mv");
				showToast("No music video available for this track");
				return;
			}

			// outcome.kind === "error"
			this.button?.setState("idle");
			console.warn("[RoraTidalMv] Failed to play video:", outcome.error);
			showToast("Couldn't open music video");
		} catch (err) {
			if (!signal.aborted) {
				this.button?.setState("idle");
				console.warn("[RoraTidalMv] Error playing video:", err);
				showToast("Couldn't open music video");
			}
		}
	}

	syncButton = (): void => {
		if (settings.enableMvButton) {
			if (!this.button) {
				this.button = mountFooterButton(() => void this.openMv());
			} else {
				this.button.ensureMounted?.();
			}
		} else if (this.button) {
			this.button.unmount();
			this.button = null;
		}
	};

	async onMediaTransition(item: { id?: unknown }): Promise<void> {
		const trackId = String(item?.id ?? "");
		if (trackId && trackId === this.currentTrackId) return;
		this.currentTrackId = trackId;
		this.operation?.abort();
		this.operation = null;
		this.button?.setState("idle");
		this.syncButton();
	}

	unload(): void {
		this.operation?.abort();
		this.operation = null;
		dismissToast();
		this.button?.unmount();
		this.button = null;
	}
}

const controller = new MvController();

MediaItem.onMediaTransition(unloads, (item) => {
	void controller.onMediaTransition(item);
});

controller.syncButton();
const unsubscribeSettings = subscribeSettings(controller.syncButton);

unloads.add(() => {
	unsubscribeSettings();
	controller.unload();
});
