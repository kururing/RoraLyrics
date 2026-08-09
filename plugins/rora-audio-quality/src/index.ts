import styles from "file://styles.css?minify";
import type { LunaUnload } from "@luna/core";
import { MediaItem, observe, PlayState, StyleTag } from "@luna/lib";
import { createQualityBadge } from "./badge";
import { QualityCache, RequestPool } from "./cache";
import { fromPlaybackContext, fromPlaybackInfo } from "./quality";
import { Settings } from "./SettingsPage";
import { settings, subscribeSettings } from "./settings";
import {
	DURATION_SELECTOR,
	getTrackRowFromLink,
	getTrackRowFromDuration,
	TRACK_LINK_SELECTOR,
	TRACK_ROW_SELECTOR,
	TRACK_TABLE_SELECTOR,
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
let currentPlaybackQuality: TrackAudioQuality | null = null;

const enqueueQualityLookup = async (
	trackId: string,
): Promise<TrackAudioQuality> => {
	if (currentPlaybackQuality?.trackId === trackId)
		return currentPlaybackQuality;
	const cached = cache.get(trackId);
	if (cached) return cached;
	return requests.run(trackId, async () => {
		const mediaItem = await MediaItem.fromId(trackId);
		if (!mediaItem) throw new Error(`Track ${trackId} not found`);
		const playbackInfo = await mediaItem.playbackInfo();
		const quality = fromPlaybackInfo(trackId, playbackInfo);
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
	.querySelectorAll<HTMLElement>(TRACK_TABLE_SELECTOR)
	.forEach(mountTrackList);
observe<HTMLElement>(unloads, TRACK_TABLE_SELECTOR, mountTrackList);

const processVisibleRow = (row: HTMLElement): void => {
	void trackLists.processTrackRow(row);
};
document
	.querySelectorAll<HTMLElement>(TRACK_ROW_SELECTOR)
	.forEach(processVisibleRow);
observe<HTMLElement>(unloads, TRACK_ROW_SELECTOR, processVisibleRow);

const processTrackLink = (link: HTMLAnchorElement): void => {
	const row = getTrackRowFromLink(link);
	if (row) void trackLists.processTrackRow(row);
};
document
	.querySelectorAll<HTMLAnchorElement>(TRACK_LINK_SELECTOR)
	.forEach(processTrackLink);
observe<HTMLAnchorElement>(unloads, TRACK_LINK_SELECTOR, processTrackLink);

const processDuration = (duration: HTMLElement): void => {
	const row = getTrackRowFromDuration(duration);
	if (row) void trackLists.processTrackRow(row);
};
document
	.querySelectorAll<HTMLElement>(DURATION_SELECTOR)
	.forEach(processDuration);
observe<HTMLElement>(unloads, DURATION_SELECTOR, processDuration);

const refreshTimers = new Set<number>();
const rescanVisibleTracks = (): void => {
	if (disposed) return;
	trackLists.refresh();
	document
		.querySelectorAll<HTMLElement>(TRACK_ROW_SELECTOR)
		.forEach(processVisibleRow);
	document
		.querySelectorAll<HTMLElement>(DURATION_SELECTOR)
		.forEach(processDuration);
};

const scheduleListRefresh = (): void => {
	// Recommended tracks are committed in multiple React renders. Rescan after
	// both the immediate replacement and the following asynchronous data render.
	for (const delay of [0, 250, 800]) {
		const timer = window.setTimeout(() => {
			refreshTimers.delete(timer);
			rescanVisibleTracks();
		}, delay);
		refreshTimers.add(timer);
	}
};

const onDocumentClick = (event: MouseEvent): void => {
	const button =
		event.target instanceof Element ? event.target.closest("button") : null;
	if (!button) return;
	const label = `${button.textContent ?? ""} ${button.getAttribute("aria-label") ?? ""} ${button.getAttribute("data-test") ?? ""}`
		.trim()
		.toLowerCase();
	if (label.includes("refresh list") || label.includes("refresh-list"))
		scheduleListRefresh();
};
document.addEventListener("click", onDocumentClick, true);
unloads.add(() => {
	document.removeEventListener("click", onDocumentClick, true);
	for (const timer of refreshTimers) window.clearTimeout(timer);
	refreshTimers.clear();
});

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
	currentPlaybackQuality = quality;
	cache.set(quality);
	trackLists.refreshTrack(quality.trackId);
	trackLists.setPlaybackQuality(quality);
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
	currentPlaybackQuality = null;
});
