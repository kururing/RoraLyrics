import styles from "file://styles.css?minify";
import type { LunaUnload } from "@luna/core";
import { MediaItem, observe, PlayState, StyleTag } from "@luna/lib";
import { createQualityBadge } from "./badge";
import { QualityCache, RequestPool } from "./cache";
import { fromCatalogMetadata, fromPlaybackContext } from "./quality";
import { Settings } from "./SettingsPage";
import { settings, subscribeSettings } from "./settings";
import {
	TRACK_ROW_SELECTOR,
	TrackListIntegration,
} from "./trackListIntegration";
import type { TrackAudioQuality } from "./types";

export { Settings };
export const unloads = new Set<LunaUnload>();
new StyleTag("RoraAudioQuality", unloads, styles);

const NOW_PLAYING_MARKER = "rora-audio-quality-now-playing";
const cache = new QualityCache();
const requests = new RequestPool<TrackAudioQuality>(4);
let disposed = false;

const enqueueQualityLookup = async (
	trackId: string,
): Promise<TrackAudioQuality> => {
	const cached = cache.get(trackId);
	if (cached) return cached;
	return requests.run(trackId, async () => {
		const mediaItem = await MediaItem.fromId(trackId);
		const quality = fromCatalogMetadata(trackId, mediaItem?.tidalItem ?? {});
		cache.set(quality);
		return quality;
	});
};

const trackLists = new TrackListIntegration({
	loadQuality: enqueueQualityLookup,
	isEnabled: () => settings.enableTrackList,
	isDisposed: () => disposed,
});

const mountTrackList = (trackList: HTMLElement): void => {
	trackLists.mount(trackList);
};

document
	.querySelectorAll<HTMLElement>('div[aria-label="Tracklist"]')
	.forEach(mountTrackList);
observe<HTMLElement>(unloads, 'div[aria-label="Tracklist"]', mountTrackList);

const processVisibleRow = (row: HTMLElement): void => {
	void trackLists.processTrackRow(row);
};
document
	.querySelectorAll<HTMLElement>(TRACK_ROW_SELECTOR)
	.forEach(processVisibleRow);
observe<HTMLElement>(unloads, TRACK_ROW_SELECTOR, processVisibleRow);

const renderNowPlaying = (): void => {
	document
		.querySelector(`[data-rora-quality="${NOW_PLAYING_MARKER}"]`)
		?.remove();
	if (!settings.enableNowPlaying || disposed) return;
	const indicator = document.querySelector<HTMLElement>(
		"[data-test-media-state-indicator-streaming-quality]",
	);
	const container = indicator?.parentElement;
	if (!container) return;
	const quality = fromPlaybackContext(PlayState.playbackContext ?? {});
	if (!quality) return;
	cache.set(quality);
	trackLists.refreshTrack(quality.trackId);
	const host = document.createElement("span");
	host.dataset.roraQuality = NOW_PLAYING_MARKER;
	host.className = "rora-quality-now-playing";
	host.replaceChildren(createQualityBadge(quality));
	container.prepend(host);
};

MediaItem.onMediaTransition(unloads, () => queueMicrotask(renderNowPlaying));
observe<HTMLElement>(
	unloads,
	"[data-test-media-state-indicator-streaming-quality]",
	() => queueMicrotask(renderNowPlaying),
);
renderNowPlaying();

const unsubscribe = subscribeSettings(() => {
	trackLists.refresh();
	renderNowPlaying();
});
unloads.add(unsubscribe);
unloads.add(() => {
	disposed = true;
	trackLists.disconnect();
	requests.dispose();
	document
		.querySelector(`[data-rora-quality="${NOW_PLAYING_MARKER}"]`)
		?.remove();
	cache.clear();
});
