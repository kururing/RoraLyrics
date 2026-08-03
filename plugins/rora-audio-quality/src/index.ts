import styles from "file://styles.css?minify";
import type { LunaUnload } from "@luna/core";
import { MediaItem, StyleTag } from "@luna/lib";
import { createQualityBadge } from "./badge";
import { QualityCache, RequestPool } from "./cache";
import { fromCatalogMetadata } from "./quality";
import type { TrackAudioQuality } from "./types";

export const unloads = new Set<LunaUnload>();
new StyleTag("RoraAudioQuality", unloads, styles);

const HEADER_MARKER = "rora-audio-quality-header";
const CELL_MARKER = "rora-audio-quality-cell";
const cache = new QualityCache();
const requests = new RequestPool<TrackAudioQuality>(4);
let disposed = false;

const loadCatalogQuality = async (
	trackId: string,
): Promise<TrackAudioQuality> => {
	const cached = cache.get(trackId);
	if (cached) return cached;
	return requests.run(trackId, async () => {
		const mediaItem = await MediaItem.fromId(trackId);
		const quality = fromCatalogMetadata(trackId, mediaItem?.tidalItem ?? {});
		cache.set(quality);
		return quality;
	});
};

const ensureHeader = (trackList: Element): void => {
	if (trackList.querySelector(`[data-rora-quality="${HEADER_MARKER}"]`)) return;
	const time = trackList.querySelector<HTMLElement>(
		'span[class^="_timeColumn"][role="columnheader"]',
	);
	if (!time?.parentElement) return;
	const header = time.cloneNode(false) as HTMLElement;
	header.dataset.roraQuality = HEADER_MARKER;
	header.classList.add("rora-quality-column");
	header.setAttribute("role", "columnheader");
	header.setAttribute("aria-label", "Audio quality");
	header.textContent = "QUALITY";
	time.parentElement.insertBefore(header, time);
};

const updateRow = async (row: HTMLElement): Promise<void> => {
	const trackId = row.getAttribute("data-track-id");
	if (!trackId) return;
	const duration = row.querySelector<HTMLElement>('div[data-test="duration"]');
	if (!duration?.parentElement) return;
	let cell = row.querySelector<HTMLElement>(
		`[data-rora-quality="${CELL_MARKER}"]`,
	);
	if (!cell) {
		cell = duration.cloneNode(false) as HTMLElement;
		cell.dataset.roraQuality = CELL_MARKER;
		cell.classList.add("rora-quality-column");
		cell.setAttribute("role", "cell");
		duration.parentElement.insertBefore(cell, duration);
	}
	cell.replaceChildren(createQualityBadge(null));
	try {
		const quality = await loadCatalogQuality(trackId);
		if (
			disposed ||
			row.getAttribute("data-track-id") !== trackId ||
			!row.isConnected
		)
			return;
		cell.replaceChildren(createQualityBadge(quality));
	} catch {
		if (!disposed && row.getAttribute("data-track-id") === trackId)
			cell.replaceChildren(createQualityBadge(null));
	}
};

const processTrackList = (trackList: Element): void => {
	ensureHeader(trackList);
	trackList
		.querySelectorAll<HTMLElement>('div[data-test="tracklist-row"]')
		.forEach((row) => void updateRow(row));
};

const scanNode = (node: Node): void => {
	if (!(node instanceof Element)) return;
	if (node.matches('div[aria-label="Tracklist"]')) processTrackList(node);
	node
		.querySelectorAll('div[aria-label="Tracklist"]')
		.forEach(processTrackList);
	if (node.matches('div[data-test="tracklist-row"]'))
		void updateRow(node as HTMLElement);
};

const removeTrackColumns = (): void => {
	document
		.querySelectorAll(
			`[data-rora-quality="${HEADER_MARKER}"], [data-rora-quality="${CELL_MARKER}"]`,
		)
		.forEach((element) => {
			element.remove();
		});
};

const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		if (mutation.type === "attributes") {
			void updateRow(mutation.target as HTMLElement);
			continue;
		}
		for (const node of mutation.addedNodes) scanNode(node);
	}
});
observer.observe(document.body, {
	subtree: true,
	childList: true,
	attributes: true,
	attributeFilter: ["data-track-id"],
});
unloads.add(() => observer.disconnect());

document
	.querySelectorAll('div[aria-label="Tracklist"]')
	.forEach(processTrackList);
unloads.add(() => {
	disposed = true;
	removeTrackColumns();
	cache.clear();
});
