import type { LyricLine } from "../types/lyrics";

const METADATA = /^(ar|al|ti|by|re|ve|length):/i;
const TIMESTAMP = /\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(input: string): LyricLine[] {
	let offset = 0;
	const offsetMatch = input.match(/\[offset:([+-]?\d+)\]/i);
	if (offsetMatch) offset = Number(offsetMatch[1]) || 0;
	const parsed: Array<{
		startTimeMs: number;
		original: string;
		order: number;
	}> = [];
	let order = 0;
	for (const raw of input.replace(/\r/g, "").split("\n")) {
		TIMESTAMP.lastIndex = 0;
		const tags = [...raw.matchAll(TIMESTAMP)];
		if (tags.length === 0) continue;
		const text = raw.replace(TIMESTAMP, "");
		if (METADATA.test(text.trim())) continue;
		for (const tag of tags) {
			const minutes = Number(tag[1]);
			const seconds = Number(tag[2]);
			if (!Number.isFinite(minutes) || seconds >= 60) continue;
			const fraction = tag[3]
				? Number(tag[3]) *
					(tag[3].length === 1 ? 100 : tag[3].length === 2 ? 10 : 1)
				: 0;
			parsed.push({
				startTimeMs: Math.max(
					0,
					minutes * 60_000 + seconds * 1_000 + fraction + offset,
				),
				original: text,
				order: order++,
			});
		}
	}
	parsed.sort((a, b) => a.startTimeMs - b.startTimeMs || a.order - b.order);
	return parsed.map((line, index) => ({
		id: `${line.startTimeMs}-${index}`,
		startTimeMs: line.startTimeMs,
		endTimeMs: parsed[index + 1]?.startTimeMs,
		original: line.original,
	}));
}

export function findActiveLine(
	lines: readonly LyricLine[],
	positionMs: number,
	offsetMs = 0,
): number {
	if (!Number.isFinite(positionMs) || !Number.isFinite(offsetMs)) return -1;
	const effectivePositionMs = positionMs + offsetMs;
	let low = 0;
	let high = lines.length - 1;
	let result = -1;
	while (low <= high) {
		const middle = (low + high) >>> 1;
		if (lines[middle].startTimeMs <= effectivePositionMs) {
			result = middle;
			low = middle + 1;
		} else high = middle - 1;
	}
	return result;
}
