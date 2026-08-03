import type { TrackAudioQuality } from "./types";

const positiveFinite = (value: number | null): value is number =>
	typeof value === "number" && Number.isFinite(value) && value > 0;

export const formatSampleRate = (
	sampleRateHz: number | null,
): string | null => {
	if (!positiveFinite(sampleRateHz)) return null;
	const khz = sampleRateHz / 1000;
	return `${Number.isInteger(khz) ? khz.toFixed(0) : khz.toFixed(1)} kHz`;
};

export const formatAudioQuality = (
	quality: TrackAudioQuality | null,
): string => {
	if (!quality) return "—";
	const sampleRate = formatSampleRate(quality.sampleRateHz);
	if (positiveFinite(quality.bitDepth) && sampleRate)
		return `${quality.bitDepth}-bit / ${sampleRate}`;
	if (quality.qualityLabel === "DOLBY_ATMOS") return "ATMOS";
	return quality.qualityLabel === "UNKNOWN" ? "—" : quality.qualityLabel;
};

export const formatCompactAudioQuality = (
	quality: TrackAudioQuality | null,
): string => {
	if (!quality) return "—";
	if (
		positiveFinite(quality.bitDepth) &&
		positiveFinite(quality.sampleRateHz)
	) {
		const khz = quality.sampleRateHz / 1000;
		return `${quality.bitDepth}/${Number.isInteger(khz) ? khz.toFixed(0) : khz.toFixed(1)}`;
	}
	return formatAudioQuality(quality);
};

const labelMap: Record<string, TrackAudioQuality["qualityLabel"]> = {
	HI_RES_LOSSLESS: "MAX",
	HI_RES: "HI_RES",
	LOSSLESS: "LOSSLESS",
	HIGH: "HIGH",
	LOW: "LOW",
};

export const fromCatalogMetadata = (
	trackId: string,
	metadata: {
		audioQuality?: string;
		audioModes?: string[];
		mediaMetadata?: { tags?: string[] };
	},
): TrackAudioQuality => {
	const tags = metadata.mediaMetadata?.tags ?? [];
	const modes = metadata.audioModes ?? [];
	const isAtmos = tags.includes("DOLBY_ATMOS") || modes.includes("DOLBY_ATMOS");
	const isHiRes = tags.includes("HIRES_LOSSLESS");
	return {
		trackId,
		bitDepth: null,
		sampleRateHz: null,
		codec: null,
		qualityLabel: isAtmos
			? "DOLBY_ATMOS"
			: isHiRes
				? "MAX"
				: (labelMap[metadata.audioQuality ?? ""] ?? "UNKNOWN"),
		isSpatial: isAtmos || modes.includes("SONY_360RA"),
		source: "track-metadata",
		isConfirmed: false,
	};
};

export const fromPlaybackContext = (context: {
	actualProductId?: string;
	actualAudioQuality?: string;
	actualAudioMode?: string;
	bitDepth?: number | null;
	sampleRate?: number | null;
	codec?: string | null;
}): TrackAudioQuality | null => {
	const trackId = String(context.actualProductId ?? "");
	if (!trackId) return null;
	const isAtmos = context.actualAudioMode === "DOLBY_ATMOS";
	const bitDepth = context.bitDepth ?? null;
	const sampleRate = context.sampleRate ?? null;
	return {
		trackId,
		bitDepth: positiveFinite(bitDepth) ? bitDepth : null,
		sampleRateHz: positiveFinite(sampleRate) ? sampleRate : null,
		codec: context.codec?.trim() || null,
		qualityLabel: isAtmos
			? "DOLBY_ATMOS"
			: (labelMap[context.actualAudioQuality ?? ""] ?? "UNKNOWN"),
		isSpatial: isAtmos || context.actualAudioMode === "SONY_360RA",
		source: "current-playback",
		isConfirmed: true,
	};
};

export const qualityAriaLabel = (quality: TrackAudioQuality | null): string => {
	if (!quality) return "Audio quality unavailable";
	const parts = [`Audio quality: ${formatAudioQuality(quality)}`];
	if (quality.codec) parts.push(quality.codec.toUpperCase());
	parts.push(quality.isConfirmed ? "current playback" : "catalog quality");
	return parts.join(", ");
};

export const qualityTooltip = (quality: TrackAudioQuality | null): string => {
	if (!quality) return "Audio quality unavailable";
	const lines = [
		`Quality: ${formatAudioQuality(quality)}`,
		`Catalog label: ${quality.qualityLabel === "DOLBY_ATMOS" ? "ATMOS" : quality.qualityLabel}`,
	];
	if (quality.codec) lines.push(`Codec: ${quality.codec.toUpperCase()}`);
	lines.push(
		`Source: ${quality.source === "current-playback" ? "Current playback" : "Catalog metadata"}`,
		`Confirmed: ${quality.isConfirmed ? "Yes" : "No"}`,
	);
	if (!quality.isConfirmed)
		lines.push("Exact bit depth and sample rate are available during playback");
	return lines.join("\n");
};
