import styles from "file://styles.css?minify";
import type { LunaUnload } from "@luna/core";
import { MediaItem, PlayState, StyleTag } from "@luna/lib";
import { Settings } from "./SettingsPage";
import { VideoModal } from "./modal";
import { NowPlayingButton } from "./nowPlayingButton";
import { settings } from "./settings";
import type { TrackMetadata } from "./types";
import { cleanupYouTubeApiLoader } from "./youtube";
import { findYouTubeVideo } from "./videoSearch";

export { Settings };
export const unloads = new Set<LunaUnload>();
new StyleTag("RoraTidalMv", unloads, styles);

let pausedByPlugin = false;
let search: AbortController | null = null;

const resumeIfConfigured = (): void => {
	if (pausedByPlugin && settings.resumeTidalOnClose) PlayState.play();
	pausedByPlugin = false;
};

const modal = new VideoModal(resumeIfConfigured);

const currentTrack = async (): Promise<TrackMetadata | null> => {
	const item = await MediaItem.fromPlaybackContext();
	const track = (item?.tidalItem ?? {}) as { title?: unknown; artist?: { name?: unknown }; artists?: Array<{ name?: unknown }> };
	const title = String(track.title ?? "").trim();
	const artist = String(track.artist?.name ?? track.artists?.[0]?.name ?? "").trim();
	return title ? { title, artist } : null;
};

const openCurrentVideo = async (): Promise<void> => {
	search?.abort();
	search = new AbortController();
	const track = await currentTrack();
	if (!track || search.signal.aborted) return;
	pausedByPlugin = PlayState.playing;
	if (pausedByPlugin) PlayState.pause();
	try {
		const videoId = await findYouTubeVideo(track, settings.youtubeApiKey, search.signal);
		if (!search.signal.aborted) await modal.open(track, videoId);
	} catch (error) {
		if (!(error instanceof DOMException && error.name === "AbortError")) await modal.open(track, null);
	}
};

const button = new NowPlayingButton(() => void openCurrentVideo());
button.mount();

unloads.add(() => {
	search?.abort();
	search = null;
	button.destroy();
	modal.close(false);
	cleanupYouTubeApiLoader();
	pausedByPlugin = false;
});
