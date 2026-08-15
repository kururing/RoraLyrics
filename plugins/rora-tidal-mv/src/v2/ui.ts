import { createPlayer } from "./bridge";
import type {
	MvPlayState,
	MvResult,
	PlayerController,
	TrackMetadata,
} from "./types";

export type MvButtonState = "idle" | "loading" | "available" | "no-mv";

export interface MvButton {
	unmount(): void;
	setState(state: MvButtonState): void;
}

const BUTTON_STATE_TITLE: Record<MvButtonState, string> = {
	idle: "Open music video",
	loading: "Searching for music video…",
	available: "Open music video",
	"no-mv": "No music video found",
};

const VIDEO_ICON =
	'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h11a2 2 0 0 1 2 2v2l4-2v10l-4-2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>';

export const mountFooterButton = (onClick: () => void): MvButton => {
	let button: HTMLButtonElement | null = null;
	let state: MvButtonState = "idle";

	const applyState = () => {
		if (!button) return;
		button.classList.toggle("rora-mv-loading", state === "loading");
		button.classList.toggle("rora-mv-available", state === "available");
		button.classList.toggle("rora-mv-no-mv", state === "no-mv");
		button.disabled = state === "loading" || state === "no-mv";
		button.title = BUTTON_STATE_TITLE[state];
		button.ariaLabel = BUTTON_STATE_TITLE[state];
	};

	const mount = () => {
		if (button?.isConnected) return;
		const footer = document.querySelector<HTMLElement>("#footerPlayer");
		if (!footer) return;
		const quality = footer.querySelector<HTMLElement>(
			"[data-test-media-state-indicator-streaming-quality]",
		)?.parentElement;
		const controls = [
			...footer.querySelectorAll<HTMLElement>('button, [role="button"]'),
		];
		const anchor =
			controls.find((element) =>
				/volume|device|queue|mini|quality/i.test(
					`${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("data-test") ?? ""}`,
				),
			) ??
			controls.at(-1) ??
			null;
		const host = quality?.parentElement ?? anchor?.parentElement;
		if (!host) return;
		button = document.createElement("button");
		button.type = "button";
		button.dataset.roraTidalMv = "button";
		button.className = "rora-mv-button";
		button.innerHTML = VIDEO_ICON;
		button.addEventListener("click", onClick);
		if (quality?.parentElement === host) host.insertBefore(button, quality);
		else if (anchor?.parentElement === host)
			anchor.insertAdjacentElement("afterend", button);
		else host.append(button);
		applyState();
	};

	mount();
	const observer = new MutationObserver(mount);
	observer.observe(document.body, { childList: true, subtree: true });

	return {
		unmount: () => {
			observer.disconnect();
			button?.remove();
			document
				.querySelectorAll('[data-rora-tidal-mv="button"]')
				.forEach((element) => {
					element.remove();
				});
			button = null;
		},
		setState: (next: MvButtonState) => {
			state = next;
			applyState();
		},
	};
};

export class Modal {
	private dialog: HTMLDialogElement | null = null;
	private player: PlayerController | null = null;
	private events = new AbortController();
	private unsubscribes: Array<() => void> = [];
	private playButton: HTMLButtonElement | null = null;
	private muted = false;

	constructor(private readonly onClosed: () => void) {}

	async open(
		track: TrackMetadata,
		video: MvResult | null,
		quality: string,
		onPlayerError: (code: number) => void,
	): Promise<void> {
		this.close(false);
		this.events = new AbortController();
		const signal = this.events.signal;

		const dialog = document.createElement("dialog");
		dialog.className = "rora-mv-dialog";

		const header = document.createElement("div");
		header.className = "rora-mv-head";
		const title = document.createElement("strong");
		title.textContent = `${track.artist} — ${track.title}`;
		const closeButton = document.createElement("button");
		closeButton.type = "button";
		closeButton.className = "rora-mv-close";
		closeButton.ariaLabel = "Close music video";
		closeButton.textContent = "×";
		closeButton.addEventListener("click", () => this.close(true), { signal });
		header.append(title, closeButton);
		dialog.append(header);

		const body = document.createElement("div");
		body.className = "rora-mv-frame";
		dialog.append(body);

		dialog.addEventListener(
			"cancel",
			(event) => {
				event.preventDefault();
				this.close(true);
			},
			{ signal },
		);

		document.body.append(dialog);
		this.dialog = dialog;
		dialog.showModal();

		if (!video) {
			const fallback = document.createElement("div");
			fallback.className = "rora-mv-search";
			const link = document.createElement("a");
			link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${track.artist} ${track.title} official music video`)}`;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.textContent = "No matching video found — open YouTube search";
			fallback.append(link);
			dialog.append(fallback);
			return;
		}

		if (!video.isOfficial) {
			const notice = document.createElement("div");
			notice.className = "rora-mv-notice";
			notice.textContent =
				"No official music video found — showing the closest match";
			dialog.append(notice);
		}

		try {
			this.player = await createPlayer(
				body,
				video.videoId,
				{ quality },
				signal,
			);
			if (signal.aborted) {
				this.player.destroy();
				this.player = null;
				return;
			}
			this.unsubscribes.push(
				this.player.onError((code) => onPlayerError(code)),
				this.player.onState((state) => this.onStateChange(state)),
			);
			this.addControls(dialog, quality);
		} catch {
			if (!signal.aborted) body.textContent = "Unable to load the music video.";
		}
	}

	close(notify = false): void {
		const existed = Boolean(this.dialog);
		this.events.abort();
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		this.unsubscribes = [];
		this.player?.destroy();
		this.player = null;
		this.playButton = null;
		this.muted = false;
		this.dialog?.remove();
		this.dialog = null;
		if (notify && existed) this.onClosed();
	}

	private onStateChange(state: MvPlayState): void {
		if (!this.playButton) return;
		this.playButton.textContent = state === "playing" ? "Pause" : "Play";
	}

	private addControls(dialog: HTMLDialogElement, quality: string): void {
		const player = this.player;
		if (!player) return;
		const signal = this.events.signal;

		const controls = document.createElement("div");
		controls.className = "rora-mv-controls";

		const play = document.createElement("button");
		play.type = "button";
		play.textContent = "Pause";
		play.addEventListener(
			"click",
			() => {
				if (play.textContent === "Pause") player.pause();
				else player.play();
			},
			{ signal },
		);
		this.playButton = play;

		const mute = document.createElement("button");
		mute.type = "button";
		mute.textContent = "Mute";
		mute.addEventListener(
			"click",
			() => {
				this.muted = !this.muted;
				player.mute(this.muted);
				mute.textContent = this.muted ? "Unmute" : "Mute";
			},
			{ signal },
		);

		const volume = document.createElement("input");
		volume.type = "range";
		volume.min = "0";
		volume.max = "100";
		volume.value = "100";
		volume.ariaLabel = "Volume";
		volume.addEventListener(
			"input",
			() => player.volume(Number(volume.value)),
			{ signal },
		);

		const qualitySelect = document.createElement("select");
		qualitySelect.ariaLabel = "Quality";
		const options: Array<{ value: string; label: string }> = [
			{ value: "default", label: "Auto" },
		];
		for (const level of player.qualities) {
			if (options.some((option) => option.value === level)) continue;
			options.push({ value: level, label: level });
		}
		const requestedQuality = quality === "auto" ? "default" : quality;
		if (!options.some((option) => option.value === requestedQuality)) {
			options.push({ value: requestedQuality, label: requestedQuality });
		}
		for (const option of options) {
			const element = document.createElement("option");
			element.value = option.value;
			element.textContent = option.label;
			qualitySelect.append(element);
		}
		qualitySelect.value = requestedQuality;
		qualitySelect.addEventListener(
			"change",
			() => player.quality(qualitySelect.value),
			{ signal },
		);

		controls.append(play, mute, volume, qualitySelect);
		dialog.append(controls);
	}
}
