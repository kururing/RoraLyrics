import {
	formatAudioQuality,
	formatQualityLabel,
	getAudioQualityBadgeVariant,
	qualityAriaLabel,
	qualityTooltip,
} from "./quality";
import type { TrackAudioQuality } from "./types";

export const createQualityBadge = (
	quality: TrackAudioQuality | null,
	_display: "label" | "details" = "details",
): HTMLSpanElement => {
	const badge = document.createElement("span");
	badge.className = "rora-quality-badge";
	badge.style.display = "none";
	return badge;
};
