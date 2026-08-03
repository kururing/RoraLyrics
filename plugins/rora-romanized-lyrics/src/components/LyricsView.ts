import { PlayState } from "@luna/lib";
import { capitalizeFirstLetter } from "../lyrics/displayText";
import { findActiveLine } from "../lyrics/parseLrc";
import { areLyricsEquivalent, romanizedDisplayText } from "../lyrics/romanize";
import { millisecondsToSeconds } from "../playback/time";
import { settings } from "../settings/settingsStore";
import type { LyricsResult } from "../types/lyrics";

const formatTime = (milliseconds: number): string => {
	const total = Math.floor(milliseconds / 1000);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const reportSyncNeeded = (needed: boolean): void => {
	window.dispatchEvent(
		new CustomEvent("rora-sync-needed", { detail: { needed } }),
	);
};

export class LyricsView {
	readonly element = document.createElement("div");
	private buttons: Array<HTMLButtonElement | undefined> = [];
	private active = -1;
	private lastManualScroll = 0;
	private automaticScrollUntil = 0;
	private scrollFrame: number | null = null;
	constructor() {
		this.element.className = "rora-lyrics-host";
		const beginManualScroll = (): void => {
			this.lastManualScroll = performance.now();
			reportSyncNeeded(true);
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
		reportSyncNeeded(false);
	}
	private scrollTo(index: number, behavior: ScrollBehavior): void {
		if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
		this.scrollFrame = requestAnimationFrame(() => {
			this.scrollFrame = null;
			this.automaticScrollUntil =
				performance.now() + (behavior === "smooth" ? 1200 : 150);
			this.buttons[index]?.scrollIntoView({ behavior, block: "center" });
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
		this.active = -1;
		this.updateAppearance();
		if (settings.showSourceBadge) {
			const badge = document.createElement("span");
			badge.className = "rora-source";
			badge.textContent = result.source.toUpperCase();
			this.element.appendChild(badge);
		}
		if (!settings.showOriginal && !settings.showRomanized) {
			this.status("Enable Original or Romanized lyrics");
			return;
		}
		if (result.instrumental && result.lines.length === 0) {
			this.status("Instrumental track");
			return;
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
			const romanizedText = romanizedDisplayText(line.original, line.romanized);
			const romanizedDuplicatesOriginal = Boolean(
				line.romanized && areLyricsEquivalent(line.original, line.romanized),
			);
			const showRomanized =
				settings.showRomanized &&
				(!settings.showOriginal || !romanizedDuplicatesOriginal) &&
				(Boolean(line.romanized) || !settings.showOriginal);
			if (showRomanized) {
				const romanized = document.createElement("span");
				romanized.className = settings.showOriginal
					? "rora-romanized"
					: "rora-romanized rora-primary";
				// Latin-script lines do not need romanization, but must remain visible
				// when the Romanized layer is the only enabled layer.
				romanized.textContent = capitalizeFirstLetter(romanizedText);
				button.appendChild(romanized);
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
		if (index === this.active) return;
		this.buttons[this.active]?.classList.remove("rora-active");
		this.active = index;
		const current = this.buttons[index];
		current?.classList.add("rora-active");
		if (current && performance.now() - this.lastManualScroll > 3500)
			this.scrollTo(index, "smooth");
	}
	synchronize(
		result: LyricsResult,
		playbackPositionMs: number,
		behavior: ScrollBehavior,
	): number {
		this.lastManualScroll = 0;
		reportSyncNeeded(false);
		const index = findActiveLine(
			result.lines,
			playbackPositionMs,
			settings.syncOffsetMs,
		);
		this.buttons[this.active]?.classList.remove("rora-active");
		this.active = index;
		this.buttons[index]?.classList.add("rora-active");
		if (index >= 0) this.scrollTo(index, behavior);
		return index;
	}
}
