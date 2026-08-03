export interface TidalLyricsPayload {
	trackId: string | number;
	lyrics?: string;
	subtitles?: string;
	lyricsProvider?: string;
}

export interface TidalLyricsEntityAttributes {
	text?: string;
	lrcText?: string;
	provider?: { name?: string };
}

export const selectTidalLyrics = (
	action: TidalLyricsPayload | undefined,
	entity: TidalLyricsEntityAttributes | undefined,
): { plain: string | null; synced: string | null; provider: string } => ({
	plain: action?.lyrics ?? entity?.text ?? null,
	synced: action?.subtitles ?? entity?.lrcText ?? null,
	provider: action?.lyricsProvider ?? entity?.provider?.name ?? "TIDAL",
});
