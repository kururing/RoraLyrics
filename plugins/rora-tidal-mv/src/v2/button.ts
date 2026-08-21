import type { Button, ButtonState } from "./types";

const BUTTON_STATE_TITLE: Record<ButtonState, string> = {
	idle: "Open music video",
	loading: "Loading music video…",
	"no-mv": "No music video available",
};

const VIDEO_ICON =
	'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h11a2 2 0 0 1 2 2v2l4-2v10l-4-2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>';

/**
 * Mount a play button in TIDAL's footer player.
 *
 * The footer DOM is fully replaced by TIDAL on every track change, so the
 * button is re-mounted via a MutationObserver. The observer is scoped to
 * `#footerPlayer` (when present) so we don't pay for every mutation in the
 * whole document — TIDAL's queue and other virtualised lists can mutate
 * hundreds of times per second.
 */
export const mountFooterButton = (onClick: () => void): Button => {
	let button: HTMLButtonElement | null = null;
	let state: ButtonState = "idle";
	let footerObserver: MutationObserver | null = null;
	let parentObserver: MutationObserver | null = null;
	let bodyObserver: MutationObserver | null = null;

	let observedFooter: HTMLElement | null = null;
	let observedParent: HTMLElement | null = null;

	const applyState = () => {
		if (!button) return;
		button.classList.toggle("rora-mv-loading", state === "loading");
		button.classList.toggle("rora-mv-no-mv", state === "no-mv");
		button.disabled = state !== "idle";
		button.title = BUTTON_STATE_TITLE[state];
		button.ariaLabel = BUTTON_STATE_TITLE[state];
	};

	const setupObservers = (footer: HTMLElement) => {
		if (bodyObserver) {
			bodyObserver.disconnect();
			bodyObserver = null;
		}

		if (observedFooter !== footer) {
			if (footerObserver) {
				footerObserver.disconnect();
			} else {
				footerObserver = new MutationObserver(() => {
					if (!button?.isConnected) {
						mount();
					}
				});
			}
			footerObserver.observe(footer, { childList: true, subtree: true });
			observedFooter = footer;
		}

		const parent = footer.parentElement;
		if (parent && observedParent !== parent) {
			if (parentObserver) {
				parentObserver.disconnect();
			} else {
				parentObserver = new MutationObserver(() => {
					const currentFooter =
						document.querySelector<HTMLElement>("#footerPlayer");
					if (currentFooter && currentFooter !== observedFooter) {
						setupObservers(currentFooter);
						mount();
					} else if (!button?.isConnected) {
						mount();
					}
				});
			}
			parentObserver.disconnect();
			parentObserver.observe(parent, { childList: true });
			observedParent = parent;
		}
	};

	const mount = () => {
		const footer = document.querySelector<HTMLElement>("#footerPlayer");
		if (!footer) {
			observedFooter = null;
			observedParent = null;
			footerObserver?.disconnect();
			footerObserver = null;
			parentObserver?.disconnect();
			parentObserver = null;
			if (!bodyObserver) {
				bodyObserver = new MutationObserver(() => {
					if (document.querySelector("#footerPlayer")) {
						mount();
					}
				});
				bodyObserver.observe(document.body, { childList: true, subtree: true });
			}
			return;
		}

		setupObservers(footer);

		if (button?.isConnected) return;

		const quality = footer.querySelector<HTMLElement>(
			"[data-test-media-state-indicator-streaming-quality]",
		)?.parentElement;
		const controls = [
			...footer.querySelectorAll<HTMLElement>('button, [role="button"]'),
		];
		const anchor =
			controls.find((element) =>
				/volume|device|queue|mini|quality/i.test(
					`${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("data-test") ?? ""}`,
				),
			) ??
			controls.at(-1) ??
			null;
		const host = quality?.parentElement ?? anchor?.parentElement;
		if (!host) return;

		if (!button) {
			button = document.createElement("button");
			button.type = "button";
			button.dataset.roraTidalMv = "button";
			button.className = "rora-mv-button";
			button.innerHTML = VIDEO_ICON;
			button.addEventListener("click", onClick);
		}

		if (quality?.parentElement === host) {
			host.insertBefore(button, quality);
		} else if (anchor?.parentElement === host) {
			anchor.insertAdjacentElement("afterend", button);
		} else {
			host.append(button);
		}
		applyState();
	};

	mount();

	return {
		unmount: () => {
			footerObserver?.disconnect();
			footerObserver = null;
			parentObserver?.disconnect();
			parentObserver = null;
			bodyObserver?.disconnect();
			bodyObserver = null;
			observedFooter = null;
			observedParent = null;
			button?.remove();
			document
				.querySelectorAll('[data-rora-tidal-mv="button"]')
				.forEach((element) => {
					element.remove();
				});
			button = null;
		},
		setState: (next: ButtonState) => {
			state = next;
			applyState();
		},
		ensureMounted: () => {
			mount();
		},
	};
};
