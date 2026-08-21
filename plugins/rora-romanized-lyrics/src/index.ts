import styles from "file://styles.css?minify";
import type { LunaUnload } from "@luna/core";
import {
	MediaItem,
	observe,
	PlayState,
	redux,
	StyleTag,
	safeInterval,
} from "@luna/lib";
import { LyricsView } from "./components/LyricsView";
import { observeLyricsPageLifecycle } from "./integration/lyricsPageLifecycle";
import { integrateRoraLyrics } from "./integration/roraLyricsIntegration";
import { romanizeLines } from "./lyrics/romanize";
import { calculateLivePlaybackPositionMs } from "./playback/time";
import { TidalProvider } from "./providers/tidalProvider";
import type { TidalLyricsPayload } from "./providers/tidalPayload";
import { Settings } from "./settings/Settings";
import { settings, subscribeSettings } from "./settings/settingsStore";
import type { LyricsResult, TrackMetadata } from "./types/lyrics";

export { Settings };
export const unloads = new Set<LunaUnload>();
new StyleTag("RoraRomanizedLyrics", unloads, styles);

const provider = new TidalProvider();
let result: LyricsResult | null = null;
let resultTrackId = "";
let trackToken = 0;
let view: LyricsView | null = null;
let lastTrackId = "";
let lastDisplaySignature = "";
let panelVisibilityObserver: IntersectionObserver | null = null;
const panelViews = new WeakMap<HTMLElement, LyricsView>();

const currentPlaybackTrackId = (): string =>
	String(PlayState.playbackContext?.actualProductId ?? "");
const isCurrentResult = (): boolean =>
	Boolean(result && resultTrackId === currentPlaybackTrackId());
const canOpenCurrentLyrics = (): boolean =>
	Boolean(
		isCurrentResult() &&
			(result?.lines.length ||
				result?.originalLyrics?.trim() ||
				result?.instrumental),
	);
const hasCurrentSyncedLyrics = (): boolean =>
	Boolean(isCurrentResult() && result?.syncedLyrics && result.lines.length > 0);

const getLatestPlaybackPositionMs = (): number => {
	const controls = PlayState.playbackControls;
	return calculateLivePlaybackPositionMs({
		currentTimeSeconds: controls.latestCurrentTime,
		currentTimeSyncTimestampMs: controls.latestCurrentTimeSyncTimestamp,
		isPlaying: PlayState.playing,
		durationSeconds: controls.playbackContext?.actualDuration,
	});
};

const syncHighlightNow = (): void => {
	if (!result || !view || !hasCurrentSyncedLyrics()) return;
	view.synchronize(result, getLatestPlaybackPositionMs(), "auto");
};

const syncLyricsFromButton = (): void => {
	if (!result || !view || !hasCurrentSyncedLyrics()) return;
	view.synchronize(result, getLatestPlaybackPositionMs(), "smooth");
	integration.setSyncNeeded(false);
};

const integration = integrateRoraLyrics(
	unloads,
	syncLyricsFromButton,
	canOpenCurrentLyrics,
	hasCurrentSyncedLyrics,
);

const metadata = async (): Promise<TrackMetadata | null> => {
	const item = await MediaItem.fromPlaybackContext();
	const track = item?.tidalItem;
	if (!track?.title) return null;
	const artist =
		track.artist?.name ??
		(Array.isArray(track.artists) ? track.artists[0]?.name : "") ??
		"";
	if (!artist) return null;
	return {
		id: String(track.id ?? currentPlaybackTrackId()),
		title: track.title,
		artist,
		album: track.album?.title ?? "",
		durationMs:
			typeof track.duration === "number" ? track.duration * 1000 : undefined,
		version: track.version ?? undefined,
	};
};

const render = (resetToTop = false): void => {
	if (!view || !result || !isCurrentResult()) return;
	view.render(result);
	lastDisplaySignature = `${settings.showOriginal}:${settings.showRomanized}:${settings.showTimestamp}`;
	if (resetToTop && !hasCurrentSyncedLyrics()) view.scrollToTop();
	else syncHighlightNow();
};

const load = async (): Promise<void> => {
	const token = ++trackToken;
	const requestedTrackId = currentPlaybackTrackId();
	result = null;
	resultTrackId = "";
	integration.updateAvailability();
	integration.setSyncNeeded(true);
	view?.status("Loading TIDAL lyrics…");
	try {
		const track = await metadata();
		if (
			!track ||
			token !== trackToken ||
			requestedTrackId !== currentPlaybackTrackId()
		)
			return;
		lastTrackId = track.id ?? requestedTrackId;
		const loaded = await provider.getLyrics(track);
		if (token !== trackToken || requestedTrackId !== currentPlaybackTrackId())
			return;
		if (!loaded.syncedLyrics && !loaded.originalLyrics && !loaded.instrumental)
			throw new Error("Lyrics unavailable");
		result = { ...loaded, lines: romanizeLines(loaded.lines) };
		resultTrackId = requestedTrackId;
		render(true);
		integration.updateAvailability();
	} catch (error) {
		if (token !== trackToken) return;
		view?.status(error instanceof Error ? error.message : "Lyrics unavailable");
		integration.updateAvailability();
	}
};

// The native lyrics entity can arrive after plugin startup. Reload only after
// TIDAL has committed its success action; this does not alter playback state.
redux.intercept<TidalLyricsPayload>(
	"content/LOAD_ITEM_LYRICS_SUCCESS",
	unloads,
	(payload) => {
		provider.captureLyrics(payload);
		if (String(payload.trackId) !== currentPlaybackTrackId()) return;
		queueMicrotask(() => void load());
	},
);

const mount = (panel: HTMLElement): void => {
	const existingView = panelViews.get(panel);
	if (existingView && panel.contains(existingView.element)) {
		view = existingView;
		syncHighlightNow();
		return;
	}
	panel.querySelector(".rora-lyrics-host")?.remove();
	view?.destroy();
	panelVisibilityObserver?.disconnect();
	view = new LyricsView(
		() => integration.setSyncNeeded(true),
		() => integration.setSyncNeeded(false),
	);
	panelViews.set(panel, view);
	panel.classList.add("rora-mounted");
	for (const child of panel.children)
		if (!(child as HTMLElement).classList.contains("rora-lyrics-host"))
			(child as HTMLElement).style.display = "none";
	panel.appendChild(view.element);
	panelVisibilityObserver = new IntersectionObserver((entries) => {
		const entry = entries.at(-1);
		if (entry?.isIntersecting) syncHighlightNow();
		else view?.clearActive();
	});
	panelVisibilityObserver.observe(panel);
	if (isCurrentResult()) void render();
	else void load();
};

observe<HTMLElement>(unloads, '[data-test="now-playing-lyrics"]', mount);
document
	.querySelectorAll<HTMLElement>('[data-test="now-playing-lyrics"]')
	.forEach(mount);
observeLyricsPageLifecycle(unloads, {
	onLeave: () => {
		integration.setLyricsOpen(false);
		view?.clearActive();
	},
	onEnter: () => {
		integration.setLyricsOpen(true);
		view?.clearActive();
		integration.setSyncNeeded(true);
		syncHighlightNow();
	},
});

void load();
safeInterval(
	unloads,
	() => {
		const id = currentPlaybackTrackId();
		if (result && hasCurrentSyncedLyrics())
			view?.tick(result, getLatestPlaybackPositionMs());
		if (id && lastTrackId && id !== lastTrackId) void load();
	},
	120,
);

const unsubscribe = subscribeSettings(() => {
	view?.updateAppearance();
	const signature = `${settings.showOriginal}:${settings.showRomanized}:${settings.showTimestamp}`;
	if (signature !== lastDisplaySignature) void render();
});
unloads.add(unsubscribe);
unloads.add(() => {
	trackToken++;
	provider.clear();
	panelVisibilityObserver?.disconnect();
	view?.destroy();
	document
		.querySelectorAll<HTMLElement>(
			'[data-test="now-playing-lyrics"].rora-mounted',
		)
		.forEach((panel) => {
			panel.classList.remove("rora-mounted");
			panel.querySelector(".rora-lyrics-host")?.remove();
			for (const child of panel.children)
				(child as HTMLElement).style.removeProperty("display");
		});
	view = null;
	result = null;
	resultTrackId = "";
});
