/**
 * A minimal one-shot toast for plugin messages. Lives on the document, fades
 * in/out, and removes itself after the timeout. TIDAL doesn't expose a shared
 * toast API across all plugins, so we render our own DOM.
 */
const TOAST_DURATION_MS = 2500;

let activeToast: HTMLElement | null = null;
let activeTimeout: number | null = null;

export const showToast = (message: string): void => {
	if (activeToast) {
		activeToast.remove();
		activeToast = null;
	}
	if (activeTimeout !== null) {
		window.clearTimeout(activeTimeout);
		activeTimeout = null;
	}
	const toast = document.createElement("div");
	toast.className = "rora-mv-toast";
	toast.textContent = message;
	document.body.append(toast);
	activeToast = toast;
	// Force a reflow so the opacity transition runs.
	void toast.offsetHeight;
	toast.classList.add("rora-mv-toast-visible");
	activeTimeout = window.setTimeout(() => {
		toast.classList.remove("rora-mv-toast-visible");
		activeTimeout = window.setTimeout(() => {
			toast.remove();
			if (activeToast === toast) activeToast = null;
		}, 200);
	}, TOAST_DURATION_MS);
};

export const dismissToast = (): void => {
	if (activeTimeout !== null) {
		window.clearTimeout(activeTimeout);
		activeTimeout = null;
	}
	if (activeToast) {
		activeToast.remove();
		activeToast = null;
	}
};
