import { createQualityBadge } from "./badge";
import type { TrackAudioQuality } from "./types";

export const HEADER_MARKER = "rora-audio-quality-header";
export const CELL_MARKER = "rora-audio-quality-cell";
export const ROW_TRACK_MARKER = "roraQualityTrackId";
export const TRACK_ROW_SELECTOR =
	'div[data-test="tracklist-row"], div[data-test="media-list-item"], div[data-test="track-row"], div[data-test="top-track-row"], tr[data-test^="tracklist-row--"], [role="row"]';
export const TRACK_LINK_SELECTOR = 'a[href*="/track/"]';
export const TRACK_TABLE_SELECTOR = 'table, div[aria-label="Tracklist"]';
export const DURATION_SELECTOR =
	'div[data-test="duration"], [data-test="track-duration"], [class*="_timeColumn"]';

const findDuration = (row: HTMLElement): HTMLElement | null => {
	const direct = row.querySelector<HTMLElement>(DURATION_SELECTOR);
	if (direct) return direct;
	const candidates = row.querySelectorAll<HTMLElement>(
		'[role="cell"], div, span',
	);
	for (let index = candidates.length - 1; index >= 0; index--) {
		const candidate = candidates[index];
		if (candidate && /^\d{1,3}:\d{2}$/.test(candidate.textContent?.trim() ?? ""))
			return candidate;
	}
	return null;
};

export const getTrackRowFromLink = (
	link: HTMLAnchorElement,
): HTMLElement | null => {
	let candidate = link.parentElement;
	for (let depth = 0; candidate && depth < 10; depth++) {
		if (findDuration(candidate)) return candidate;
		candidate = candidate.parentElement;
	}
	return null;
};

export const getTrackRowFromDuration = (
	duration: HTMLElement,
): HTMLElement | null => {
	let candidate = duration.parentElement;
	for (let depth = 0; candidate && depth < 12; depth++) {
		if (getTrackId(candidate)) return candidate;
		candidate = candidate.parentElement;
	}
	return null;
};

export interface TrackListIntegrationOptions {
	loadQuality: (trackId: string) => Promise<TrackAudioQuality>;
	isEnabled: () => boolean;
	getDisplayMode: () => "name" | "detailed";
	isDisposed: () => boolean;
}

export const getTrackId = (row: HTMLElement): string | null => {
	const href = row.querySelector<HTMLAnchorElement>('a[href*="/track/"]')?.href;
	const fromHref = href?.match(/\/track\/(\d+)/)?.[1];
	if (fromHref) return fromHref;
	const direct = row.getAttribute("data-track-id");
	if (direct) return direct;
	const imageTest = row
		.querySelector<HTMLElement>('[data-test^="image-container-track-"]')
		?.getAttribute("data-test");
	const fromImage = imageTest?.match(/image-container-track-(\d+)$/)?.[1];
	if (fromImage) return fromImage;
	const contextTest = row
		.querySelector<HTMLElement>('[data-test^="tracklist-id-"]')
		?.getAttribute("data-test");
	return contextTest?.match(/tracklist-id-(\d+)-/)?.[1] ?? null;
};

export const shouldProcessTrackRow = (
	previousTrackId: string | undefined,
	currentTrackId: string,
	hasQualityCell: boolean,
): boolean => previousTrackId !== currentTrackId || !hasQualityCell;

export class TrackListIntegration {
	private readonly observers = new Map<HTMLElement, MutationObserver>();
	private readonly pendingRows = new Set<HTMLElement>();
	private readonly knownRows = new Set<HTMLElement>();
	private flushQueued = false;

	constructor(private readonly options: TrackListIntegrationOptions) {}

	mount(trackList: HTMLElement): void {
		this.pruneDisconnected();
		if (this.observers.has(trackList)) return;
		this.ensureHeader(trackList);
		trackList
			.querySelectorAll<HTMLElement>(TRACK_ROW_SELECTOR)
			.forEach((row) => {
				this.pendingRows.add(row);
			});
		this.queueFlush();

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "childList" &&
					mutation.target instanceof HTMLElement
				) {
					const row = mutation.target.closest<HTMLElement>(TRACK_ROW_SELECTOR);
					if (row) this.pendingRows.add(row);
				}
				if (
					mutation.type === "attributes" &&
					mutation.target instanceof HTMLElement
				) {
					const row = mutation.target.closest<HTMLElement>(TRACK_ROW_SELECTOR);
					if (row) this.pendingRows.add(row);
				}
				for (const node of mutation.addedNodes) this.collectRows(node);
			}
			this.ensureHeader(trackList);
			this.queueFlush();
		});
		observer.observe(trackList, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-track-id", "data-test"],
		});
		this.observers.set(trackList, observer);
	}

	refresh(): void {
		this.pruneRows();
		for (const row of this.knownRows) {
			row.querySelector(`[data-rora-quality="${CELL_MARKER}"]`)?.remove();
			delete row.dataset[ROW_TRACK_MARKER];
			if (this.options.isEnabled()) this.pendingRows.add(row);
		}
		for (const trackList of this.observers.keys()) {
			trackList
				.querySelector(`[data-rora-quality="${HEADER_MARKER}"]`)
				?.remove();
			if (!this.options.isEnabled()) continue;
			this.ensureHeader(trackList);
		}
		this.queueFlush();
	}

	refreshTrack(_trackId: string): void {
		// No-op: badges are not rendered.
	}

	setPlaybackQuality(_quality: TrackAudioQuality): void {
		// No-op: badges are not rendered.
	}

	disconnect(): void {
		for (const [trackList, observer] of this.observers) {
			observer.disconnect();
			this.removeInjected(trackList);
		}
		this.observers.clear();
		this.pendingRows.clear();
		for (const row of this.knownRows) {
			row.querySelector(`[data-rora-quality="${CELL_MARKER}"]`)?.remove();
			delete row.dataset[ROW_TRACK_MARKER];
		}
		this.knownRows.clear();
	}

	async processTrackRow(row: HTMLElement): Promise<void> {
		if (!this.options.isEnabled() || this.options.isDisposed()) return;
		const trackId = getTrackId(row);
		if (!trackId) return;
		this.knownRows.add(row);
		const duration = findDuration(row);
		if (!duration?.parentElement) return;
		const table = row.closest<HTMLElement>(
			'table, [role="table"], [role="grid"], div[aria-label="Tracklist"]',
		);
		if (table) this.ensureHeader(table);
		let cell = row.querySelector<HTMLElement>(
			`[data-rora-quality="${CELL_MARKER}"]`,
		);
		if (
			!shouldProcessTrackRow(
				row.dataset[ROW_TRACK_MARKER],
				trackId,
				Boolean(cell),
			)
		)
			return;

		row.dataset[ROW_TRACK_MARKER] = trackId;
		if (!cell) {
			cell = duration.cloneNode(false) as HTMLElement;
			cell.dataset.roraQuality = CELL_MARKER;
			cell.classList.add("rora-quality-column");
			cell.setAttribute("role", "cell");
			duration.parentElement.insertBefore(cell, duration);
		}
		cell.replaceChildren(createQualityBadge(null));
		try {
			const quality = await this.options.loadQuality(trackId);
			if (
				this.options.isDisposed() ||
				!row.isConnected ||
				getTrackId(row) !== trackId ||
				row.dataset[ROW_TRACK_MARKER] !== trackId
			)
				return;
			cell.replaceChildren(
				createQualityBadge(quality, "details", this.options.getDisplayMode()),
			);
		} catch {
			if (
				!this.options.isDisposed() &&
				getTrackId(row) === trackId &&
				row.dataset[ROW_TRACK_MARKER] === trackId
			)
				cell.replaceChildren(createQualityBadge(null));
		}
	}

	private collectRows(node: Node): void {
		if (!(node instanceof HTMLElement)) return;
		if (node.matches(TRACK_ROW_SELECTOR)) this.pendingRows.add(node);
		node.querySelectorAll<HTMLElement>(TRACK_ROW_SELECTOR).forEach((row) => {
			this.pendingRows.add(row);
		});
	}

	private pruneDisconnected(): void {
		for (const [trackList, observer] of this.observers) {
			if (trackList.isConnected) continue;
			observer.disconnect();
			this.observers.delete(trackList);
		}
	}

	private pruneRows(): void {
		for (const row of this.knownRows) {
			if (!row.isConnected) this.knownRows.delete(row);
		}
	}

	private queueFlush(): void {
		if (this.flushQueued) return;
		this.flushQueued = true;
		queueMicrotask(() => {
			this.flushQueued = false;
			const rows = [...this.pendingRows];
			this.pendingRows.clear();
			for (const row of rows) void this.processTrackRow(row);
		});
	}

	private ensureHeader(trackList: HTMLElement): void {
		if (
			!this.options.isEnabled() ||
			trackList.querySelector(`[data-rora-quality="${HEADER_MARKER}"]`)
		)
			return;
		const time = trackList.querySelector<HTMLElement>(
			'thead th[class*="_timeColumn"], [class*="_timeColumn"][role="columnheader"], [data-test="track-duration-header"]',
		);
		if (!time?.parentElement) return;
		const header = time.cloneNode(false) as HTMLElement;
		header.dataset.roraQuality = HEADER_MARKER;
		header.classList.add("rora-quality-column");
		header.setAttribute("role", "columnheader");
		header.setAttribute("aria-label", "Audio quality");
		header.textContent = "QUALITY";
		time.parentElement.insertBefore(header, time);
	}

	private removeInjected(trackList: HTMLElement): void {
		trackList
			.querySelectorAll(
				`[data-rora-quality="${HEADER_MARKER}"], [data-rora-quality="${CELL_MARKER}"]`,
			)
			.forEach((element) => {
				element.remove();
			});
		trackList
			.querySelectorAll<HTMLElement>(TRACK_ROW_SELECTOR)
			.forEach((row) => {
				delete row.dataset[ROW_TRACK_MARKER];
			});
	}
}
