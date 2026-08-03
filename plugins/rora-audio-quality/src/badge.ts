import {
	formatAudioQuality,
	formatCompactAudioQuality,
	getAudioQualityBadgeVariant,
	qualityAriaLabel,
	qualityTooltip,
} from "./quality";
import { settings } from "./settings";
import type { TrackAudioQuality } from "./types";

export const createQualityBadge = (
	quality: TrackAudioQuality | null,
	compact = false,
): HTMLSpanElement => {
	const badge = document.createElement("span");
	badge.className = "rora-quality-badge";
	const variant = getAudioQualityBadgeVariant(
		quality?.qualityLabel ?? "UNKNOWN",
	);
	badge.classList.add(`rora-quality-badge--${variant}`);
	const unknown = !quality || quality.qualityLabel === "UNKNOWN";
	if (unknown && settings.unknownDisplay === "hide") badge.hidden = true;
	const catalogOnly = settings.displayMode === "catalog";
	const value =
		catalogOnly && quality
			? quality.qualityLabel === "DOLBY_ATMOS"
				? "ATMOS"
				: quality.qualityLabel === "UNKNOWN"
					? "—"
					: quality.qualityLabel
			: compact || settings.displayMode === "compact"
				? formatCompactAudioQuality(quality)
				: formatAudioQuality(quality);
	badge.textContent = `${value}${settings.showCodec && quality?.codec ? ` · ${quality.codec.toUpperCase()}` : ""}`;
	badge.setAttribute("aria-label", qualityAriaLabel(quality));
	if (settings.showTooltip) badge.title = qualityTooltip(quality);
	return badge;
};
