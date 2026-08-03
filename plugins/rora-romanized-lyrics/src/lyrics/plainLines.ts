import type { LyricLine } from "../types/lyrics";

export const plainLines = (text: string | null): LyricLine[] =>
	(text ?? "").split(/\r?\n/).map((original, index) => ({
		id: `plain-${index}`,
		startTimeMs: index,
		original,
	}));
