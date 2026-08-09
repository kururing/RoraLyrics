import type { CurrentTrack } from "./search";
import type { PlayerController } from "./bridge";

export const mountFooterButton = (onClick: () => void): (() => void) => {
	let button: HTMLButtonElement | null = null;
	const mount = () => {
		if (button?.isConnected) return;
		const footer = document.querySelector<HTMLElement>("#footerPlayer");
		if (!footer) return;
		const quality = footer?.querySelector<HTMLElement>("[data-test-media-state-indicator-streaming-quality]")?.parentElement;
		const controls = [...footer.querySelectorAll<HTMLElement>('button, [role="button"]')];
		const anchor = controls.find(element => /volume|device|queue|mini|quality/i.test(`${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("data-test") ?? ""}`)) ?? controls.at(-1) ?? null;
		const host = quality?.parentElement ?? anchor?.parentElement;
		if (!host) return;
		button = document.createElement("button"); button.type = "button"; button.dataset.roraTidalMv = "button"; button.className = "rora-mv-button"; button.title = "Open current music video"; button.ariaLabel = button.title; button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h11a2 2 0 0 1 2 2v2l4-2v10l-4-2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>'; button.addEventListener("click", onClick);
		if (quality?.parentElement === host) host.insertBefore(button, quality); else if (anchor?.parentElement === host) anchor.insertAdjacentElement("afterend", button); else host.append(button);
	};
	mount(); const observer = new MutationObserver(mount); observer.observe(document.body, { childList: true, subtree: true });
	return () => { observer.disconnect(); button?.remove(); document.querySelectorAll('[data-rora-tidal-mv="button"]').forEach(element => element.remove()); button = null; };
};

export class Modal {
	private dialog: HTMLDialogElement | null = null;
	private player: PlayerController | null = null;
	private events = new AbortController();
	constructor(private readonly closed: () => void) {}
	show(track: CurrentTrack): HTMLElement { this.destroy(false); this.events = new AbortController(); const d = document.createElement("dialog"); d.className = "rora-mv-dialog"; const h = document.createElement("div"); h.className = "rora-mv-head"; const t = document.createElement("strong"); t.textContent = `${track.artist} — ${track.title}`; const x = document.createElement("button"); x.className = "rora-mv-close"; x.textContent = "×"; x.ariaLabel = "Close"; x.addEventListener("click", () => this.destroy(true), { signal: this.events.signal }); h.append(t, x); const body = document.createElement("div"); body.className = "rora-mv-frame"; d.append(h, body); d.addEventListener("cancel", e => { e.preventDefault(); this.destroy(true); }, { signal: this.events.signal }); document.body.append(d); d.showModal(); this.dialog = d; return body; }
	attach(player: PlayerController): void { this.player = player; if (!this.dialog) player.destroy(); }
	error(message: string): void { const body = this.dialog?.querySelector(".rora-mv-frame"); if (body) body.textContent = message; }
	destroy(notify: boolean): void { const existed = Boolean(this.dialog); this.events.abort(); this.player?.destroy(); this.player = null; this.dialog?.remove(); this.dialog = null; if (notify && existed) this.closed(); }
}
