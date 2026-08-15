import styles from "file://styles.css?minify";
import type { LunaUnload } from "@luna/core";
import { MediaItem, observe, StyleTag } from "@luna/lib";
import { QualityCache, RequestPool } from "./cache";
import { fromPlaybackInfo } from "./quality";
import { Settings } from "./SettingsPage";
import { SearchQualityFilter } from "./searchQualityFilter";
import { settings, subscribeSettings } from "./settings";
import {
	DURATION_SELECTOR,
	getTrackRowFromDuration,
	getTrackRowFromLink,
	TRACK_LINK_SELECTOR,
	TRACK_ROW_SELECTOR,
	TRACK_TABLE_SELECTOR,
	TrackListIntegration,
} from "./trackListIntegration";
import type { TrackAudioQuality } from "./types";

export { Settings };
export const unloads = new Set<LunaUnload>();
new StyleTag("RoraAudioQuality", unloads, styles);

const removeLegacySearchQualityFilter = (): void => {
	document
		.querySelectorAll<HTMLElement>(".rora-quality-filter-label")
		.forEach((element) => {
			element.remove();
		});
	document
		.querySelectorAll<HTMLElement>("[data-rora-quality-filter]")
		.forEach((element) => {
			element.removeAttribute("data-rora-quality-filter");
		});
};
removeLegacySearchQualityFilter();

const LEGACY_NOW_PLAYING_SELECTOR = [
	'[data-rora-quality="rora-audio-quality-now-playing"]',
	".rora-quality-now-playing",
	"#footerPlayer .rora-quality-badge",
].join(", ");
const removeLegacyNowPlayingBadge = (badge: HTMLElement): void => {
	const host = badge.closest<HTMLElement>(
		'[data-rora-quality="rora-audio-quality-now-playing"], .rora-quality-now-playing',
	);
	const footer = badge.closest<HTMLElement>("#footerPlayer");
	const parent = badge.parentElement;
	const cloneWrapper =
		footer && parent && parent !== footer && parent.childNodes.length === 1
			? parent
			: null;
	(host ?? cloneWrapper ?? badge).remove();
};
document
	.querySelectorAll<HTMLElement>(LEGACY_NOW_PLAYING_SELECTOR)
	.forEach(removeLegacyNowPlayingBadge);
observe<HTMLElement>(
	unloads,
	LEGACY_NOW_PLAYING_SELECTOR,
	removeLegacyNowPlayingBadge,
);

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
	getDisplayMode: () =>
		settings.qualityDisplay ? settings.qualityDisplayMode : "detailed",
	isDisposed: () => disposed,
});

const searchQualityFilter = new SearchQualityFilter(enqueueQualityLookup);
if (settings.enableSearchQualityFilter) searchQualityFilter.start();

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
	const label =
		`${button.textContent ?? ""} ${button.getAttribute("aria-label") ?? ""} ${button.getAttribute("data-test") ?? ""}`
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

const unsubscribe = subscribeSettings(() => {
	trackLists.refresh();
	if (settings.enableSearchQualityFilter) searchQualityFilter.start();
	else searchQualityFilter.stop();
});
unloads.add(unsubscribe);

unloads.add(() => {
	disposed = true;
	searchQualityFilter.stop();
	trackLists.disconnect();
	requests.dispose();
	cache.clear();
});
