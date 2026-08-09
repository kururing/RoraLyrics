const MARKER = "data-rora-tidal-mv";
const QUALITY_SELECTOR = "[data-test-media-state-indicator-streaming-quality]";
const CONTROL_SELECTORS = ['[data-test="volume-control"]', '[data-test="device-picker"]', 'button[aria-label*="volume" i]', 'button[aria-label*="device" i]'];

export class NowPlayingButton {
	private observer: MutationObserver | null = null;
	private button: HTMLButtonElement | null = null;
	private scanQueued = false;

	constructor(private readonly onClick: () => void) {}

	mount(): void {
		this.scan();
		this.observer = new MutationObserver(() => this.queueScan());
		this.observer.observe(document.body, { childList: true, subtree: true });
	}

	destroy(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.button?.remove();
		this.button = null;
		document.querySelectorAll(`[${MARKER}]`).forEach((element) => element.remove());
	}

	private queueScan(): void {
		if (this.scanQueued) return;
		this.scanQueued = true;
		queueMicrotask(() => { this.scanQueued = false; this.scan(); });
	}

	private scan(): void {
		if (this.button?.isConnected) return;
		const footer = document.querySelector<HTMLElement>("#footerPlayer");
		if (!footer) return;
		const qualityIndicator = footer.querySelector<HTMLElement>(QUALITY_SELECTOR);
		const qualityPill = qualityIndicator?.parentElement;
		const qualityHost = qualityPill?.parentElement;
		let nearbyControl: HTMLElement | null = null;
		for (const selector of CONTROL_SELECTORS) {
			nearbyControl = footer.querySelector<HTMLElement>(selector);
			if (nearbyControl) break;
		}
		const host = qualityHost ?? nearbyControl?.parentElement;
		if (!host) return;
		const button = document.createElement("button");
		button.type = "button";
		button.className = "rora-mv-button";
		button.setAttribute(MARKER, "");
		button.title = "Open music video";
		button.ariaLabel = "Open music video for current track";
		button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h11a2 2 0 0 1 2 2v2.2l3.2-2.1A.5.5 0 0 1 21 7.5v9a.5.5 0 0 1-.8.4L17 14.8V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>';
		button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); this.onClick(); });
		if (qualityPill && qualityPill.parentElement === host) host.insertBefore(button, qualityPill);
		else if (nearbyControl) nearbyControl.insertAdjacentElement("afterend", button);
		else host.append(button);
		this.button = button;
	}
}
