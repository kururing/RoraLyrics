import { getQualityCategory, type QualityCategory } from "./quality";
import { getTrackRowFromLink } from "./trackListIntegration";
import type { TrackAudioQuality } from "./types";

type FilterValue = "all" | QualityCategory;

const FILTER_OPTIONS: Array<[FilterValue, string]> = [
	["all", "All"],
	["radio", "Radio"],
	["cd", "CD"],
	["dvd", "DVD"],
	["studio", "Studio"],
	["hi-res", "Hi-Res"],
	["ultra-hi-res", "Ultra-Hi-Res"],
];

const TRACK_ID_RE = /\/track\/(\d+)/;

const findSearchRoot = (heading: HTMLElement): HTMLElement | null => {
	const explicit = heading.closest<HTMLElement>(
		'[role="dialog"], [data-test*="search" i]',
	);
	if (explicit) return explicit;
	let candidate = heading.parentElement;
	for (let depth = 0; candidate && depth < 4; depth++) {
		if (candidate.querySelector('a[href*="/track/"]')) return candidate;
		candidate = candidate.parentElement;
	}
	return heading.parentElement?.parentElement ?? heading.parentElement;
};

const findRecentSearchHeadings = (): HTMLElement[] => {
	const headings = document.querySelectorAll<HTMLElement>(
		'h1, h2, h3, h4, h5, h6, strong, [role="heading"], div, span',
	);
	const results: HTMLElement[] = [];
	for (let i = 0; i < headings.length; i++) {
		const el = headings[i];
		if (
			el.children.length === 0 &&
			el.textContent?.trim().toLowerCase() === "recent searches"
		) {
			results.push(el);
		}
	}
	return results;
};

const getTrackTarget = (link: HTMLAnchorElement): HTMLElement | null =>
	getTrackRowFromLink(link) ??
	link.closest<HTMLElement>(
		'li, [role="row"], [data-test*="track" i], [data-test*="media-list-item" i]',
	) ??
	link.parentElement;

export class SearchQualityFilter {
	private observer: MutationObserver | null = null;
	private generation = 0;
	private mountScheduled = false;

	constructor(
		private readonly loadQuality: (
			trackId: string,
		) => Promise<TrackAudioQuality>,
	) {}

	start(): void {
		if (this.observer) return;
		this.observer = new MutationObserver(() => this.scheduleMount());
		this.observer.observe(document.body, { childList: true, subtree: true });
		this.mount();
	}

	stop(): void {
		this.generation++;
		this.mountScheduled = false;
		this.observer?.disconnect();
		this.observer = null;
		document
			.querySelectorAll<HTMLElement>(".rora-search-quality-control")
			.forEach((control) => {
				control.parentElement?.classList.remove("rora-search-quality-heading");
				control.remove();
			});
		document
			.querySelectorAll<HTMLElement>("[data-rora-quality-filtered]")
			.forEach((element) => {
				element.hidden = false;
				delete element.dataset.roraQualityFiltered;
			});
	}

	private scheduleMount(): void {
		if (this.mountScheduled) return;
		this.mountScheduled = true;
		requestAnimationFrame(() => {
			this.mountScheduled = false;
			this.mount();
		});
	}

	private mount(): void {
		for (const heading of findRecentSearchHeadings()) {
			const host = heading.parentElement;
			const root = findSearchRoot(heading);
			if (!host || !root || host.querySelector(".rora-search-quality-control"))
				continue;
			const control = document.createElement("label");
			control.className = "rora-search-quality-control";
			control.append("Quality: ");
			const select = document.createElement("select");
			select.setAttribute("aria-label", "Search music by audio quality");
			for (const [value, label] of FILTER_OPTIONS) {
				const option = document.createElement("option");
				option.value = value;
				option.textContent = label;
				select.append(option);
			}
			control.append(select);
			host.classList.add("rora-search-quality-heading");
			host.append(control);
			select.addEventListener("change", () => {
				void this.apply(root, select.value as FilterValue);
			});
		}
	}

	private async apply(root: HTMLElement, selected: FilterValue): Promise<void> {
		const generation = ++this.generation;
		const links =
			root.querySelectorAll<HTMLAnchorElement>('a[href*="/track/"]');
		const targets = new Map<HTMLElement, string>();
		for (let i = 0; i < links.length; i++) {
			const link = links[i];
			const trackId = link.href.match(TRACK_ID_RE)?.[1];
			const target = getTrackTarget(link);
			if (trackId && target) targets.set(target, trackId);
		}
		for (const [target, trackId] of targets) {
			if (selected === "all") {
				target.hidden = false;
				delete target.dataset.roraQualityFiltered;
				continue;
			}
			try {
				const quality = await this.loadQuality(trackId);
				if (generation !== this.generation || !target.isConnected) return;
				const hidden = getQualityCategory(quality) !== selected;
				target.hidden = hidden;
				if (hidden) target.dataset.roraQualityFiltered = "true";
				else delete target.dataset.roraQualityFiltered;
			} catch {
				if (generation !== this.generation) return;
				target.hidden = true;
				target.dataset.roraQualityFiltered = "true";
			}
		}
	}
}
