import type { LunaUnload } from "@luna/core";
import { observe } from "@luna/lib";
import {
	setSetting,
	settings,
	subscribeSettings,
} from "../settings/settingsStore";

const layerControls = [
	["showOriginal", "Main lyrics"],
	["showRomanized", "Romanized lyrics"],
] as const;

export function integrateQuickSettings(
	unloads: Set<LunaUnload>,
	onSyncLyrics: () => void,
	canOpenLyrics: () => boolean,
	canSyncLyrics: () => boolean,
): void {
	const installLyricsMenu = (lyricsButton: HTMLElement): void => {
		const parent = lyricsButton.parentElement;
		if (!parent || parent.querySelector(":scope > .rora-lyrics-menu-button"))
			return;
		const menuButton = document.createElement("button");
		menuButton.type = "button";
		menuButton.className = "rora-lyrics-menu-button";
		menuButton.textContent = "\u22ef";
		menuButton.title = "Lyrics display options";
		menuButton.setAttribute("aria-label", "Lyrics display options");
		menuButton.setAttribute("aria-expanded", "false");
		const menu = document.createElement("div");
		menu.className = "rora-lyrics-menu";
		menu.hidden = true;
		menu.setAttribute("role", "menu");
		const inputs = new Map<string, HTMLInputElement>();
		for (const [key, labelText] of layerControls) {
			const label = document.createElement("label");
			label.className = "rora-lyrics-menu-row";
			const text = document.createElement("span");
			text.textContent = labelText;
			const input = document.createElement("input");
			input.type = "checkbox";
			input.setAttribute("role", "switch");
			input.setAttribute("aria-label", labelText);
			input.checked = settings[key];
			input.addEventListener("change", () => setSetting(key, input.checked));
			const track = document.createElement("span");
			track.className = "rora-switch-track";
			track.setAttribute("aria-hidden", "true");
			inputs.set(key, input);
			const control = document.createElement("span");
			control.className = "rora-switch";
			control.append(input, track);
			label.append(text, control);
			menu.appendChild(label);
		}
		const closeMenu = (): void => {
			menu.hidden = true;
			menuButton.setAttribute("aria-expanded", "false");
		};
		const placeMenu = (): void => {
			const rect = menuButton.getBoundingClientRect();
			const width = menu.offsetWidth || 210;
			const height = menu.offsetHeight || 100;
			menu.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))}px`;
			const above = rect.top - height - 8;
			menu.style.top = `${Math.max(8, above >= 8 ? above : Math.min(window.innerHeight - height - 8, rect.bottom + 8))}px`;
		};
		menuButton.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (menu.hidden) {
				menu.hidden = false;
				placeMenu();
				menuButton.setAttribute("aria-expanded", "true");
			} else closeMenu();
		});
		menu.addEventListener("click", (event) => event.stopPropagation());
		const closeFromEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeMenu();
		};
		document.addEventListener("click", closeMenu);
		document.addEventListener("keydown", closeFromEscape);
		lyricsButton.insertAdjacentElement("afterend", menuButton);
		document.body.appendChild(menu);
		const updateVisibility = (): void => {
			menuButton.hidden = !canOpenLyrics();
			if (menuButton.hidden) closeMenu();
		};
		const matchShape = (): void => {
			const rect = lyricsButton.getBoundingClientRect();
			if (rect.height > 0) {
				menuButton.style.width = `${rect.height}px`;
				menuButton.style.height = `${rect.height}px`;
			}
			menuButton.style.borderRadius =
				getComputedStyle(lyricsButton).borderRadius;
		};
		const shapeFrame = requestAnimationFrame(matchShape);
		window.addEventListener("resize", matchShape);
		window.addEventListener("rora-sync-state", updateVisibility);
		const unsubscribe = subscribeSettings(() => {
			for (const [key] of layerControls) {
				const input = inputs.get(key);
				if (input) input.checked = settings[key];
			}
		});
		updateVisibility();
		unloads.add(() => {
			cancelAnimationFrame(shapeFrame);
			unsubscribe();
			window.removeEventListener("resize", matchShape);
			window.removeEventListener("rora-sync-state", updateVisibility);
			document.removeEventListener("click", closeMenu);
			document.removeEventListener("keydown", closeFromEscape);
			menuButton.remove();
			menu.remove();
		});
	};

	// `.rora-lyrics-host` đã là `position: relative` (xem styles.css), nên nút
	// được neo trực tiếp vào đó thay vì quét toàn bộ document để "đoán" vị trí
	// các control của TIDAL — đó chính là lý do cơ chế cũ dễ vỡ mỗi khi layout
	// thanh player của TIDAL thay đổi.
	const installPanelSync = (panel: HTMLElement): void => {
		const attach = (host: HTMLElement): void => {
			if (host.querySelector(":scope > .rora-panel-sync-button")) return;
			const button = document.createElement("button");
			button.type = "button";
			button.className = "rora-panel-sync-button";
			button.textContent = "Sync Lyrics";
			let needed = false;
			const update = (): void => {
				button.disabled = !canSyncLyrics();
				button.hidden = !needed || button.disabled;
			};
			const updateNeeded = (event: Event): void => {
				needed =
					(event as CustomEvent<{ needed?: boolean }>).detail?.needed ===
					true;
				update();
			};
			button.addEventListener("click", () => {
				if (canSyncLyrics()) onSyncLyrics();
			});
			host.appendChild(button);
			window.addEventListener("rora-sync-state", update);
			window.addEventListener("rora-sync-needed", updateNeeded);
			update();
			unloads.add(() => {
				window.removeEventListener("rora-sync-state", update);
				window.removeEventListener("rora-sync-needed", updateNeeded);
				button.remove();
			});
		};
		// `.rora-lyrics-host` có thể chưa tồn tại ở lần đầu panel được observe
		// (nó được tạo bất đồng bộ bởi mount() trong index.ts), nên chờ nó
		// xuất hiện thay vì giả định lúc nào cũng có sẵn.
		const existingHost = panel.querySelector<HTMLElement>(".rora-lyrics-host");
		if (existingHost) {
			attach(existingHost);
			return;
		}
		const hostObserver = new MutationObserver(() => {
			const host = panel.querySelector<HTMLElement>(".rora-lyrics-host");
			if (host) {
				hostObserver.disconnect();
				attach(host);
			}
		});
		hostObserver.observe(panel, { childList: true });
		unloads.add(() => hostObserver.disconnect());
	};

	document
		.querySelectorAll<HTMLElement>('[data-test="toggle-lyrics"]')
		.forEach(installLyricsMenu);
	observe<HTMLElement>(
		unloads,
		'[data-test="toggle-lyrics"]',
		installLyricsMenu,
	);
	document
		.querySelectorAll<HTMLElement>('[data-test="now-playing-lyrics"]')
		.forEach(installPanelSync);
	observe<HTMLElement>(
		unloads,
		'[data-test="now-playing-lyrics"]',
		installPanelSync,
	);
}
