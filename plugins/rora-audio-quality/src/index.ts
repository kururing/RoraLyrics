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

const SEEK_AREA_SELECTOR = [
	"#footerPlayer input[type='range']",
	"[data-test='seek-bar']",
	"[data-test='progress-bar']",
	"[role='slider']",
	"[data-test='player-seekbar']",
	"[class*='seekbar']",
	"[class*='progressBar']",
].join(", ");

const setupSeekbarHider = (badgeHost: HTMLElement): (() => void) => {
	const cleaners: Array<() => void> = [];

	const hideBadge = () => { badgeHost.style.display = "none"; };
	const showBadge = () => { badgeHost.style.display = ""; };

	const attach = () => {
		const areas = document.querySelectorAll<HTMLElement>(SEEK_AREA_SELECTOR);
		for (const area of areas) {
			area.addEventListener("pointerenter", hideBadge);
			area.addEventListener("pointerleave", showBadge);
			cleaners.push(() => {
				area.removeEventListener("pointerenter", hideBadge);
				area.removeEventListener("pointerleave", showBadge);
			});
		}
	};

	attach();
	// Retry if seekbar loads later
	let retryTimer: number | undefined;
	const scheduleRetry = () => {
		if (retryTimer !== undefined) return;
		retryTimer = window.setTimeout(() => {
			retryTimer = undefined;
			if (disposed) return;
			attach();
		}, 600);
	};
	// Observe footer additions for late seekbar mount
	const footer = document.querySelector<HTMLElement>("#footerPlayer");
	if (footer) {
		const mo = new MutationObserver(() => {
			cleaners.length = 0;
			scheduleRetry();
		});
		mo.observe(footer, { childList: true, subtree: true });
		cleaners.push(() => mo.disconnect());
	}

	return () => {
		if (retryTimer !== undefined) window.clearTimeout(retryTimer);
		for (const c of cleaners) c();
	};
};

const renderNowPlaying = (): void => {
	const oldHost = document.querySelector<HTMLElement>(
		`[data-rora-quality="${NOW_PLAYING_MARKER}"]`,
	);
	if (oldHost) {
		(oldHost as any).__roraCleanup?.();
		oldHost.remove();
	}
	if (!settings.enableNowPlaying || disposed) return;
	const indicator = document.querySelector<HTMLElement>(
		"[data-test-media-state-indicator-streaming-quality]",
	);
	const pill = indicator?.parentElement;
	if (!pill) return;
	const quality = fromPlaybackContext(PlayState.playbackContext ?? {});
	if (!quality) return;
	currentPlaybackQuality = quality;
	cache.set(quality);
	trackLists.refreshTrack(quality.trackId);
	trackLists.setPlaybackQuality(quality);
	// Gắn badge ra khỏi subtree controls để tránh bị TIDAL clone vào
	// tooltip khi hover seek bar. Sử dụng #footerPlayer làm anchor + CSS
	// absolute để đặt cạnh pill gốc.
	const footer = document.querySelector<HTMLElement>("#footerPlayer");
	const host = document.createElement("span");
	host.dataset.roraQuality = NOW_PLAYING_MARKER;
	host.className = "rora-quality-now-playing";
	host.style.position = "absolute";
	host.replaceChildren(createQualityBadge(quality));
	const positionHost = () => {
		if (!pill.isConnected || !host.isConnected) return;
		const pillRect = pill.getBoundingClientRect();
		const anchor = footer ?? document.body;
		const anchorRect = anchor.getBoundingClientRect();
		host.style.top = `${pillRect.top - anchorRect.top}px`;
		host.style.right = `${anchorRect.right - pillRect.right}px`;
	};
	(footer ?? document.body).appendChild(host);
	positionHost();

	// Ẩn badge khi con trỏ chạm vào seek bar để tránh lọt vào tooltip
	const unhideSeekbar = footer ? setupSeekbarHider(host) : null;

	// Đồng bộ vị trí nếu layout thay đổi
	const syncPosition = () => { if (!disposed) positionHost(); };
	const ro = new ResizeObserver(syncPosition);
	if (footer) ro.observe(footer);
	window.addEventListener("resize", syncPosition);

	const cleanupHost = () => {
		ro.disconnect();
		window.removeEventListener("resize", syncPosition);
		unhideSeekbar?.();
		host.remove();
	};
	// Thay thế host cũ thành host mới cho lần re-render tiếp theo
	const oldCleanup = (host as any).__roraCleanup;
	oldCleanup?.();
	(host as any).__roraCleanup = cleanupHost;
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
	const host = document.querySelector<HTMLElement>(
		`[data-rora-quality="${NOW_PLAYING_MARKER}"]`,
	);
	if (host) {
		(host as any).__roraCleanup?.();
		host.remove();
	}
	cache.clear();
	currentPlaybackQuality = null;
});
