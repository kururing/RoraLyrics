import { PlayState } from "@luna/lib";
import { capitalizeFirstLetter } from "../lyrics/displayText";
import { findActiveLine } from "../lyrics/parseLrc";
import { areLyricsEquivalent } from "../lyrics/romanize";
import { millisecondsToSeconds } from "../playback/time";
import { settings } from "../settings/settingsStore";
import type { LyricsResult } from "../types/lyrics";

const formatTime = (milliseconds: number): string => {
	const total = Math.floor(milliseconds / 1000);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export class LyricsView {
	readonly element = document.createElement("div");
	private buttons: Array<HTMLButtonElement | undefined> = [];
	private introButton: HTMLButtonElement | null = null;
	private active = -1;
	private lastManualScroll = 0;
	private automaticScrollUntil = 0;
	private scrollFrame: number | null = null;
	private holdAtTop = false;
	constructor(
		private readonly onManualScroll?: () => void,
		private readonly onSynchronized?: () => void,
	) {
		this.element.className = "rora-lyrics-host";
		const beginManualScroll = (): void => {
			this.lastManualScroll = performance.now();
			this.holdAtTop = false;
			this.onManualScroll?.();
		};
		this.element.addEventListener("wheel", beginManualScroll, {
			passive: true,
		});
		// Dragging the native scrollbar does not emit a wheel event.
		this.element.addEventListener(
			"pointerdown",
			(event) => {
				if (event.target === this.element) beginManualScroll();
			},
			{ passive: true },
		);
		this.element.addEventListener("touchstart", beginManualScroll, {
			passive: true,
		});
		this.element.addEventListener(
			"scroll",
			() => {
				if (performance.now() > this.automaticScrollUntil) beginManualScroll();
			},
			{ passive: true },
		);
	}
	status(message: string): void {
		if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
		this.scrollFrame = null;
		this.element.className = "rora-lyrics-host rora-status";
		this.element.textContent = message;
		this.buttons = [];
		this.introButton = null;
	}
	destroy(): void {
		if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
		this.scrollFrame = null;
	}
	clearActive(): void {
		if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
		this.scrollFrame = null;
		this.buttons[this.active]?.classList.remove("rora-active");
		this.active = -1;
		this.lastManualScroll = 0;
	}
	private scrollTo(index: number, behavior: ScrollBehavior): void {
		if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
		this.scrollFrame = requestAnimationFrame(() => {
			this.scrollFrame = null;
			this.automaticScrollUntil =
				performance.now() + (behavior === "smooth" ? 1200 : 150);
			const current = this.buttons[index];
			if (!current) return;
			// Tính tương đối với lyrics viewport (scroll container) đang hiển thị:
			// đầu dòng active nằm cao hơn tâm viewport một khoảng bằng chiều cao
			// thực tế của 2 dòng lyrics — tự thích ứng với Font Size / Line Spacing,
			// không hardcode theo pixel và không phụ thuộc vị trí trong danh sách.
			const container = this.element;
			const containerRect = container.getBoundingClientRect();
			const lineRect = current.getBoundingClientRect();
			const lineHeight = lineRect.height || 40;
			const offset = lineHeight * 2;
			const lineTopInViewport = lineRect.top - containerRect.top;
			const targetTop = containerRect.height / 2 - offset;
			const delta = lineTopInViewport - targetTop;
			container.scrollBy({ top: delta, behavior });
		});
	}
	updateAppearance(): void {
		this.element.style.setProperty("--rora-font", `${settings.fontSize}px`);
		this.element.style.setProperty(
			"--rora-spacing",
			String(settings.lineSpacing),
		);
		this.element.style.setProperty(
			"--rora-opacity",
			String(settings.romanizedOpacity),
		);
	}
	render(result: LyricsResult): void {
		this.element.className = "rora-lyrics-host";
		this.element.replaceChildren();
		this.buttons = [];
		this.introButton = null;
		this.active = -1;
		this.updateAppearance();
		if (!settings.showOriginal && !settings.showRomanized) {
			this.status("Enable Original or Romanized lyrics");
			return;
		}
		if (result.instrumental && result.lines.length === 0) {
			this.status("Instrumental track");
			return;
		}
		if (result.lines[0]?.startTimeMs > 500) {
			const intro = document.createElement("button");
			intro.type = "button";
			intro.className = "rora-line rora-instrumental-gap";
			intro.dataset.time = String(result.lines[0].startTimeMs);
			intro.setAttribute("aria-label", "Instrumental intro");
			const note = document.createElement("span");
			note.textContent = "♫";
			intro.appendChild(note);
			intro.addEventListener("click", () => PlayState.seek(0));
			this.introButton = intro;
			this.element.appendChild(intro);
		}
		for (const line of result.lines) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "rora-line";
			button.dataset.time = String(line.startTimeMs);
			if (settings.showTimestamp && result.syncedLyrics) {
				const timestamp = document.createElement("span");
				timestamp.className = "rora-timestamp";
				timestamp.textContent = formatTime(line.startTimeMs);
				button.appendChild(timestamp);
			}
			if (settings.showOriginal && line.original.length > 0) {
				const original = document.createElement("span");
				original.className = settings.showRomanized
					? "rora-original"
					: "rora-original rora-primary";
				original.textContent = capitalizeFirstLetter(line.original);
				button.appendChild(original);
			}
			const romanizedDuplicatesOriginal = Boolean(
				line.romanized && areLyricsEquivalent(line.original, line.romanized),
			);
			const showRomanized =
				settings.showRomanized &&
				(!settings.showOriginal || !romanizedDuplicatesOriginal) &&
				Boolean(line.romanized);
			if (showRomanized) {
				const romanized = document.createElement("span");
				romanized.className = settings.showOriginal
					? "rora-romanized"
					: "rora-romanized rora-primary";
				romanized.textContent = capitalizeFirstLetter(line.romanized ?? "");
				button.appendChild(romanized);
			}
			if (
				settings.showRomanized &&
				!settings.showOriginal &&
				!line.romanized &&
				line.original.trim()
			) {
				const unavailable = document.createElement("span");
				unavailable.className = "rora-romanized rora-primary";
				unavailable.textContent = "Romanization unavailable for this script";
				button.appendChild(unavailable);
			}
			if (line.translation?.trim()) {
				const translation = document.createElement("span");
				translation.className = "rora-translation";
				translation.textContent = capitalizeFirstLetter(line.translation);
				button.appendChild(translation);
			}
			if (!button.querySelector(".rora-original,.rora-romanized")) {
				this.buttons.push(undefined);
				continue;
			}
			button.addEventListener("click", () =>
				PlayState.seek(millisecondsToSeconds(line.startTimeMs)),
			);
			this.element.appendChild(button);
			this.buttons.push(button);
		}
		if (!this.buttons.some(Boolean)) this.status("Lyrics unavailable");
	}
	tick(result: LyricsResult, playbackPositionMs: number): void {
		if (!result.syncedLyrics) return;
		const index = findActiveLine(
			result.lines,
			playbackPositionMs,
			settings.syncOffsetMs,
		);
		const introActive =
			this.introButton !== null &&
			playbackPositionMs < result.lines[0].startTimeMs;
		if (
			index === this.active &&
			this.introButton?.classList.contains("rora-active") === introActive
		)
			return;
		if (index === this.active) return;
		this.buttons[this.active]?.classList.remove("rora-active");
		this.active = index;
		const current = this.buttons[index];
		this.introButton?.classList.toggle("rora-active", introActive);
		current?.classList.add("rora-active");
		if (this.holdAtTop) return;
		if (introActive) {
			this.introButton?.scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}
		if (current && performance.now() - this.lastManualScroll > 3500)
			this.onSynchronized?.();
		if (current && performance.now() - this.lastManualScroll > 3500)
			this.scrollTo(index, "smooth");
	}
	synchronize(
		result: LyricsResult,
		playbackPositionMs: number,
		behavior: ScrollBehavior,
	): number {
		this.lastManualScroll = 0;
		this.holdAtTop = false;
		this.onSynchronized?.();
		const index = findActiveLine(
			result.lines,
			playbackPositionMs,
			settings.syncOffsetMs,
		);
		this.buttons[this.active]?.classList.remove("rora-active");
		this.active = index;
		this.buttons[index]?.classList.add("rora-active");
		const introActive =
			this.introButton !== null &&
			result.lines[0] !== undefined &&
			playbackPositionMs < result.lines[0].startTimeMs;
		this.introButton?.classList.toggle("rora-active", introActive);
		if (index >= 0) this.scrollTo(index, behavior);
		else if (introActive)
			this.introButton?.scrollIntoView({ behavior, block: "center" });
		return index;
	}
	scrollToTop(): void {
		if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
		this.scrollFrame = null;
		this.holdAtTop = true;
		this.lastManualScroll = performance.now();
		this.automaticScrollUntil = performance.now() + 150;
		this.element.scrollTo({ top: 0, behavior: "auto" });
	}
}
