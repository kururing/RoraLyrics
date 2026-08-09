import type { YouTubeNamespace, YouTubePlayer } from "./types";

let apiPromise: Promise<YouTubeNamespace> | null = null;
let ownedScript: HTMLScriptElement | null = null;

export const loadYouTubeApi = (): Promise<YouTubeNamespace> => {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	if (apiPromise) return apiPromise;
	apiPromise = new Promise((resolve, reject) => {
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			if (window.YT) resolve(window.YT);
			else reject(new Error("YouTube IFrame API unavailable"));
		};
		ownedScript = document.createElement("script");
		ownedScript.src = "https://www.youtube.com/iframe_api";
		ownedScript.async = true;
		ownedScript.addEventListener("error", () => reject(new Error("Unable to load YouTube IFrame API")), { once: true });
		document.head.append(ownedScript);
	});
	return apiPromise;
};

export const createYouTubePlayer = async (host: HTMLElement, videoId: string): Promise<YouTubePlayer> => {
	const iframe = document.createElement("iframe");
	iframe.className = "rora-mv-frame";
	iframe.title = "YouTube music video player";
	iframe.allow = "autoplay; encrypted-media; picture-in-picture";
	iframe.allowFullscreen = true;
	iframe.referrerPolicy = "strict-origin-when-cross-origin";
	const channel = crypto.randomUUID();
	const bridge = new URL("./rora.tidal-mv-player.html", import.meta.url);
	bridge.searchParams.set("videoId", videoId);
	bridge.searchParams.set("channel", channel);
	iframe.src = bridge.href;
	host.replaceChildren(iframe);
	return new Promise((resolve, reject) => {
		const send = (type: string, data?: unknown) => iframe.contentWindow?.postMessage({ source: "rora-tidal-mv", channel, type, data }, "*");
		const onMessage = (event: MessageEvent) => {
			const message = event.data as { source?: string; channel?: string; type?: string; data?: unknown };
			if (event.source !== iframe.contentWindow || message?.source !== "rora-tidal-mv" || message.channel !== channel) return;
			if (message.type === "error") { window.removeEventListener("message", onMessage); reject(new Error(`YouTube player failed (${String(message.data)})`)); return; }
			if (message.type !== "ready") return;
			const qualities = Array.isArray(message.data) ? message.data.map(String) : [];
			resolve({ destroy: () => { window.removeEventListener("message", onMessage); iframe.remove(); }, playVideo: () => send("play"), pauseVideo: () => send("pause"), setVolume: (value) => send("volume", value), getAvailableQualityLevels: () => qualities, setPlaybackQuality: (value) => send("quality", value) });
		};
		window.addEventListener("message", onMessage);
	});
};

export const cleanupYouTubeApiLoader = (): void => {
	if (!window.YT?.Player) ownedScript?.remove();
	ownedScript = null;
	apiPromise = null;
};
