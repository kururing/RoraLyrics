import { convert as romanizeHangul } from "hangul-romanization";
import { pinyin } from "pinyin-pro";
import { toRomaji } from "wanakana";
import type { LyricLine } from "../types/lyrics";

export interface Romanizer {
	id: string;
	supports(text: string): boolean;
	romanize(text: string): string;
}
const romanizers: Romanizer[] = [
	{
		id: "korean",
		supports: (text) => /[\uac00-\ud7af]/u.test(text),
		romanize: romanizeHangul,
	},
	{
		id: "japanese",
		supports: (text) => /[\u3040-\u30ff]/u.test(text),
		romanize: (text) => toRomaji(text),
	},
	{
		id: "chinese",
		supports: (text) => containsChineseCharacters(text) && !containsKana(text),
		romanize: (text) =>
			pinyin(text, {
				toneType: "symbol",
				toneSandhi: true,
				nonZh: "consecutive",
				v: false,
			}),
	},
];
export const ROMANIZATION_CACHE_VERSION = 2;
const cache = new Map<string, string | undefined>();

export const containsChineseCharacters = (text: string): boolean =>
	/\p{Script=Han}/u.test(text);

export const containsKana = (text: string): boolean =>
	/[\u3040-\u30ff\u31f0-\u31ff]/u.test(text);

const selectRomanizer = (text: string): Romanizer | undefined => {
	if (/[\uac00-\ud7af]/u.test(text))
		return romanizers.find((item) => item.id === "korean");
	if (containsKana(text))
		return romanizers.find((item) => item.id === "japanese");
	if (containsChineseCharacters(text))
		return romanizers.find((item) => item.id === "chinese");
	return undefined;
};

export function romanizeText(text: string): string | undefined {
	const cacheKey = `v${ROMANIZATION_CACHE_VERSION}:${text}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);
	let value: string | undefined;
	try {
		const romanizer = selectRomanizer(text);
		if (romanizer) {
			const candidate = romanizer.romanize(text).trim();
			if (
				candidate &&
				candidate.normalize("NFKC").toLocaleLowerCase() !==
					text.normalize("NFKC").toLocaleLowerCase()
			)
				value = candidate;
		}
	} catch {
		value = undefined;
	}
	cache.set(cacheKey, value);
	return value;
}

export const romanizeLines = (lines: readonly LyricLine[]): LyricLine[] => {
	const romanizer = selectRomanizer(
		lines.map((line) => line.original).join("\n"),
	);
	if (!romanizer)
		return lines.map((line) => ({ ...line, romanized: undefined }));
	return lines.map((line) => {
		const cacheKey = `v${ROMANIZATION_CACHE_VERSION}:${romanizer.id}:${line.original}`;
		if (cache.has(cacheKey)) return { ...line, romanized: cache.get(cacheKey) };
		let romanized: string | undefined;
		try {
			const candidate = romanizer.romanize(line.original).trim();
			if (candidate && !areLyricsEquivalent(line.original, candidate))
				romanized = candidate;
		} catch {
			romanized = undefined;
		}
		cache.set(cacheKey, romanized);
		return { ...line, romanized };
	});
};
export const romanizedDisplayText = (
	original: string,
	romanized: string | undefined,
): string => romanized ?? original;

export const normalizeComparableLyric = (text: string): string =>
	text
		.normalize("NFKC")
		.replace(/[\u200B-\u200D\uFEFF]/gu, "")
		.replace(/[‘’]/gu, "'")
		.replace(/\s+/gu, " ")
		.trim()
		.toLocaleLowerCase();

export const areLyricsEquivalent = (
	original: string,
	romanized: string,
): boolean =>
	normalizeComparableLyric(original) === normalizeComparableLyric(romanized);
export const clearRomanizationCache = (): void => cache.clear();
