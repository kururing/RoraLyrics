import assert from "node:assert/strict";
import test from "node:test";
import { CACHE_TTL_MS, isCacheEntryExpired, isUnavailableError } from "../src/v2/cachePolicy";
import { looksOfficialChannel, rankVideos, scoreVideo, type VideoCandidate } from "../src/v2/score";
import { buildQueries } from "../src/v2/search";

const candidate = (overrides: Partial<VideoCandidate> = {}): VideoCandidate => ({
	videoId: "abc123",
	title: "Artist - Song (Official Music Video)",
	channelTitle: "ArtistVEVO",
	description: "Official music video for Song by Artist.",
	thumbnail: "https://example.com/thumb.jpg",
	...overrides,
});

test("queries prioritize official music video phrasing", () => {
	const queries = buildQueries({ title: "Song", artist: "Artist" });
	assert.equal(queries.length, 3);
	assert.equal(queries[0], "Artist Song official music video");
	assert.match(queries[1], /official MV/i);
	assert.match(queries[2], /official video/i);
});

test("official music video with title and artist match scores highest and is official", () => {
	const scored = scoreVideo({ title: "Song", artist: "Artist" }, candidate());
	assert.equal(scored.isOfficial, true);
	assert.ok(scored.score >= 50, `expected score >= 50, got ${scored.score}`);
});

test("lyric video is penalized and not official", () => {
	const track = { title: "Song", artist: "Artist" };
	const plain = scoreVideo(track, candidate({ title: "Artist - Song", channelTitle: "RandomUser", description: "" }));
	const lyric = scoreVideo(track, candidate({ title: "Artist - Song (Lyric Video)", channelTitle: "RandomUser", description: "Lyrics on screen." }));
	assert.equal(lyric.isOfficial, false);
	assert.ok(lyric.score < plain.score, `expected lyric (${lyric.score}) below plain (${plain.score})`);
});

test("audio-only upload is penalized", () => {
	const track = { title: "Song", artist: "Artist" };
	const plain = scoreVideo(track, candidate({ title: "Artist - Song", channelTitle: "RandomUser", description: "" }));
	const audio = scoreVideo(track, candidate({ title: "Artist - Song (Audio)", channelTitle: "Artist", description: "Audio only" }));
	assert.equal(audio.isOfficial, false);
	assert.ok(audio.score < plain.score, `expected audio (${audio.score}) below plain (${plain.score})`);
});

test("live / cover / reaction / fanmade titles are penalized", () => {
	const track = { title: "Song", artist: "Artist" };
	const plain = scoreVideo(track, candidate({ title: "Artist - Song", channelTitle: "RandomUser", description: "" }));
	for (const title of ["Artist - Song (Live)", "Artist - Song (Cover)", "Artist - Song (Reaction)", "Song (Fanmade)"] as const) {
		const scored = scoreVideo(track, candidate({ title, channelTitle: "RandomUser", description: "" }));
		assert.equal(scored.isOfficial, false, title);
		assert.ok(scored.score < plain.score, `expected penalized score for "${title}" (${scored.score}) below plain (${plain.score})`);
	}
});

test("official-looking channel is detected when it carries the artist and a marker", () => {
	assert.equal(looksOfficialChannel("ArtistVEVO", "Artist"), true);
	assert.equal(looksOfficialChannel("Artist Official", "Artist"), true);
	assert.equal(looksOfficialChannel("RandomUser", "Artist"), false);
	assert.equal(looksOfficialChannel("", "Artist"), false);
});

test("rankVideos prefers the official result when preferOfficial is on", () => {
	const fanUpload = candidate({ videoId: "fan", title: "Artist - Song (HD)", channelTitle: "FanChannel", description: "" });
	const official = candidate({ videoId: "official", title: "Artist - Song (Official Video)", channelTitle: "ArtistVEVO", description: "Official" });
	const best = rankVideos({ title: "Song", artist: "Artist" }, [fanUpload, official], true);
	assert.equal(best?.videoId, "official");
});

test("rankVideos falls back to the highest-scoring result when none is official", () => {
	const low = candidate({ videoId: "low", title: "Song", channelTitle: "RandomUser", description: "" });
	const high = candidate({ videoId: "high", title: "Artist - Song", channelTitle: "Artist", description: "" });
	const best = rankVideos({ title: "Song", artist: "Artist" }, [low, high], true);
	assert.equal(best?.videoId, "high");
	assert.equal(best?.isOfficial, false);
});

test("rankVideos returns null for an empty list", () => {
	assert.equal(rankVideos({ title: "Song", artist: "Artist" }, [], true), null);
});

test("cache entries expire only after the TTL", () => {
	const now = Date.now();
	const fresh = { timestampCached: now, videoId: "a", title: "t", channel: "c", thumbnail: "", isOfficial: true };
	const stale = { ...fresh, timestampCached: now - CACHE_TTL_MS - 1 };
	assert.equal(isCacheEntryExpired(fresh, now), false);
	assert.equal(isCacheEntryExpired(stale, now), true);
});

test("only unavailable/embeddability error codes invalidate the cache", () => {
	assert.equal(isUnavailableError(100), true);
	assert.equal(isUnavailableError(101), true);
	assert.equal(isUnavailableError(150), true);
	assert.equal(isUnavailableError(2), false);
	assert.equal(isUnavailableError(5), false);
});
