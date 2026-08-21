import {
	formatQualityDisplay,
	formatQualityLabel,
	getAudioQualityBadgeVariant,
	qualityAriaLabel,
	qualityTooltip,
} from "./quality";
import type { TrackAudioQuality } from "./types";

export const createQualityBadge = (
	quality: TrackAudioQuality | null,
	display: "label" | "details" = "details",
	displayMode: "name" | "detailed" = "detailed",
): HTMLSpanElement => {
	const badge = document.createElement("span");
	badge.className = "rora-quality-badge";
	const variant = getAudioQualityBadgeVariant(
		quality?.qualityLabel ?? "UNKNOWN",
	);
	badge.classList.add(`rora-quality-badge--${variant}`);
	badge.dataset.qualityVariant = variant;
	badge.textContent =
		display === "label"
			? quality && quality.qualityLabel !== "UNKNOWN"
				? formatQualityLabel(quality.qualityLabel)
				: "—"
			: formatQualityDisplay(quality, displayMode);
	badge.setAttribute("aria-label", qualityAriaLabel(quality));
	badge.title = qualityTooltip(quality);
	return badge;
};
