export interface PlayerController {
	play(): void; pause(): void; volume(value: number): void; quality(value: string): void; destroy(): void;
	qualities: string[];
}

export const createPlayer = (container: HTMLElement, videoId: string, signal: AbortSignal): Promise<PlayerController> => new Promise((resolve, reject) => {
	const channel = crypto.randomUUID();
	const iframe = document.createElement("iframe");
	iframe.className = "rora-mv-frame";
	iframe.allow = "autoplay; encrypted-media; picture-in-picture";
	iframe.allowFullscreen = true;
	iframe.referrerPolicy = "strict-origin-when-cross-origin";
	const url = new URL("https://kururing.github.io/RoraLyrics/rora.tidal-mv-player-v2.html");
	url.searchParams.set("videoId", videoId);
	url.searchParams.set("channel", channel);
	iframe.src = url.href;
	container.replaceChildren(iframe);
	const post = (type: string, data?: unknown) => iframe.contentWindow?.postMessage({ app: "rora-tidal-mv", channel, type, data }, "*");
	const cleanup = () => { window.removeEventListener("message", receive); iframe.remove(); };
	const receive = (event: MessageEvent) => {
		const message = event.data as { app?: string; channel?: string; type?: string; data?: unknown };
		if (event.source !== iframe.contentWindow || message?.app !== "rora-tidal-mv" || message.channel !== channel) return;
		if (message.type === "error") { cleanup(); reject(new Error(`PLAYER_${String(message.data)}`)); }
		if (message.type === "ready") resolve({ qualities: Array.isArray(message.data) ? message.data.map(String) : [], play: () => post("play"), pause: () => post("pause"), volume: (v) => post("volume", v), quality: (q) => post("quality", q), destroy: cleanup });
	};
	window.addEventListener("message", receive);
	signal.addEventListener("abort", cleanup, { once: true });
});
