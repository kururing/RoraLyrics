import { redux } from "@luna/lib";
import { parseLrc } from "../lyrics/parseLrc";
import { plainLines } from "../lyrics/plainLines";
import type { LyricsProvider, TrackMetadata } from "../types/lyrics";
import { selectTidalLyrics, type TidalLyricsPayload } from "./tidalPayload";

interface Entity {
	attributes?: {
		text?: string;
		lrcText?: string;
		provider?: { name?: string };
	};
}

export class TidalProvider implements LyricsProvider {
	readonly id = "tidal" as const;
	private readonly actionLyrics = new Map<string, TidalLyricsPayload>();

	captureLyrics(payload: TidalLyricsPayload): void {
		this.actionLyrics.set(String(payload.trackId), payload);
	}

	clear(): void {
		this.actionLyrics.clear();
	}

	async getLyrics(track: TrackMetadata) {
		const state = redux.store.getState() as unknown as {
			entities?: {
				tracks?: {
					entities?: Record<
						string,
						{ relationships?: { lyrics?: { data?: Array<{ id: string }> } } }
					>;
				};
				lyrics?: { entities?: Record<string, Entity> };
			};
		};
		const relation = track.id
			? state.entities?.tracks?.entities?.[track.id]?.relationships?.lyrics
					?.data?.[0]
			: undefined;
		const attributes = relation
			? state.entities?.lyrics?.entities?.[relation.id]?.attributes
			: undefined;
		const action = track.id ? this.actionLyrics.get(track.id) : undefined;
		const selected = selectTidalLyrics(action, attributes);
		const { plain, synced } = selected;
		return {
			source: this.id,
			originalLyrics: plain,
			syncedLyrics: synced,
			lines: synced ? parseLrc(synced) : plainLines(plain),
			instrumental: false,
			confidence: plain || synced ? 1 : 0,
			metadata: { provider: selected.provider },
			error: plain || synced ? undefined : "Lyrics unavailable",
		};
	}
}
