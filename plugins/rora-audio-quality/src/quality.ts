import type { AudioQualityLabel, TrackAudioQuality } from "./types";

export type AudioQualityBadgeVariant = "neutral" | "yellow";

export const getAudioQualityBadgeVariant = (
	qualityLabel: AudioQualityLabel,
): AudioQualityBadgeVariant => {
	switch (qualityLabel) {
		case "HI_RES":
		case "MAX":
			return "yellow";
		default:
			return "neutral";
	}
};

export const formatQualityLabel = (label: AudioQualityLabel): string =>
	label === "HI_RES" ? "HI-RES" : label;

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
	return quality.qualityLabel === "UNKNOWN"
		? "—"
		: formatQualityLabel(quality.qualityLabel);
};

export type QualityDisplayMode = "name" | "detailed";
export type QualityCategory =
	| "radio"
	| "cd"
	| "dvd"
	| "studio"
	| "hi-res"
	| "ultra-hi-res";

export const getQualityCategory = (
	quality: TrackAudioQuality | null,
): QualityCategory | null => {
	if (
		!quality ||
		!positiveFinite(quality.bitDepth) ||
		!positiveFinite(quality.sampleRateHz)
	)
		return null;
	const { bitDepth, sampleRateHz } = quality;
	if (bitDepth === 16 && sampleRateHz === 32000) return "radio";
	if (bitDepth === 16 && sampleRateHz === 44100) return "cd";
	if (bitDepth === 16 && sampleRateHz === 48000) return "dvd";
	if (bitDepth === 24 && (sampleRateHz === 44100 || sampleRateHz === 48000))
		return "studio";
	if (bitDepth === 24 && (sampleRateHz === 88200 || sampleRateHz === 96000))
		return "hi-res";
	if (bitDepth === 24 && sampleRateHz >= 176400) return "ultra-hi-res";
	return null;
};

export const formatQualityName = (
	quality: TrackAudioQuality | null,
): string => {
	switch (getQualityCategory(quality)) {
		case "radio": return "Radio Quality";
		case "cd": return "CD Quality";
		case "dvd": return "DVD Quality";
		case "studio": return "Studio Quality";
		case "hi-res": return "Hi-Res";
		case "ultra-hi-res": return "Ultra-Hi-Res";
		default: return formatAudioQuality(quality);
	}
};

export const formatQualityDisplay = (
	quality: TrackAudioQuality | null,
	mode: QualityDisplayMode,
): string => mode === "name" ? formatQualityName(quality) : formatAudioQuality(quality);

const labelMap: Record<string, TrackAudioQuality["qualityLabel"]> = {
	HI_RES_LOSSLESS: "HI_RES",
	HI_RES: "HI_RES",
	MAX: "MAX",
	MASTER: "MAX",
	LOSSLESS: "LOSSLESS",
	HIGH: "HIGH",
	LOW: "LOW",
};

export const fromPlaybackContext = (context: {
	actualProductId?: string;
	actualAudioQuality?: string;
	bitDepth?: number | null;
	sampleRate?: number | null;
	codec?: string | null;
}): TrackAudioQuality | null => {
	const trackId = String(context.actualProductId ?? "");
	if (!trackId) return null;
	const bitDepth = context.bitDepth ?? null;
	const sampleRate = context.sampleRate ?? null;
	return {
		trackId,
		bitDepth: positiveFinite(bitDepth) ? bitDepth : null,
		sampleRateHz: positiveFinite(sampleRate) ? sampleRate : null,
		codec: context.codec?.trim() || null,
		qualityLabel: labelMap[context.actualAudioQuality ?? ""] ?? "UNKNOWN",
		isSpatial: false,
		source: "current-playback",
		isConfirmed: true,
	};
};

export const fromPlaybackInfo = (
	trackId: string,
	info: {
		audioQuality?: string;
		bitDepth?: number | null;
		sampleRate?: number | null;
		mimeType?: string | null;
		manifest?: { codecs?: string | null };
	},
): TrackAudioQuality => {
	const bitDepth = info.bitDepth ?? null;
	const sampleRate = info.sampleRate ?? null;
	return {
		trackId,
		bitDepth: positiveFinite(bitDepth) ? bitDepth : null,
		sampleRateHz: positiveFinite(sampleRate) ? sampleRate : null,
		codec: info.manifest?.codecs?.trim() || info.mimeType?.split("/").pop() || null,
		qualityLabel: labelMap[info.audioQuality ?? ""] ?? "UNKNOWN",
		isSpatial: false,
		source: "playback-manifest",
		isConfirmed: true,
	};
};

export const fromCatalogMetadata = (
	trackId: string,
	metadata: {
		audioQuality?: string;
		mediaMetadata?: { tags?: string[] };
	},
): TrackAudioQuality => {
	const tags = metadata.mediaMetadata?.tags ?? [];
	const isHiRes = tags.includes("HIRES_LOSSLESS");
	return {
		trackId,
		bitDepth: null,
		sampleRateHz: null,
		codec: null,
		qualityLabel: isHiRes
			? "HI_RES"
			: (labelMap[metadata.audioQuality ?? ""] ?? "UNKNOWN"),
		isSpatial: false,
		source: "track-metadata",
		isConfirmed: false,
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
	if (!quality) return "Quality unavailable";
	const lines = [`Quality: ${formatQualityLabel(quality.qualityLabel)}`];
	if (positiveFinite(quality.bitDepth)) lines.push(`Bit Depth: ${quality.bitDepth}-bit`);
	if (formatSampleRate(quality.sampleRateHz)) lines.push(`Sample Rate: ${formatSampleRate(quality.sampleRateHz)}`);
	return lines.join("\n");
};
