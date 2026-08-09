import assert from "node:assert/strict";
import test from "node:test";
import { QualityCache, RequestPool } from "../src/cache";
import {
	formatAudioQuality,
	formatQualityLabel,
	formatSampleRate,
	fromCatalogMetadata,
	fromPlaybackContext,
	fromPlaybackInfo,
	getAudioQualityBadgeVariant,
	qualityTooltip,
} from "../src/quality";
import type { TrackAudioQuality } from "../src/types";
import { shouldProcessTrackRow } from "../src/trackListIntegration";

const quality = (
	overrides: Partial<TrackAudioQuality> = {},
): TrackAudioQuality => ({
	trackId: "a",
	bitDepth: null,
	sampleRateHz: null,
	codec: null,
	qualityLabel: "UNKNOWN",
	isSpatial: false,
	source: "unknown",
	isConfirmed: false,
	...overrides,
});

test("formats all standard sample rates without losing decimals", () => {
	assert.equal(formatSampleRate(44100), "44.1 kHz");
	assert.equal(formatSampleRate(48000), "48 kHz");
	assert.equal(formatSampleRate(88200), "88.2 kHz");
	assert.equal(formatSampleRate(96000), "96 kHz");
	assert.equal(formatSampleRate(176400), "176.4 kHz");
	assert.equal(formatSampleRate(192000), "192 kHz");
});

test("formats confirmed bit depth and sample rate", () => {
	assert.equal(
		formatAudioQuality(quality({ bitDepth: 24, sampleRateHz: 96000 })),
		"24-bit / 96 kHz",
	);
	assert.equal(
		formatAudioQuality(quality({ bitDepth: 16, sampleRateHz: 44100 })),
		"16-bit / 44.1 kHz",
	);
});

test("missing values fall back to honest labels and unknown dash", () => {
	assert.equal(
		formatAudioQuality(quality({ bitDepth: 24, qualityLabel: "HI_RES" })),
		"HI-RES",
	);
	assert.equal(
		formatAudioQuality(
			quality({ sampleRateHz: 96000, qualityLabel: "LOSSLESS" }),
		),
		"LOSSLESS",
	);
	assert.equal(formatAudioQuality(quality()), "—");
	assert.equal(
		formatAudioQuality(
			quality({ bitDepth: Number.NaN, sampleRateHz: Number.NaN }),
		),
		"—",
	);
});

test("HI-RES catalog label never implies bit depth or sample rate", () => {
	assert.equal(
		formatAudioQuality(quality({ qualityLabel: "HI_RES" })),
		"HI-RES",
	);
	assert.equal(formatQualityLabel("HI_RES"), "HI-RES");
});

test("only HI_RES and MAX use the yellow badge variant", () => {
	assert.equal(getAudioQualityBadgeVariant("LOW"), "neutral");
	assert.equal(getAudioQualityBadgeVariant("HIGH"), "neutral");
	assert.equal(getAudioQualityBadgeVariant("LOSSLESS"), "neutral");
	assert.equal(getAudioQualityBadgeVariant("UNKNOWN"), "neutral");
	assert.equal(getAudioQualityBadgeVariant("HI_RES"), "yellow");
	assert.equal(getAudioQualityBadgeVariant("MAX"), "yellow");
	assert.doesNotMatch(getAudioQualityBadgeVariant("LOSSLESS"), /purple/);
	assert.doesNotMatch(getAudioQualityBadgeVariant("HIGH"), /blue/);
	assert.doesNotMatch(getAudioQualityBadgeVariant("LOW"), /green/);
});

test("playback quality uses only confirmed playback metadata", () => {
	const playback = fromPlaybackContext({
		actualProductId: "a",
		actualAudioQuality: "LOSSLESS",
		bitDepth: 16,
		sampleRate: 44100,
		codec: "flac",
	});
	assert.equal(playback?.source, "current-playback");
	assert.equal(playback?.isConfirmed, true);
	assert.equal(formatAudioQuality(playback), "16-bit / 44.1 kHz");
});

test("playback info exposes exact quality before playback starts", () => {
	const resolved = fromPlaybackInfo("a", {
		audioQuality: "HI_RES_LOSSLESS",
		bitDepth: 24,
		sampleRate: 96000,
		mimeType: "audio/flac",
		manifest: { codecs: "flac" },
	});
	assert.equal(resolved.source, "playback-manifest");
	assert.equal(resolved.isConfirmed, true);
	assert.equal(formatAudioQuality(resolved), "24-bit / 96 kHz");
});

test("virtualized rows process every lazy batch and recycle by track ID", () => {
	const trackIds = Array.from({ length: 200 }, (_, index) => String(index + 1));
	const processed = trackIds.filter((trackId) =>
		shouldProcessTrackRow(undefined, trackId, false),
	);
	assert.equal(processed.length, 200);
	assert(processed.includes("51"));
	assert(processed.includes("100"));
	assert(processed.includes("200"));
	assert.equal(shouldProcessTrackRow("a", "a", true), false);
	assert.equal(shouldProcessTrackRow("a", "b", true), true);
	assert.equal(shouldProcessTrackRow("a", "a", false), true);
});

test("settings expose only the two user-facing controls", async () => {
	const { readFile } = await import("node:fs/promises");
	const settingsSource = await readFile(
		new URL("../src/settings.ts", import.meta.url),
		"utf8",
	);
	const pageSource = await readFile(
		new URL("../src/SettingsPage.tsx", import.meta.url),
		"utf8",
	);
	assert.deepEqual(
		[
			...settingsSource.matchAll(
				/^\s*(enableTrackList|enableNowPlaying): boolean;/gm,
			),
		].map((match) => match[1]),
		["enableTrackList", "enableNowPlaying"],
	);
	assert.equal((pageSource.match(/<Switch\s/g) ?? []).length, 2);
	assert.doesNotMatch(
		`${settingsSource}\n${pageSource}`,
		/displayMode|showCodec|showTooltip|unknownDisplay|debugLogging|Debug logging/,
	);
});

test("track-list integration is scoped, batched, and track-ID keyed", async () => {
	const source = await import("node:fs/promises").then(({ readFile }) =>
		readFile(
			new URL("../src/trackListIntegration.ts", import.meta.url),
			"utf8",
		),
	);
	assert.match(source, /observer\.observe\(trackList/);
	assert.match(source, /queueMicrotask/);
	assert.match(source, /roraQualityTrackId/);
	assert.match(source, /media-list-item/);
	assert.match(source, /refreshTrack/);
	assert.doesNotMatch(source, /document\.body|setInterval|\b50\b/);
});

test("yellow badge CSS uses a stable yellow value and stronger class specificity", async () => {
	const css = await import("node:fs/promises").then(({ readFile }) =>
		readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
	);
	assert.match(css, /--rora-quality-yellow-text:\s*#f5c842/);
	assert.match(css, /\.rora-quality-badge\.rora-quality-badge--yellow\s*\{/);
	assert.doesNotMatch(css, /wave-color-solid-accent-fill/);
});

test("badge component applies the yellow variant inline only after typed mapping", async () => {
	const source = await import("node:fs/promises").then(({ readFile }) =>
		readFile(new URL("../src/badge.ts", import.meta.url), "utf8"),
	);
	assert.match(source, /getAudioQualityBadgeVariant/);
	assert.match(source, /variant === "yellow"/);
	assert.match(source, /setProperty\("color", "#f5c842"\)/);
	assert.doesNotMatch(source, /textContent\s*===\s*["']HI_RES/);
	assert.match(source, /display === "label"/);
});

test("catalog source remains unconfirmed until playback", () => {
	const catalog = fromCatalogMetadata("a", { audioQuality: "HI_RES_LOSSLESS" });
	assert.equal(catalog.source, "track-metadata");
	assert.equal(catalog.qualityLabel, "HI_RES");
	assert.equal(catalog.isConfirmed, false);
	assert.equal(catalog.bitDepth, null);
});

test("cache keys quality strictly by track ID", () => {
	const cache = new QualityCache(10, 1000);
	cache.set(quality({ trackId: "a", qualityLabel: "HIGH" }), 10);
	assert.equal(cache.get("a", 11)?.qualityLabel, "HIGH");
	assert.equal(cache.get("b", 11), null);
	assert.equal(cache.get("a", 1011), null);
});

test("request pool deduplicates keys and enforces concurrency", async () => {
	const pool = new RequestPool<number>(2);
	let calls = 0;
	let active = 0;
	let peak = 0;
	const task = (value: number) => async () => {
		calls++;
		active++;
		peak = Math.max(peak, active);
		await new Promise((resolve) => setTimeout(resolve, 5));
		active--;
		return value;
	};
	const a = pool.run("a", task(1));
	const duplicate = pool.run("a", task(9));
	const results = await Promise.all([
		a,
		duplicate,
		pool.run("b", task(2)),
		pool.run("c", task(3)),
	]);
	assert.deepEqual(results, [1, 1, 2, 3]);
	assert.equal(calls, 3);
	assert.ok(peak <= 2);
});

test("request pool rejects queued work during plugin cleanup", async () => {
	const pool = new RequestPool<number>(1);
	let release: (() => void) | undefined;
	const active = pool.run(
		"active",
		() =>
			new Promise<number>((resolve) => {
				release = () => resolve(1);
			}),
	);
	const queued = pool.run("queued", async () => 2);
	pool.dispose();
	await assert.rejects(queued, /disposed/);
	release?.();
	assert.equal(await active, 1);
	await assert.rejects(
		pool.run("late", async () => 3),
		/disposed/,
	);
});

test("tooltip contains only quality, bit depth, and sample rate", () => {
	const catalog = quality({ qualityLabel: "HIGH", source: "track-metadata" });
	assert.equal(
		qualityTooltip(catalog),
		"Quality: HIGH",
	);
	assert.equal(
		qualityTooltip(
			quality({ bitDepth: 24, sampleRateHz: 96000, qualityLabel: "HI_RES" }),
		),
		"Quality: HI-RES\nBit Depth: 24-bit\nSample Rate: 96 kHz",
	);
	assert.doesNotMatch(
		qualityTooltip(catalog),
		/Codec|Source|Confirmed|Catalog/,
	);
});

test("source contains no playback write calls", async () => {
	const source = await import("node:fs/promises").then(({ readFile }) =>
		readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
	);
	assert.doesNotMatch(source, /\.(?:play|pause|seek|togglePlayback)\s*\(/);
	assert.doesNotMatch(source, /updateFormat\s*\(/);
});
