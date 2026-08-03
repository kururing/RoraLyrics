export const secondsToMilliseconds = (seconds: number): number =>
	Number.isFinite(seconds) ? seconds * 1000 : 0;

export const millisecondsToSeconds = (milliseconds: number): number =>
	Number.isFinite(milliseconds) ? milliseconds / 1000 : 0;

export interface LivePlaybackSnapshot {
	currentTimeSeconds: number;
	currentTimeSyncTimestampMs: number;
	isPlaying: boolean;
	durationSeconds?: number;
}

/** Derives live position from TIDAL's latest Redux time anchor (all output is ms). */
export function calculateLivePlaybackPositionMs(
	snapshot: LivePlaybackSnapshot,
	nowEpochMs = Date.now(),
): number {
	let positionMs = secondsToMilliseconds(snapshot.currentTimeSeconds);
	const timestamp = snapshot.currentTimeSyncTimestampMs;
	if (
		snapshot.isPlaying &&
		Number.isFinite(timestamp) &&
		timestamp > 0 &&
		timestamp <= nowEpochMs
	) {
		positionMs += nowEpochMs - timestamp;
	}
	const durationMs = secondsToMilliseconds(snapshot.durationSeconds ?? 0);
	if (durationMs > 0) positionMs = Math.min(positionMs, durationMs);
	return Math.max(0, positionMs);
}
