/**
 * Pure helpers for the TIDAL-native music-video path. These functions don't
 * touch any `@luna/lib` API so they can be unit-tested without the bundled
 * TidaLuna runtime.
 *
 * The actual dispatch (fetching the video, queuing it, asking TIDAL to play)
 * lives in `tidalVideo.ts` which is the file the plugin loads at runtime.
 */
export interface TidalVideoResource {
	id: number | string;
	title?: string;
	duration?: number;
	imageId?: string | null;
	type?: string;
	artist?: { name?: string };
	artists?: Array<{ name?: string }>;
}

export interface TidalVideoResult {
	videoId: string;
	title: string;
	artist: string;
	durationSeconds?: number;
	thumbnail?: string;
}

/** TIDAL relationships response (matches `/v1/tracks/{id}/relationships/videos`). */
export interface TidalVideoRelationship {
	data?: TidalVideoResource[];
	included?: TidalVideoResource[];
	links?: { next?: string };
}

export interface TrackLookupQuery {
	title: string;
	artist?: string;
	album?: string;
}

const PARENTHETICAL_RE = /[[({][^)}\]]*[)}\]]/g;
const NON_ALPHANUM_RE = /[^\p{L}\p{N}\s]/gu;
const SPACES_RE = /\s+/g;
const NOISE_WORDS_RE =
	/\b(official\s+music\s+video|official\s+video|official\s+audio|music\s+video|official\s+visualizer|visualizer|lyric\s+video|vertical\s+video|performance\s+video|official|hd|4k|m\/?v)\b/gi;
const NON_MUSIC_VIDEO_RE =
	/\b(behind\s+the\s+scenes|making\s+of|interview|trailer|teaser|commentary|track\s+by\s+track|snippet)\b/i;
const NON_MUSIC_VIDEO_TRACK_RE =
	/\b(behind\s+the\s+scenes|making\s+of|interview|trailer|teaser|commentary)\b/i;
const OFFICIAL_MV_RE = /\b(official\s+music\s+video|official\s+video|m\/?v)\b/i;
const LIVE_RE = /\b(live|concert|tour)\b/i;

export const normalizeText = (value: string): string => {
	return value
		.toLowerCase()
		.replace(PARENTHETICAL_RE, " ")
		.replace(NON_ALPHANUM_RE, " ")
		.replace(SPACES_RE, " ")
		.trim();
};

export const extractCleanTitle = (title: string, artist?: string): string => {
	let clean = title.toLowerCase();
	// Remove parenthetical/bracketed content e.g. (Official Video), [Live], (feat. X)
	clean = clean.replace(PARENTHETICAL_RE, " ");
	// Remove common video noise words
	clean = clean.replace(NOISE_WORDS_RE, " ");
	// If artist is prefixed in title e.g. "Artist - Song", strip artist prefix
	if (artist) {
		const normArtist = normalizeText(artist);
		const normClean = normalizeText(clean);
		if (
			normArtist &&
			normClean.startsWith(normArtist) &&
			normClean.length > normArtist.length
		) {
			clean = normClean.slice(normArtist.length).trim();
		}
	}
	return normalizeText(clean);
};

export const scoreVideoMatch = (
	track: TrackLookupQuery,
	video: TidalVideoResource,
): number => {
	const rawTrackTitle = String(track.title ?? "").trim();
	const rawVideoTitle = String(video.title ?? "").trim();
	if (!rawTrackTitle || !rawVideoTitle) return -1;

	const trackArtist = String(track.artist ?? "").trim();
	const videoArtist = String(
		video.artist?.name ?? video.artists?.[0]?.name ?? "",
	).trim();

	const cleanTrackTitle = extractCleanTitle(rawTrackTitle, trackArtist);
	const cleanVideoTitle = extractCleanTitle(
		rawVideoTitle,
		videoArtist || trackArtist,
	);

	if (!cleanTrackTitle || !cleanVideoTitle) return -1;

	let score = 0;

	// Title matching
	if (cleanTrackTitle === cleanVideoTitle) {
		score += 100;
	} else if (
		cleanVideoTitle.startsWith(cleanTrackTitle) ||
		cleanVideoTitle.endsWith(cleanTrackTitle)
	) {
		score += 80;
	} else if (cleanVideoTitle.includes(cleanTrackTitle)) {
		score += 70;
	} else if (cleanTrackTitle.includes(cleanVideoTitle)) {
		score += 60;
	} else {
		// Word overlap check
		const trackWords = cleanTrackTitle.split(" ").filter((w) => w.length > 1);
		const videoWords = new Set(
			cleanVideoTitle.split(" ").filter((w) => w.length > 1),
		);
		if (trackWords.length > 0 && trackWords.every((w) => videoWords.has(w))) {
			score += 65;
		} else {
			// No significant title match
			return -1;
		}
	}

	// Artist consideration
	if (trackArtist) {
		const normTrackArtist = normalizeText(trackArtist);
		const normVideoArtist = normalizeText(videoArtist);
		const normRawVideoTitle = normalizeText(rawVideoTitle);

		if (normVideoArtist && normTrackArtist) {
			if (
				normVideoArtist === normTrackArtist ||
				normVideoArtist.includes(normTrackArtist) ||
				normTrackArtist.includes(normVideoArtist)
			) {
				score += 20;
			} else {
				// Video has a different artist specified; check if track artist appears in video title
				if (normRawVideoTitle.includes(normTrackArtist)) {
					score += 10;
				} else {
					score -= 35;
				}
			}
		} else if (normRawVideoTitle.includes(normTrackArtist)) {
			score += 15;
		}
	}

	// Video title tag adjustments
	const lowerRawVideo = rawVideoTitle.toLowerCase();
	const lowerRawTrack = rawTrackTitle.toLowerCase();

	// Penalize non-music video content (interviews, behind the scenes, trailers)
	if (
		NON_MUSIC_VIDEO_RE.test(lowerRawVideo) &&
		!NON_MUSIC_VIDEO_TRACK_RE.test(lowerRawTrack)
	) {
		score -= 50;
	}

	// Prefer official music videos
	if (OFFICIAL_MV_RE.test(lowerRawVideo)) {
		score += 15;
	}

	// Mild penalty for live versions if original track is not live
	if (LIVE_RE.test(lowerRawVideo) && !LIVE_RE.test(lowerRawTrack)) {
		score -= 10;
	}

	return score;
};

/**
 * Pick the best TIDAL video for the given track metadata.
 * Considers title and artist and rejects unrelated videos without falling back to videos[0].
 */
export const pickBestVideo = (
	track: TrackLookupQuery,
	videos: TidalVideoResource[],
): TidalVideoResource | null => {
	if (!videos || videos.length === 0 || !track?.title) return null;

	let bestVideo: TidalVideoResource | null = null;
	let bestScore = 0;

	for (const video of videos) {
		if (!video?.id) continue;
		const score = scoreVideoMatch(track, video);
		if (score >= 40 && score > bestScore) {
			bestScore = score;
			bestVideo = video;
		}
	}

	return bestVideo;
};

/**
 * Convert a TIDAL video resource into the plugin's MV result shape.
 */
export const toTidalVideoResult = (
	video: TidalVideoResource,
): TidalVideoResult => {
	const id = String(video.id);
	const artistName = String(
		video.artist?.name ?? video.artists?.[0]?.name ?? "",
	).trim();
	const imageId = video.imageId ?? undefined;
	return {
		videoId: id,
		title: String(video.title ?? ""),
		artist: artistName,
		durationSeconds:
			typeof video.duration === "number" ? video.duration : undefined,
		thumbnail: imageId
			? `https://resources.tidal.com/images/${imageId.replace(/-/g, "/")}/1280x1280.jpg`
			: undefined,
	};
};

/**
 * Safely derive country code from store with verified fallback chain.
 * Primary: session.countryCode (matches TidalApi.queryArgs)
 * Secondary: locale.currentBundleName (e.g. "en-us" -> "US")
 * Default fallback: "US"
 */
export const getStoreCountryCode = (store?: {
	getState?: () => unknown;
}): string => {
	try {
		const state = store?.getState?.() as
			| {
					session?: { countryCode?: unknown };
					locale?: { currentBundleName?: unknown };
			  }
			| undefined;
		const code = state?.session?.countryCode;
		if (typeof code === "string" && code.trim().length > 0) {
			return code.trim();
		}
		const bundleName = state?.locale?.currentBundleName;
		if (typeof bundleName === "string" && bundleName.includes("-")) {
			const candidate = bundleName.split("-").pop()?.toUpperCase();
			if (candidate && candidate.length === 2) {
				return candidate;
			}
		}
	} catch {
		/* ignore */
	}
	return "US";
};

/**
 * Safely derive locale from store with verified fallback chain.
 * Primary: settings.language (matches TidalApi.queryArgs)
 * Secondary: locale.currentBundleName (e.g. "en-us" -> "en_US")
 * Default fallback: "en_US"
 */
export const getStoreLocale = (store?: {
	getState?: () => unknown;
}): string => {
	try {
		const state = store?.getState?.() as
			| {
					settings?: { language?: unknown };
					locale?: { currentBundleName?: unknown };
			  }
			| undefined;
		const lang = state?.settings?.language;
		if (typeof lang === "string" && lang.trim().length > 0) {
			return lang.trim();
		}
		const bundleName = state?.locale?.currentBundleName;
		if (typeof bundleName === "string" && bundleName.trim().length > 0) {
			return bundleName.trim().replace("-", "_");
		}
	} catch {
		/* ignore */
	}
	return "en_US";
};

/**
 * Fetch and select matching TIDAL video with an injected fetcher.
 * Throws if response is undefined or rejected.
 * Returns null if response is a verified empty relationship list or has no match.
 */
export const findTidalVideoWithFetcher = async (
	track: TrackLookupQuery & { trackId: string },
	signal?: AbortSignal,
	fetcher?: (url: string) => Promise<TidalVideoRelationship | undefined>,
	store?: { getState?: () => unknown },
): Promise<TidalVideoResource | null> => {
	if (signal?.aborted) return null;
	if (!fetcher) {
		throw new Error("No fetcher function provided for TIDAL video lookup");
	}
	const countryCode = getStoreCountryCode(store);
	const locale = getStoreLocale(store);
	const url = `https://api.tidal.com/v1/tracks/${encodeURIComponent(track.trackId)}/relationships/videos?countryCode=${encodeURIComponent(countryCode)}&locale=${encodeURIComponent(locale)}&deviceType=DESKTOP&limit=10`;

	const response = await fetcher(url);
	if (signal?.aborted) return null;
	if (
		response === undefined ||
		response === null ||
		typeof response !== "object"
	) {
		throw new Error(
			"Failed to fetch video relationship response: response was undefined or invalid",
		);
	}

	const items = response.data ?? response.included ?? [];
	return pickBestVideo(track, items);
};

export type PlayTidalVideoOutcome =
	| { kind: "played"; video: TidalVideoResult }
	| { kind: "notFound" }
	| { kind: "error"; error: unknown };

export interface TidalVideoDependencies {
	fetchVideoRelations?: (
		url: string,
	) => Promise<TidalVideoRelationship | undefined>;
	loadMediaItem?: (id: string | number, type: "video") => Promise<unknown>;
	reduxStore?: { getState: () => unknown };
	reduxActions?: Record<string, ((...args: unknown[]) => unknown) | undefined>;
}

export const playTidalVideoWithDeps = async (
	track: TrackLookupQuery & { trackId: string },
	signal?: AbortSignal,
	deps: TidalVideoDependencies = {},
): Promise<PlayTidalVideoOutcome> => {
	if (signal?.aborted) {
		return { kind: "error", error: new DOMException("Aborted", "AbortError") };
	}
	if (!track?.trackId || !track?.title) {
		return { kind: "error", error: new Error("Invalid track metadata") };
	}

	try {
		const video = await findTidalVideoWithFetcher(
			track,
			signal,
			deps.fetchVideoRelations,
			deps.reduxStore,
		);
		if (signal?.aborted) {
			return {
				kind: "error",
				error: new DOMException("Aborted", "AbortError"),
			};
		}
		if (!video) {
			return { kind: "notFound" };
		}

		const result = toTidalVideoResult(video);
		const videoId = result.videoId;
		if (!videoId) {
			return { kind: "notFound" };
		}

		if (!deps.loadMediaItem) {
			return {
				kind: "error",
				error: new Error("No mediaItem loader provided"),
			};
		}
		const mediaItem = await deps.loadMediaItem(videoId, "video");
		if (signal?.aborted) {
			return {
				kind: "error",
				error: new DOMException("Aborted", "AbortError"),
			};
		}
		if (!mediaItem) {
			return {
				kind: "error",
				error: new Error(`TIDAL video ${videoId} not loadable`),
			};
		}

		const actions = deps.reduxActions;
		const addNext = actions?.["playQueue/ADD_NEXT"];
		const moveNext = actions?.["playQueue/MOVE_NEXT"];
		const play = actions?.["playbackControls/PLAY"];

		if (
			typeof addNext !== "function" ||
			typeof moveNext !== "function" ||
			typeof play !== "function"
		) {
			return {
				kind: "error",
				error: new Error("Required Redux playback actions are missing"),
			};
		}

		if (signal?.aborted) {
			return {
				kind: "error",
				error: new DOMException("Aborted", "AbortError"),
			};
		}

		addNext({
			mediaItemIds: [videoId],
			context: { type: "UNKNOWN" },
		});
		moveNext();
		play();

		return { kind: "played", video: result };
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			return { kind: "error", error };
		}
		return { kind: "error", error };
	}
};
