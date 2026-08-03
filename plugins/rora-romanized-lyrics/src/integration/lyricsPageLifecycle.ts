import type { LunaUnload } from "@luna/core";
import { observe } from "@luna/lib";

export interface LyricsPageLifecycleCallbacks {
	onEnter: () => void;
	onLeave: () => void;
}

export function observeLyricsPageLifecycle(
	unloads: Set<LunaUnload>,
	callbacks: LyricsPageLifecycleCallbacks,
): void {
	const installed = new WeakSet<HTMLElement>();
	const install = (toggle: HTMLElement): void => {
		if (installed.has(toggle)) return;
		installed.add(toggle);
		let previous = toggle.getAttribute("aria-pressed") === "true";
		const synchronize = (): void => {
			const active = toggle.getAttribute("aria-pressed") === "true";
			if (active === previous) return;
			previous = active;
			if (active) callbacks.onEnter();
			else callbacks.onLeave();
		};
		const observer = new MutationObserver(synchronize);
		observer.observe(toggle, {
			attributes: true,
			attributeFilter: ["aria-pressed"],
		});
		unloads.add(() => observer.disconnect());
		if (previous) callbacks.onEnter();
	};
	document
		.querySelectorAll<HTMLElement>('[data-test="toggle-lyrics"]')
		.forEach(install);
	observe<HTMLElement>(unloads, '[data-test="toggle-lyrics"]', install);
}
