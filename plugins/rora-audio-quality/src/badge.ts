import {
	formatAudioQuality,
	getAudioQualityBadgeVariant,
	qualityAriaLabel,
	qualityTooltip,
} from "./quality";
import type { TrackAudioQuality } from "./types";

export const createQualityBadge = (
	quality: TrackAudioQuality | null,
): HTMLSpanElement => {
	const badge = document.createElement("span");
	badge.className = "rora-quality-badge";
	const variant = getAudioQualityBadgeVariant(
		quality?.qualityLabel ?? "UNKNOWN",
	);
	badge.classList.add(`rora-quality-badge--${variant}`);
	badge.dataset.qualityVariant = variant;
	if (variant === "yellow") {
		badge.style.setProperty("color", "#f5c842");
		badge.style.setProperty("border-color", "#f5c842");
		badge.style.setProperty("background-color", "rgba(245, 200, 66, 0.08)");
	}
	badge.textContent = formatAudioQuality(quality);
	badge.setAttribute("aria-label", qualityAriaLabel(quality));
	badge.title = qualityTooltip(quality);
	return badge;
};
