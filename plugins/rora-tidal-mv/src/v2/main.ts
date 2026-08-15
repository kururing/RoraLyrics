import styles from "file://../styles.css?minify";
import type { LunaUnload } from "@luna/core";
import { MediaItem, PlayState, StyleTag } from "@luna/lib";
import { Settings } from "../SettingsPage";
import { settings, subscribeSettings } from "../settings";
import {
	cacheMv,
	getCachedMv,
	invalidateMv,
	isUnavailableError,
} from "./cache";
import { findYouTubeVideo } from "./search";
import type { MvResult, TrackMetadata } from "./types";
import {
	Modal,
	type MvButton,
	type MvButtonState,
	mountFooterButton,
} from "./ui";

export { Settings };
export const unloads = new Set<LunaUnload>();
new StyleTag("RoraTidalMv", unloads, styles);

let button: MvButton | null = null;
let pausedByPlugin = false;
let operation: AbortController | null = null;
let currentTrackId: string | null = null;

const resumeIfConfigured = (): void => {
	if (pausedByPlugin && settings.resumeTidalOnClose) PlayState.play();
	pausedByPlugin = false;
};

const modal = new Modal(resumeIfConfigured);

const currentTrack = async (): Promise<TrackMetadata | null> => {
	const item = await MediaItem.fromPlaybackContext();
	if (!item) return null;
	const raw = (item.tidalItem ?? {}) as {
		title?: unknown;
		artist?: { name?: unknown };
		artists?: Array<{ name?: unknown }>;
		album?: { title?: unknown };
	};
	const title = String(raw.title ?? "").trim();
	const artist = String(
		raw.artist?.name ?? raw.artists?.[0]?.name ?? "",
	).trim();
	if (!title) return null;
	return {
		trackId: String(item.id),
		title,
		artist,
		album: raw.album?.title ? String(raw.album.title) : undefined,
	};
};

const resolveButtonState = async (trackId: string): Promise<MvButtonState> => {
	if (!settings.rememberMvResults) return "idle";
	const cached = await getCachedMv(trackId);
	return cached ? "available" : "idle";
};

const openMv = async (): Promise<void> => {
	operation?.abort();
	operation = new AbortController();
	const signal = operation.signal;

	button?.setState("loading");
	const track = await currentTrack();
	if (!track) {
		if (!signal.aborted) button?.setState("no-mv");
		return;
	}
	if (signal.aborted) return;
	pausedByPlugin = PlayState.playing;
	if (pausedByPlugin) PlayState.pause();

	let result: MvResult | null = settings.rememberMvResults
		? await getCachedMv(track.trackId)
		: null;
	if (signal.aborted) return;

	if (!result && settings.youtubeApiKey.trim()) {
		try {
			result = await findYouTubeVideo(
				track,
				settings.youtubeApiKey,
				signal,
				settings.preferOfficialMv,
			);
		} catch (error) {
			if (
				!signal.aborted &&
				!(error instanceof DOMException && error.name === "AbortError")
			) {
				// Fall through with a null result; the modal shows the YouTube-search fallback.
				result = null;
			}
		}
	}
	if (signal.aborted) return;

	if (result && settings.rememberMvResults) void cacheMv(track.trackId, result);

	await modal.open(track, result, settings.mvQuality, (code) => {
		if (isUnavailableError(code) && settings.rememberMvResults)
			void invalidateMv(track.trackId);
	});
	button?.setState(result ? "available" : "no-mv");
};

const syncButton = (): void => {
	if (settings.enableMvButton && !button) {
		button = mountFooterButton(() => void openMv());
	} else if (!settings.enableMvButton && button) {
		button.unmount();
		button = null;
	}
};

// Close the MV when the TIDAL track changes; never auto-open the next track's MV.
MediaItem.onMediaTransition(unloads, (item) => {
	const trackId = String(item.id ?? "");
	if (trackId === currentTrackId) return;
	currentTrackId = trackId;
	modal.close(false);
	pausedByPlugin = false;
	operation?.abort();
	operation = null;
	void (async () => {
		button?.setState(await resolveButtonState(trackId));
	})();
});

syncButton();
const unsubscribeSettings = subscribeSettings(syncButton);

unloads.add(() => {
	unsubscribeSettings();
	operation?.abort();
	operation = null;
	button?.unmount();
	button = null;
	modal.close(false);
	pausedByPlugin = false;
});
