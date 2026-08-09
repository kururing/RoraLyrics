import styles from "file://../styles.css?minify";
import type { LunaUnload } from "@luna/core";
import { MediaItem, PlayState, StyleTag } from "@luna/lib";
import { Settings } from "../SettingsPage";
import { settings } from "../settings";
import { createPlayer } from "./bridge";
import { searchVideo, type CurrentTrack } from "./search";
import { Modal, mountFooterButton } from "./ui";

export { Settings };
export const unloads = new Set<LunaUnload>();
new StyleTag("RoraTidalMv", unloads, styles);

let operation: AbortController | null = null;
let pausedByPlugin = false;
const modal = new Modal(() => { if (pausedByPlugin && settings.resumeTidalOnClose) PlayState.play(); pausedByPlugin = false; operation?.abort(); operation = null; });

const metadata = async (): Promise<CurrentTrack | null> => {
	const item = await MediaItem.fromPlaybackContext();
	const raw = (item?.tidalItem ?? {}) as { title?: unknown; artist?: { name?: unknown }; artists?: Array<{ name?: unknown }> };
	const title = String(raw.title ?? "").trim(); const artist = String(raw.artist?.name ?? raw.artists?.[0]?.name ?? "").trim();
	return title ? { title, artist } : null;
};

const open = async () => {
	operation?.abort(); operation = new AbortController(); const signal = operation.signal;
	const track = await metadata(); if (!track || signal.aborted) return;
	pausedByPlugin = PlayState.playing; if (pausedByPlugin) PlayState.pause();
	const body = modal.show(track);
	try { const id = await searchVideo(track, settings.youtubeApiKey, signal); if (signal.aborted) return; modal.attach(await createPlayer(body, id, signal)); }
	catch (error) { if (!signal.aborted) modal.error(error instanceof Error && error.message === "MISSING_API_KEY" ? "Enter a YouTube Data API key in plugin settings." : `Unable to open video: ${error instanceof Error ? error.message : "unknown error"}`); }
};

const unmountButton = mountFooterButton(() => void open());
unloads.add(() => { operation?.abort(); operation = null; unmountButton(); modal.destroy(false); pausedByPlugin = false; });
