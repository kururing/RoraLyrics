import type { TrackMetadata, YouTubePlayer } from "./types";
import { createYouTubePlayer } from "./youtube";
import { videoQuery } from "./videoSearch";

export class VideoModal {
	private dialog: HTMLDialogElement | null = null;
	private player: YouTubePlayer | null = null;
	private listeners = new AbortController();

	constructor(private readonly onClosed: () => void) {}

	async open(track: TrackMetadata, videoId: string | null): Promise<void> {
		this.close();
		this.listeners = new AbortController();
		const dialog = document.createElement("dialog");
		dialog.className = "rora-mv-dialog";
		const header = document.createElement("div");
		header.className = "rora-mv-head";
		const title = document.createElement("strong");
		title.textContent = `${track.artist} — ${track.title}`;
		const closeButton = document.createElement("button");
		closeButton.className = "rora-mv-close";
		closeButton.type = "button";
		closeButton.ariaLabel = "Close music video";
		closeButton.textContent = "×";
		header.append(title, closeButton);
		dialog.append(header);
		this.dialog = dialog;
		const signal = this.listeners.signal;
		closeButton.addEventListener("click", () => this.close(true), { signal });
		dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.close(true); }, { signal });
		document.body.append(dialog);
		dialog.showModal();
		if (!videoId) {
			const fallback = document.createElement("div");
			fallback.className = "rora-mv-search";
			const link = document.createElement("a");
			link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(videoQuery(track))}`;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.textContent = "Open YouTube search (configure an API key for automatic playback)";
			fallback.append(link);
			dialog.append(fallback);
			return;
		}
		const host = document.createElement("div");
		host.className = "rora-mv-frame";
		dialog.append(host);
		this.player = await createYouTubePlayer(host, videoId);
		if (signal.aborted) { this.player.destroy(); this.player = null; return; }
		this.addControls(dialog, signal);
	}

	close(notify = false): void {
		const existed = Boolean(this.dialog);
		this.listeners.abort();
		this.player?.destroy();
		this.player = null;
		this.dialog?.remove();
		this.dialog = null;
		if (notify && existed) this.onClosed();
	}

	private addControls(dialog: HTMLDialogElement, signal: AbortSignal): void {
		const controls = document.createElement("div");
		controls.className = "rora-mv-controls";
		const play = document.createElement("button"); play.textContent = "Play";
		const pause = document.createElement("button"); pause.textContent = "Pause";
		const volume = document.createElement("input"); volume.type = "range"; volume.min = "0"; volume.max = "100"; volume.value = "100"; volume.ariaLabel = "YouTube volume";
		const quality = document.createElement("select"); quality.ariaLabel = "YouTube quality";
		const levels = this.player?.getAvailableQualityLevels?.() ?? [];
		for (const level of ["auto", ...levels]) { const option = document.createElement("option"); option.value = level === "auto" ? "default" : level; option.textContent = level; quality.append(option); }
		quality.disabled = !this.player?.setPlaybackQuality || levels.length === 0;
		play.addEventListener("click", () => this.player?.playVideo(), { signal });
		pause.addEventListener("click", () => this.player?.pauseVideo(), { signal });
		volume.addEventListener("input", () => this.player?.setVolume(Number(volume.value)), { signal });
		quality.addEventListener("change", () => this.player?.setPlaybackQuality?.(quality.value), { signal });
		controls.append(play, pause, volume, quality);
		dialog.append(controls);
	}
}
