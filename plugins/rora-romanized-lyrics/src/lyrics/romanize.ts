import { convert as romanizeHangul } from "hangul-romanization";
import { pinyin } from "pinyin-pro";
import { toRomaji } from "wanakana";
import type { LyricLine } from "../types/lyrics";

export interface Romanizer {
	id: string;
	name: string;
	supports(text: string): boolean;
	romanize(text: string): RomanizationResult;
}
export interface RomanizationResult {
	text: string;
	status: "romanized" | "already-latin" | "unsupported" | "failed" | "fallback";
	remainingNonLatinScripts: string[];
	originalScript: string[];
}
const romanizers: Romanizer[] = [
	{
		id: "korean",
		name: "Revised Romanization of Korean",
		supports: (text) => /[\uac00-\ud7af]/u.test(text),
		romanize: (text) => createResult(text, romanizeHangul(text)),
	},
	{
		id: "japanese",
		name: "Wanakana Romaji",
		supports: (text) => /[\u3040-\u30ff]/u.test(text),
		romanize: (text) => createResult(text, toRomaji(text)),
	},
	{
		id: "chinese",
		name: "Pinyin Pro",
		supports: (text) => containsChineseCharacters(text) && !containsKana(text),
		romanize: (text) =>
			createResult(
				text,
				pinyin(text, {
					toneType: "symbol",
					toneSandhi: true,
					nonZh: "consecutive",
					v: false,
				}),
			),
	},
];
export const ROMANIZATION_CACHE_VERSION = 3;
const MAX_CACHE_ENTRIES = 2000;
const cache = new Map<string, string | undefined>();

const getCached = (key: string): { found: boolean; value?: string } => {
	if (!cache.has(key)) return { found: false };
	const val = cache.get(key);
	cache.delete(key);
	cache.set(key, val);
	return { found: true, value: val };
};

const setCached = (key: string, value: string | undefined): void => {
	cache.delete(key);
	cache.set(key, value);
	if (cache.size > MAX_CACHE_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
};

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

const romanizeSegment = (text: string): string => {
	const romanizer = selectRomanizer(text);
	if (!romanizer) return text;
	try {
		return romanizer.romanize(text).text;
	} catch {
		return text;
	}
};

// Romanize mixed-script lyrics one script run at a time. This keeps Chinese,
// Korean, Japanese, and unsupported/Latin text together in the same lyric line.
const romanizeMixedText = (text: string): string => {
	// A Japanese phrase may contain Han characters, so keep each non-Korean
	// Japanese segment together and let wanakana resolve its Kanji/Kana context.
	if (containsKana(text) && !/[\uac00-\ud7af]/u.test(text))
		return romanizeSegment(text);
	if (containsKana(text)) {
		return text
			.split(/([\uac00-\ud7af]+)/u)
			.map((segment) =>
				/[\uac00-\ud7af]/u.test(segment)
					? romanizeSegment(segment)
					: containsKana(segment) || containsChineseCharacters(segment)
						? romanizeSegment(segment)
						: segment,
			)
			.join("");
	}
	return text.replace(/[\uac00-\ud7af]+|\p{Script=Han}+/gu, romanizeSegment);
};

const SCRIPT_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
	["Hangul", /[\uac00-\ud7af]/u],
	["Kana", /[\u3040-\u30ff\u31f0-\u31ff]/u],
	["Han", /\p{Script=Han}/u],
	["Cyrillic", /\p{Script=Cyrillic}/u],
	["Greek", /\p{Script=Greek}/u],
	["Arabic", /\p{Script=Arabic}/u],
	["Hebrew", /\p{Script=Hebrew}/u],
	["Devanagari", /\p{Script=Devanagari}/u],
	["Thai", /\p{Script=Thai}/u],
];

const remainingNonLatinScripts = (text: string): string[] => {
	const result: string[] = [];
	for (let i = 0; i < SCRIPT_PATTERNS.length; i++) {
		const [name, pattern] = SCRIPT_PATTERNS[i];
		if (pattern.test(text)) result.push(name);
	}
	return result;
};

function createResult(source: string, candidate: string): RomanizationResult {
	const originalScript = remainingNonLatinScripts(source);
	const text = candidate;
	const remainingNonLatin = remainingNonLatinScripts(text);
	return {
		text,
		status: remainingNonLatin.length ? "unsupported" : "romanized",
		remainingNonLatinScripts: remainingNonLatin,
		originalScript,
	};
}

export function romanizeTextResult(text: string): RomanizationResult {
	const initialScripts = remainingNonLatinScripts(text);
	if (initialScripts.length === 0)
		return {
			text,
			status: "already-latin",
			remainingNonLatinScripts: [],
			originalScript: [],
		};
	try {
		const candidate = romanizeMixedText(text).trim();
		const remaining = remainingNonLatinScripts(candidate);
		if (!candidate || remaining.length > 0)
			return {
				text: candidate,
				status: "unsupported",
				remainingNonLatinScripts: remaining,
				originalScript: initialScripts,
			};
		return {
			text: candidate,
			status: "romanized",
			remainingNonLatinScripts: [],
			originalScript: initialScripts,
		};
	} catch {
		return {
			text,
			status: "failed",
			remainingNonLatinScripts: initialScripts,
			originalScript: initialScripts,
		};
	}
}

export class RomanizationEngine {
	private readonly romanizers: Romanizer[] = [];

	register(romanizer: Romanizer): void {
		this.romanizers.push(romanizer);
	}

	getSupportedScripts(text: string): string[] {
		return this.romanizers
			.filter((romanizer) => romanizer.supports(text))
			.map((romanizer) => romanizer.id);
	}

	process(text: string): RomanizationResult {
		return romanizeTextResult(text);
	}
}

export function romanizeText(text: string): string | undefined {
	const cacheKey = `v${ROMANIZATION_CACHE_VERSION}:${text}`;
	const cached = getCached(cacheKey);
	if (cached.found) return cached.value;
	let value: string | undefined;
	const result = romanizeTextResult(text);
	if (
		(result.status === "romanized" || result.status === "already-latin") &&
		result.text.normalize("NFKC").toLocaleLowerCase() !==
			text.normalize("NFKC").toLocaleLowerCase()
	)
		value = result.text;
	setCached(cacheKey, value);
	return value;
}

export const romanizeLines = (lines: readonly LyricLine[]): LyricLine[] => {
	let japaneseDocument = false;
	let hasRomanizable = false;
	for (let i = 0; i < lines.length; i++) {
		const original = lines[i].original;
		if (!japaneseDocument && containsKana(original)) {
			japaneseDocument = true;
		}
		if (!hasRomanizable && selectRomanizer(original)) {
			hasRomanizable = true;
		}
		if (japaneseDocument && hasRomanizable) break;
	}

	if (!hasRomanizable)
		return lines.map((line) => ({ ...line, romanized: line.original }));

	return lines.map((line) => {
		if (
			japaneseDocument &&
			containsChineseCharacters(line.original) &&
			!containsKana(line.original) &&
			!/[\uac00-\ud7af]/u.test(line.original)
		)
			return { ...line, romanized: undefined };
		const cacheKey = `v${ROMANIZATION_CACHE_VERSION}:mixed:${line.original}`;
		const cached = getCached(cacheKey);
		if (cached.found) return { ...line, romanized: cached.value };
		const result = romanizeTextResult(line.original);
		const romanized =
			result.status === "already-latin" ||
			(result.status === "romanized" &&
				!areLyricsEquivalent(line.original, result.text))
				? result.text
				: undefined;
		setCached(cacheKey, romanized);
		return { ...line, romanized };
	});
};
export const romanizedDisplayText = (
	original: string,
	romanized: string | undefined,
): string => romanized ?? original;

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/gu;
const SMART_QUOTE_RE = /[‘’]/gu;
const MULTI_WHITESPACE_RE = /\s+/gu;

export const normalizeComparableLyric = (text: string): string =>
	text
		.normalize("NFKC")
		.replace(ZERO_WIDTH_RE, "")
		.replace(SMART_QUOTE_RE, "'")
		.replace(MULTI_WHITESPACE_RE, " ")
		.trim()
		.toLocaleLowerCase();

export const areLyricsEquivalent = (
	original: string,
	romanized: string,
): boolean =>
	normalizeComparableLyric(original) === normalizeComparableLyric(romanized);
export const clearRomanizationCache = (): void => cache.clear();
