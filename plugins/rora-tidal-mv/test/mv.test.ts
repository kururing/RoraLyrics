import assert from "node:assert/strict";
import test from "node:test";
import {
	extractCleanTitle,
	findTidalVideoWithFetcher,
	getStoreCountryCode,
	getStoreLocale,
	normalizeText,
	pickBestVideo,
	playTidalVideoWithDeps,
	scoreVideoMatch,
	toTidalVideoResult,
} from "../src/v2/tidalVideoLookup";

test("pickBestVideo prefers a video whose title matches the track title", () => {
	const track = { trackId: "1", title: "Atomised", artist: "GoGo Penguin" };
	const matching = {
		id: 100,
		title: "GoGo Penguin - Atomised (Official Video)",
	};
	const other = { id: 200, title: "GoGo Penguin - Hopopono (Official Video)" };
	const result = pickBestVideo(track, [other, matching]);
	assert.equal(result?.id, 100);
});

test("pickBestVideo strips parentheticals and version suffixes before matching", () => {
	const track = { trackId: "1", title: "Flow", artist: "Artist" };
	const exact = { id: 1, title: "Artist - Flow" };
	const tagged = { id: 2, title: "Artist - Flow (Live in Tokyo)" };
	const unrelated = { id: 3, title: "Artist - Other Song" };
	const result = pickBestVideo(track, [unrelated, exact, tagged]);
	assert.equal(result?.id, 1);
});

test("pickBestVideo rejects unrelated videos and returns null instead of falling back", () => {
	const track = { trackId: "1", title: "No Match Title", artist: "Artist" };
	const first = { id: 1, title: "Artist - Something Else" };
	const second = { id: 2, title: "Artist - Another" };
	const result = pickBestVideo(track, [first, second]);
	assert.equal(
		result,
		null,
		"Should return null when no video matches title or artist",
	);
});

test("pickBestVideo considers artist and prefers candidate by matching artist", () => {
	const track = { trackId: "1", title: "Hello", artist: "Adele" };
	const wrongArtist = {
		id: 1,
		title: "Hello",
		artist: { name: "Lionel Richie" },
	};
	const rightArtist = {
		id: 2,
		title: "Adele - Hello (Official Music Video)",
		artist: { name: "Adele" },
	};
	const result = pickBestVideo(track, [wrongArtist, rightArtist]);
	assert.equal(result?.id, 2);
});

test("pickBestVideo prefers official music video over live or behind-the-scenes", () => {
	const track = { trackId: "1", title: "Starboy", artist: "The Weeknd" };
	const bts = {
		id: 1,
		title: "The Weeknd - Starboy (Behind The Scenes)",
		artist: { name: "The Weeknd" },
	};
	const live = {
		id: 2,
		title: "The Weeknd - Starboy (Live from Paris)",
		artist: { name: "The Weeknd" },
	};
	const official = {
		id: 3,
		title: "The Weeknd - Starboy (Official Video)",
		artist: { name: "The Weeknd" },
	};
	const result = pickBestVideo(track, [bts, live, official]);
	assert.equal(result?.id, 3);
});

test("pickBestVideo handles unicode titles and non-English scripts", () => {
	const track = { trackId: "1", title: "Shut Down", artist: "BLACKPINK" };
	const video = {
		id: 1,
		title: "BLACKPINK - ‘Shut Down’ M/V",
		artist: { name: "BLACKPINK" },
	};
	assert.equal(pickBestVideo(track, [video])?.id, 1);

	const krTrack = { trackId: "2", title: "사랑해", artist: "아이유" };
	const krVideo = {
		id: 2,
		title: "아이유 - 사랑해 MV",
		artist: { name: "아이유" },
	};
	assert.equal(pickBestVideo(krTrack, [krVideo])?.id, 2);
});

test("pickBestVideo returns null for empty video list or empty track title", () => {
	const track = { trackId: "1", title: "Anything", artist: "Artist" };
	assert.equal(pickBestVideo(track, []), null);
	assert.equal(
		pickBestVideo({ title: "" }, [{ id: 1, title: "Anything" }]),
		null,
	);
});

test("normalizeText and extractCleanTitle correctly normalize titles and artist prefixes", () => {
	assert.equal(
		extractCleanTitle("Artist - Song Name (Official Video)", "Artist"),
		"song name",
	);
	assert.equal(
		extractCleanTitle("Song Name (feat. Other Artist)", "Artist"),
		"song name",
	);
	assert.equal(
		normalizeText("  Hello,  World! [2021 Remaster]  "),
		"hello world",
	);
});

test("scoreVideoMatch scores exact matches higher than partial or unrelated", () => {
	const track = { title: "Dynamite", artist: "BTS" };
	const exact = {
		id: 1,
		title: "BTS - Dynamite (Official MV)",
		artist: { name: "BTS" },
	};
	const partial = {
		id: 2,
		title: "BTS - Dynamite Acoustic",
		artist: { name: "BTS" },
	};
	const unrelated = { id: 3, title: "BTS - Butter", artist: { name: "BTS" } };

	const exactScore = scoreVideoMatch(track, exact);
	const partialScore = scoreVideoMatch(track, partial);
	const unrelatedScore = scoreVideoMatch(track, unrelated);

	assert.ok(exactScore > partialScore, "Exact match should outscore partial");
	assert.ok(
		unrelatedScore === -1 || unrelatedScore < partialScore,
		"Unrelated should have low or negative score",
	);
});

test("toTidalVideoResult maps a TIDAL video resource to the plugin shape", () => {
	const result = toTidalVideoResult({
		id: 143147453,
		title: "Atomised",
		duration: 263,
		imageId: "2ef62a00-e310-48ab-afc2-f8cb76757968",
		artist: { name: "GoGo Penguin" },
	});
	assert.equal(result.videoId, "143147453");
	assert.equal(result.title, "Atomised");
	assert.equal(result.artist, "GoGo Penguin");
	assert.equal(result.durationSeconds, 263);
	assert.ok(
		result.thumbnail,
		"thumbnail should be set when imageId is provided",
	);
	assert.match(
		result.thumbnail ?? "",
		/2ef62a00\/e310\/48ab\/afc2\/f8cb76757968/,
	);
});

test("toTidalVideoResult tolerates missing artist and image", () => {
	const result = toTidalVideoResult({ id: 5, title: "T", duration: 1 });
	assert.equal(result.videoId, "5");
	assert.equal(result.artist, "");
	assert.equal(result.thumbnail, undefined);
});

test("getStoreCountryCode and getStoreLocale derive from verified store paths with fallback chain", () => {
	// Primary verified store paths (session.countryCode and settings.language)
	const primaryStore = {
		getState: () => ({
			session: { countryCode: "GB" },
			settings: { language: "en_GB" },
		}),
	};
	assert.equal(getStoreCountryCode(primaryStore), "GB");
	assert.equal(getStoreLocale(primaryStore), "en_GB");

	// Secondary fallback from locale bundle
	const secondaryStore = {
		getState: () => ({
			session: {},
			settings: {},
			locale: { currentBundleName: "de-de" },
		}),
	};
	assert.equal(getStoreCountryCode(secondaryStore), "DE");
	assert.equal(getStoreLocale(secondaryStore), "de_de");

	// Default fallback on missing/empty/throwing store
	const emptyStore = { getState: () => ({}) };
	assert.equal(getStoreCountryCode(emptyStore), "US");
	assert.equal(getStoreLocale(emptyStore), "en_US");

	const throwingStore = {
		getState: () => {
			throw new Error("Store disconnected");
		},
	};
	assert.equal(getStoreCountryCode(throwingStore), "US");
	assert.equal(getStoreLocale(throwingStore), "en_US");
});

test("findTidalVideoWithFetcher distinguishes verified empty results from undefined/error responses", async () => {
	const track = { trackId: "123", title: "Atomised", artist: "GoGo Penguin" };

	// Verified empty response => returns null (genuine not found)
	const emptyFetcher = async () => ({ data: [] });
	assert.equal(
		await findTidalVideoWithFetcher(track, undefined, emptyFetcher),
		null,
	);

	// Verified matching response => returns video
	const matchingFetcher = async () => ({
		data: [{ id: 456, title: "Atomised (Official Video)" }],
	});
	const video = await findTidalVideoWithFetcher(
		track,
		undefined,
		matchingFetcher,
	);
	assert.equal(video?.id, 456);

	// Undefined response => throws error (treated as API/network error, not notFound)
	const undefinedFetcher = async () => undefined;
	await assert.rejects(
		findTidalVideoWithFetcher(track, undefined, undefinedFetcher),
		/Failed to fetch video relationship response/,
	);

	// Rejected fetch => throws error
	const failingFetcher = async () => {
		throw new Error("500 Internal Server Error");
	};
	await assert.rejects(
		findTidalVideoWithFetcher(track, undefined, failingFetcher),
		/500 Internal Server Error/,
	);
});

test("playTidalVideoWithDeps reports error when required Redux actions are missing without calling dispatch", async () => {
	const track = { trackId: "123", title: "Atomised", artist: "GoGo Penguin" };
	const fetcher = async () => ({
		data: [{ id: 456, title: "Atomised (Official Video)" }],
	});
	const loader = async () => ({ id: 456 });

	// Missing all actions
	const outcomeNoActions = await playTidalVideoWithDeps(track, undefined, {
		fetchVideoRelations: fetcher,
		loadMediaItem: loader,
		reduxActions: {},
	});
	assert.equal(outcomeNoActions.kind, "error");
	assert.match(
		(outcomeNoActions as { error: Error }).error.message,
		/Required Redux playback actions are missing/,
	);

	// Partial actions missing MOVE_NEXT
	let addNextCalled = 0;
	const outcomePartial = await playTidalVideoWithDeps(track, undefined, {
		fetchVideoRelations: fetcher,
		loadMediaItem: loader,
		reduxActions: {
			"playQueue/ADD_NEXT": () => {
				addNextCalled++;
			},
			"playbackControls/PLAY": () => {},
		},
	});
	assert.equal(outcomePartial.kind, "error");
	assert.equal(
		addNextCalled,
		0,
		"Should not execute partial dispatch when required actions are missing",
	);
});

test("playTidalVideoWithDeps handles cancellation/AbortSignal before and during execution without dispatching", async () => {
	const track = { trackId: "123", title: "Atomised", artist: "GoGo Penguin" };
	const dispatchCalls: string[] = [];
	const actions = {
		"playQueue/ADD_NEXT": () => {
			dispatchCalls.push("ADD_NEXT");
		},
		"playQueue/MOVE_NEXT": () => {
			dispatchCalls.push("MOVE_NEXT");
		},
		"playbackControls/PLAY": () => {
			dispatchCalls.push("PLAY");
		},
	};

	// Already aborted signal
	const controller = new AbortController();
	controller.abort();
	const outcomePreAborted = await playTidalVideoWithDeps(
		track,
		controller.signal,
		{
			fetchVideoRelations: async () => ({
				data: [{ id: 456, title: "Atomised (Official Video)" }],
			}),
			loadMediaItem: async () => ({ id: 456 }),
			reduxActions: actions,
		},
	);
	assert.equal(outcomePreAborted.kind, "error");
	assert.equal(dispatchCalls.length, 0);

	// Signal aborted during media loading
	const midController = new AbortController();
	const outcomeMidAborted = await playTidalVideoWithDeps(
		track,
		midController.signal,
		{
			fetchVideoRelations: async () => {
				midController.abort();
				return {
					data: [{ id: 456, title: "Atomised (Official Video)" }],
				};
			},
			loadMediaItem: async () => ({ id: 456 }),
			reduxActions: actions,
		},
	);
	assert.equal(outcomeMidAborted.kind, "error");
	assert.equal(dispatchCalls.length, 0);
});

test("playTidalVideoWithDeps correctly classifies empty response as notFound and undefined as error", async () => {
	const track = { trackId: "123", title: "Atomised", artist: "GoGo Penguin" };

	// Verified empty response => notFound
	const outcomeEmpty = await playTidalVideoWithDeps(track, undefined, {
		fetchVideoRelations: async () => ({ data: [] }),
		loadMediaItem: async () => ({ id: 456 }),
	});
	assert.equal(outcomeEmpty.kind, "notFound");

	// Undefined response => error
	const outcomeUndefined = await playTidalVideoWithDeps(track, undefined, {
		fetchVideoRelations: async () => undefined,
		loadMediaItem: async () => ({ id: 456 }),
	});
	assert.equal(outcomeUndefined.kind, "error");

	// Rejected fetch => error
	const outcomeRejected = await playTidalVideoWithDeps(track, undefined, {
		fetchVideoRelations: async () => {
			throw new Error("Network offline");
		},
		loadMediaItem: async () => ({ id: 456 }),
	});
	assert.equal(outcomeRejected.kind, "error");
});

test("playTidalVideoWithDeps successfully dispatches ADD_NEXT, MOVE_NEXT, and PLAY in order with exact payload", async () => {
	const track = { trackId: "123", title: "Atomised", artist: "GoGo Penguin" };
	const calls: Array<{ name: string; payload?: unknown }> = [];

	const actions = {
		"playQueue/ADD_NEXT": (payload: unknown) => {
			calls.push({ name: "playQueue/ADD_NEXT", payload });
		},
		"playQueue/MOVE_NEXT": () => {
			calls.push({ name: "playQueue/MOVE_NEXT" });
		},
		"playbackControls/PLAY": () => {
			calls.push({ name: "playbackControls/PLAY" });
		},
	};

	const outcome = await playTidalVideoWithDeps(track, undefined, {
		fetchVideoRelations: async () => ({
			data: [
				{
					id: 456,
					title: "GoGo Penguin - Atomised (Official Video)",
					artist: { name: "GoGo Penguin" },
				},
			],
		}),
		loadMediaItem: async (id, type) => {
			assert.equal(id, "456");
			assert.equal(type, "video");
			return { id: 456 };
		},
		reduxActions: actions,
	});

	assert.equal(outcome.kind, "played");
	if (outcome.kind === "played") {
		assert.equal(outcome.video.videoId, "456");
		assert.equal(outcome.video.artist, "GoGo Penguin");
	}

	assert.equal(calls.length, 3);
	assert.deepEqual(calls[0], {
		name: "playQueue/ADD_NEXT",
		payload: { mediaItemIds: ["456"], context: { type: "UNKNOWN" } },
	});
	assert.deepEqual(calls[1], { name: "playQueue/MOVE_NEXT" });
	assert.deepEqual(calls[2], { name: "playbackControls/PLAY" });
});

test("package metadata reflects native TIDAL behavior without stale YouTube text", async () => {
	const pkg = await import("node:fs/promises").then(({ readFile }) =>
		readFile(new URL("../package.json", import.meta.url), "utf8"),
	);
	const parsed = JSON.parse(pkg);
	assert.doesNotMatch(parsed.description, /youtube/i);
	assert.doesNotMatch(parsed.description, /popup/i);
	assert.match(parsed.description, /native TIDAL|player/i);
});

test("source code verifies queue preservation, missing action checks, and no PlayState workaround", async () => {
	const { readFile } = await import("node:fs/promises");
	const mainSource = await readFile(
		new URL("../src/v2/main.ts", import.meta.url),
		"utf8",
	);
	const tidalVideoSource = await readFile(
		new URL("../src/v2/tidalVideo.ts", import.meta.url),
		"utf8",
	);
	const lookupSource = await readFile(
		new URL("../src/v2/tidalVideoLookup.ts", import.meta.url),
		"utf8",
	);
	const buttonSource = await readFile(
		new URL("../src/v2/button.ts", import.meta.url),
		"utf8",
	);

	// No stale PlayState workaround
	assert.doesNotMatch(mainSource, /void PlayState/);
	assert.doesNotMatch(mainSource, /import\s+{[^}]*PlayState[^}]*}\s+from/);

	// Non-track rejection in main.ts
	assert.match(mainSource, /item\.contentType\s*!==\s*"track"/);

	// Queue preservation via ADD_NEXT + MOVE_NEXT rather than playQueue/RESET
	assert.match(lookupSource, /playQueue\/ADD_NEXT/);
	assert.match(lookupSource, /playQueue\/MOVE_NEXT/);
	assert.match(lookupSource, /playbackControls\/PLAY/);
	assert.doesNotMatch(lookupSource, /playQueue\/RESET/);
	assert.doesNotMatch(tidalVideoSource, /playQueue\/RESET/);

	// Redux actions check
	assert.match(lookupSource, /Required Redux playback actions are missing/);

	// Dynamic store countryCode / locale derivation
	assert.match(lookupSource, /getStoreCountryCode/);
	assert.match(lookupSource, /getStoreLocale/);

	// Distinguish notFound from error
	assert.match(mainSource, /outcome\.kind\s*===\s*"notFound"/);
	assert.match(mainSource, /outcome\.kind\s*===\s*"played"/);
	assert.match(mainSource, /Couldn't open music video/);

	// Button observer handles replacement without permanent body subtree observation
	assert.match(buttonSource, /footerObserver/);
	assert.match(buttonSource, /parentObserver/);
	// bodyObserver is only temporary while footer is absent and disconnected as soon as footer mounts
	assert.match(
		buttonSource,
		/bodyObserver\.disconnect\(\);\s*bodyObserver\s*=\s*null;/,
	);
});
