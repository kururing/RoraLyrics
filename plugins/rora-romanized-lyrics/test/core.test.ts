import assert from "node:assert/strict";
import test from "node:test";
import { capitalizeFirstLetter } from "../src/lyrics/displayText";
import { findActiveLine, parseLrc } from "../src/lyrics/parseLrc";
import {
	areLyricsEquivalent,
	containsChineseCharacters,
	containsKana,
	normalizeComparableLyric,
	ROMANIZATION_CACHE_VERSION,
	romanizedDisplayText,
	romanizeLines,
	romanizeText,
} from "../src/lyrics/romanize";
import {
	calculateLivePlaybackPositionMs,
	millisecondsToSeconds,
	secondsToMilliseconds,
} from "../src/playback/time";
import {
	clamp,
	normalizeNumericValue,
	roundToPrecision,
} from "../src/settings/numeric";

test("parses zero, tenths, hundredths and thousandths", () => {
	const lines = parseLrc(
		"[00:12]Zero\n[00:12.3]One\n[00:12.34]Two\n[01:05.120]Three",
	);
	assert.deepEqual(
		lines.map((line) => line.startTimeMs),
		[12000, 12300, 12340, 65120],
	);
});
test("parses multiple timestamps and multi-digit minutes", () => {
	const lines = parseLrc("[100:00.00][00:02.00]Repeat");
	assert.deepEqual(
		lines.map((line) => line.startTimeMs),
		[2000, 6000000],
	);
});
test("ignores metadata, applies offset, and survives malformed tags", () => {
	const lines = parseLrc(
		"[ar:Artist]\n[offset:-100]\n[bad]No\n[00:01.00]\n[00:99.00]Bad",
	);
	assert.equal(lines.length, 1);
	assert.equal(lines[0].startTimeMs, 900);
	assert.equal(lines[0].original, "");
});
test("binary search selects current line", () => {
	const lines = parseLrc("[00:01.00]A\n[00:03.00]B\n[00:05.00]C");
	assert.equal(findActiveLine(lines, 4999), 1);
	assert.equal(findActiveLine(lines, 5000), 2);
	assert.equal(findActiveLine(lines, 500), -1);
});
test("binary search handles boundaries, offsets, empty data, and NaN", () => {
	const lines = parseLrc("[00:01.00]A\n[00:03.00]B");
	assert.equal(findActiveLine(lines, 999), -1);
	assert.equal(findActiveLine(lines, 1000), 0);
	assert.equal(findActiveLine(lines, 2999), 0);
	assert.equal(findActiveLine(lines, 3000), 1);
	assert.equal(findActiveLine(lines, 999, 1), 0);
	assert.equal(findActiveLine(lines, 1000, -1), -1);
	assert.equal(findActiveLine([], 1000), -1);
	assert.equal(findActiveLine(lines, Number.NaN), -1);
});
test("capitalizes the first Unicode letter of every displayed lyric line", () => {
	assert.equal(
		capitalizeFirstLetter("machimnae ppaenael"),
		"Machimnae ppaenael",
	);
	assert.equal(capitalizeFirstLetter("  (hello again)"), "  (Hello again)");
	assert.equal(capitalizeFirstLetter("\u01cei ni"), "\u01cdi ni");
	assert.equal(
		capitalizeFirstLetter("\uc0ac\ub791\ud574"),
		"\uc0ac\ub791\ud574",
	);
});
test("romanization is local, falls back safely, and suppresses identical Latin", () => {
	assert.match(romanizeText("\uC0AC\uB791\uD574") ?? "", /sarang/i);
	assert.equal(romanizeText("Hello"), undefined);
	assert.doesNotThrow(() => romanizeText("\u0000"));
});
test("Chinese Romanizer preserves Pinyin tone marks and uses a versioned cache", () => {
	const hello = romanizeText("\u4F60\u597D") ?? "";
	const love = romanizeText("\u6211\u7231\u4F60") ?? "";
	assert.match(hello, /n\u01D0\s+h\u01CEo/u);
	assert.match(love, /w\u01D2\s+\u00E0i\s+n\u01D0/u);
	assert.doesNotMatch(hello, /\d/u);
	assert.notEqual(hello, "ni hao");
	assert.equal(ROMANIZATION_CACHE_VERSION, 2);
	assert.equal(romanizeText("\u4F60\u597D"), hello);
});
test("script selection prefers Kana over Chinese for a Japanese lyrics document", () => {
	assert(containsChineseCharacters("\u611B"));
	assert(containsKana("\u611B\u3057\u3066\u308B"));
	const lines = romanizeLines([
		{ id: "1", startTimeMs: 0, original: "\u611B\u3057\u3066\u308B" },
		{ id: "2", startTimeMs: 1000, original: "\u611B" },
	]);
	assert.match(lines[0].romanized ?? "", /shiteru/i);
	assert.equal(lines[1].romanized, undefined);
});
test("Chinese display Pinyin is not deduplicated with Hanzi or stripped to ASCII", () => {
	const displayed = romanizeText("\u5973\u7EFF") ?? "";
	assert(/[nl][\u01D6\u01D8\u01DA\u01DC]/u.test(displayed));
	assert.equal(areLyricsEquivalent("\u5973\u7EFF", displayed), false);
});
test("romanized-only display keeps Latin lines that need no conversion", () => {
	assert.equal(romanizedDisplayText("I'm sorry", undefined), "I'm sorry");
	assert.equal(
		romanizedDisplayText("\uC0AC\uB791\uD574", "saranghae"),
		"saranghae",
	);
});
test("equivalent Original and Romanized text is normalized conservatively", () => {
	assert(areLyricsEquivalent("I  love you ", "i love you"));
	assert(areLyricsEquivalent("Don\u2019t go", "Don't go"));
	assert.equal(normalizeComparableLyric("\u200BHello"), "hello");
	assert.equal(
		areLyricsEquivalent("\uB108\uB97C \uC0AC\uB791\uD574", "Neoreul saranghae"),
		false,
	);
	assert.equal(areLyricsEquivalent("I love you", "I really love you"), false);
	assert.equal(areLyricsEquivalent("Yeah", "Ye"), false);
});
test("duplicate timestamps select the last line at that boundary", () => {
	const lines = parseLrc("[00:01.00]A\n[00:01.00]B\n[00:02.00]C");
	assert.equal(findActiveLine(lines, 1000), 1);
});
test("numeric helpers clamp, preserve decimals, reject NaN, and round steps", () => {
	assert.equal(clamp(70, 12, 64), 64);
	assert.equal(normalizeNumericValue(-1, 0, 1, 2), 0);
	assert.equal(normalizeNumericValue(Number.NaN, 0, 1, 2), null);
	assert.equal(roundToPrecision(1.2 + 0.1, 1), 1.3);
	assert.equal(roundToPrecision(0.7 + 0.05, 2), 0.75);
});
test("time conversion happens once at API boundaries", () => {
	assert.equal(secondsToMilliseconds(12.345), 12345);
	assert.equal(millisecondsToSeconds(12345), 12.345);
});
test("live playback position advances from TIDAL's synchronization timestamp", () => {
	assert.equal(
		calculateLivePlaybackPositionMs(
			{
				currentTimeSeconds: 60,
				currentTimeSyncTimestampMs: 100_000,
				isPlaying: true,
				durationSeconds: 180,
			},
			130_000,
		),
		90_000,
	);
});
test("re-entering lyrics reads a fresh position instead of a captured mount value", () => {
	let snapshot = {
		currentTimeSeconds: 60,
		currentTimeSyncTimestampMs: 100_000,
		isPlaying: false,
		durationSeconds: 180,
	};
	const readPosition = () => calculateLivePlaybackPositionMs(snapshot, 130_000);
	assert.equal(readPosition(), 60_000);
	snapshot = {
		...snapshot,
		currentTimeSeconds: 90,
		currentTimeSyncTimestampMs: 130_000,
	};
	assert.equal(readPosition(), 90_000);
});
test("paused and seeked playback stays exact and duration is clamped", () => {
	assert.equal(
		calculateLivePlaybackPositionMs(
			{
				currentTimeSeconds: 90,
				currentTimeSyncTimestampMs: 100_000,
				isPlaying: false,
				durationSeconds: 180,
			},
			150_000,
		),
		90_000,
	);
	assert.equal(
		calculateLivePlaybackPositionMs(
			{
				currentTimeSeconds: 120,
				currentTimeSyncTimestampMs: 150_000,
				isPlaying: false,
				durationSeconds: 180,
			},
			150_000,
		),
		120_000,
	);
	assert.equal(
		calculateLivePlaybackPositionMs(
			{
				currentTimeSeconds: 179,
				currentTimeSyncTimestampMs: 100_000,
				isPlaying: true,
				durationSeconds: 180,
			},
			120_000,
		),
		180_000,
	);
});
