import type {
	MvPlayState,
	PlayerController,
	YouTubeNamespace,
	YouTubePlayer,
} from "./types";

const mapState = (data: number): MvPlayState => {
	switch (data) {
		case 0:
			return "ended";
		case 1:
			return "playing";
		case 2:
			return "paused";
		default:
			return "unstarted";
	}
};

export interface PlayerOptions {
	quality?: string;
}

let apiPromise: Promise<YouTubeNamespace> | null = null;

/**
 * Load the YouTube IFrame API script directly into the page. The plugin runs in
 * Tidal's own document (origin https://desktop.tidal.com), so requests carry a
 * valid HTTP Referer — required by YouTube since late 2025 (error 153). Loading
 * a separate `srcdoc`/`blob:` player document does NOT carry that referer.
 */
const loadYouTubeApi = (): Promise<YouTubeNamespace> => {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	if (apiPromise) return apiPromise;
	apiPromise = new Promise((resolve, reject) => {
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			if (window.YT) resolve(window.YT);
			else reject(new Error("YouTube IFrame API unavailable"));
		};
		const script = document.createElement("script");
		script.src = "https://www.youtube.com/iframe_api";
		script.async = true;
		script.addEventListener(
			"error",
			() => {
				apiPromise = null;
				reject(new Error("Unable to load YouTube IFrame API"));
			},
			{ once: true },
		);
		document.head.append(script);
	});
	return apiPromise;
};

export const createPlayer = async (
	container: HTMLElement,
	videoId: string,
	options: PlayerOptions,
	signal: AbortSignal,
): Promise<PlayerController> => {
	const host = document.createElement("div");
	host.className = "rora-mv-video";
	container.replaceChildren(host);

	const yt = await loadYouTubeApi();
	if (signal.aborted) throw new DOMException("Aborted", "AbortError");

	return new Promise((resolve, reject) => {
		let player: YouTubePlayer | null = null;
		let settled = false;
		let destroyed = false;
		let pendingError: number | null = null;
		const stateListeners = new Set<(state: MvPlayState) => void>();
		const errorListeners = new Set<(code: number) => void>();

		const cleanup = () => {
			if (destroyed) return;
			destroyed = true;
			window.clearTimeout(timeout);
			stateListeners.clear();
			errorListeners.clear();
			try {
				player?.destroy();
			} catch {
				// Player may already be torn down.
			}
			player = null;
			container.replaceChildren();
		};

		const settleError = (error: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(error);
		};

		player = new yt.Player(host, {
			videoId,
			playerVars: {
				autoplay: 1,
				playsinline: 1,
				controls: 1,
				rel: 0,
				origin: window.location.origin,
			},
			events: {
				onReady: () => {
					if (settled) return;
					settled = true;
					window.clearTimeout(timeout);
					const qualities = player?.getAvailableQualityLevels?.() ?? [];
					if (options.quality && options.quality !== "auto")
						player?.setPlaybackQuality?.(options.quality);
					resolve({
						play: () => player?.playVideo(),
						pause: () => player?.pauseVideo(),
						seek: (seconds) => player?.seekTo(seconds, true),
						volume: (value) => player?.setVolume(value),
						mute: (muted) => {
							if (muted) player?.mute();
							else player?.unMute();
						},
						quality: (value) => player?.setPlaybackQuality?.(value),
						qualities,
						onState: (listener) => {
							stateListeners.add(listener);
							return () => stateListeners.delete(listener);
						},
						onError: (listener) => {
							errorListeners.add(listener);
							if (pendingError !== null) listener(pendingError);
							return () => errorListeners.delete(listener);
						},
						destroy: cleanup,
					});
				},
				onStateChange: (event: unknown) => {
					const data = Number((event as { data?: unknown })?.data);
					for (const listener of stateListeners) listener(mapState(data));
				},
				onError: (event: unknown) => {
					const code = Number((event as { data?: unknown })?.data);
					if (!settled && pendingError === null) pendingError = code;
					for (const listener of errorListeners) listener(code);
				},
				onAutoplayBlocked: () => player?.playVideo(),
			},
		});

		const timeout = window.setTimeout(
			() => settleError(new Error("PLAYER_TIMEOUT")),
			15000,
		);

		signal.addEventListener(
			"abort",
			() => settleError(new DOMException("Aborted", "AbortError")),
			{ once: true },
		);
	});
};
