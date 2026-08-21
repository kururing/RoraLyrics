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

export interface RoraLyricsIntegration {
	setLyricsOpen: (open: boolean) => void;
	setSyncNeeded: (needed: boolean) => void;
	updateAvailability: () => void;
}

export function integrateRoraLyrics(
	unloads: Set<LunaUnload>,
	onSyncLyrics: () => void,
	canOpenLyrics: () => boolean,
	canSyncLyrics: () => boolean,
): RoraLyricsIntegration {
	let lyricsOpen = false;
	let syncNeeded = false;
	let updateSyncButton: () => void = () => undefined;
	const installLyricsMenu = (lyricsButton: HTMLElement): void => {
		const parent = lyricsButton.parentElement;
		if (!parent || parent.querySelector(":scope > .rora-lyrics-menu-button"))
			return;
		// Read the native tab size before adding our sibling. A taller menu button
		// would otherwise stretch the controls row and make the active Lyrics pill
		// taller than the Credits pill.
		const lyricsRect = lyricsButton.getBoundingClientRect();
		const lyricsBorderRadius = getComputedStyle(lyricsButton).borderRadius;
		const menuButton = document.createElement("button");
		menuButton.type = "button";
		menuButton.className = "rora-lyrics-menu-button";
		if (lyricsRect.height > 0) {
			menuButton.style.width = `${lyricsRect.height}px`;
			menuButton.style.height = `${lyricsRect.height}px`;
		}
		menuButton.style.borderRadius = lyricsBorderRadius;
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
			const lyricsOpen = lyricsButton.getAttribute("aria-pressed") === "true";
			menuButton.hidden = !lyricsOpen || !canOpenLyrics();
			if (menuButton.hidden) closeMenu();
		};
		const lyricsStateObserver = new MutationObserver(updateVisibility);
		lyricsStateObserver.observe(lyricsButton, {
			attributes: true,
			attributeFilter: ["aria-pressed"],
		});
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
			lyricsStateObserver.disconnect();
			document.removeEventListener("click", closeMenu);
			document.removeEventListener("keydown", closeFromEscape);
			menuButton.remove();
			menu.remove();
		});
	};

	let syncButton: HTMLButtonElement | null = null;
	let syncButtonObserver: MutationObserver | null = null;
	let syncButtonScanQueued = false;
	let syncButtonDisposed = false;
	let ensureSyncButtonPosition: (() => void) | null = null;
	let hideFromOutsideClick: ((event: MouseEvent) => void) | null = null;
	const installPanelSync = (): void => {
		if (syncButton) return;
		const button = document.createElement("button");
		button.type = "button";
		button.className = "rora-panel-sync-button";
		button.textContent = "Sync Lyrics";
		const place = (): void => {
			if (syncButtonDisposed) return;
			// Anchor: panel lyrics — data-test ổn định của khu vực Lyrics. Nút được
			// gắn vào panel (position: absolute ở góc dưới phải trong CSS) để luôn
			// nằm cố định, không cuộn theo nội dung lyrics; khi TIDAL re-render,
			// observer gắn lại chính nút này vào panel mới.
			const panel = document.querySelector<HTMLElement>(
				'[data-test="now-playing-lyrics"]',
			);
			if (!panel) return;

			const existing = document.querySelector<HTMLButtonElement>(
				".rora-panel-sync-button",
			);
			if (existing && existing !== button) return;
			if (button.parentElement === panel) return;
			panel.append(button);
		};
		button.addEventListener("click", () => {
			if (canSyncLyrics()) onSyncLyrics();
		});
		syncButton = button;
		updateSyncButton = (): void => {
			button.disabled = !canSyncLyrics();
			const visible =
				lyricsOpen && canOpenLyrics() && canSyncLyrics() && syncNeeded;
			button.hidden = !visible;
			button.classList.toggle("rora-sync-visible", visible);
			place();
		};
		ensureSyncButtonPosition = place;
		const queuePlacement = (): void => {
			if (syncButtonScanQueued || syncButtonDisposed) return;
			syncButtonScanQueued = true;
			requestAnimationFrame(() => {
				syncButtonScanQueued = false;
				place();
			});
		};
		syncButtonObserver = new MutationObserver(queuePlacement);
		syncButtonObserver.observe(document.body, {
			childList: true,
			subtree: true,
		});
		place();
		window.addEventListener("resize", place);
		hideFromOutsideClick = (event: MouseEvent): void => {
			if (event.target instanceof Node && button.contains(event.target)) return;
			updateSyncButton();
		};
		document.addEventListener("click", hideFromOutsideClick, true);
		updateSyncButton();
	};

	document
		.querySelectorAll<HTMLElement>('[data-test="toggle-lyrics"]')
		.forEach(installLyricsMenu);
	observe<HTMLElement>(
		unloads,
		'[data-test="toggle-lyrics"]',
		installLyricsMenu,
	);
	installPanelSync();
	unloads.add(() => {
		syncButtonDisposed = true;
		syncButtonObserver?.disconnect();
		syncButton?.remove();
		if (ensureSyncButtonPosition)
			window.removeEventListener("resize", ensureSyncButtonPosition);
		if (hideFromOutsideClick)
			document.removeEventListener("click", hideFromOutsideClick, true);
		hideFromOutsideClick = null;
		ensureSyncButtonPosition = null;
		syncButtonObserver = null;
		syncButton = null;
		updateSyncButton = () => undefined;
	});
	return {
		setLyricsOpen: (open) => {
			lyricsOpen = open;
			if (!open) syncNeeded = false;
			updateSyncButton();
		},
		setSyncNeeded: (needed) => {
			syncNeeded = needed;
			updateSyncButton();
		},
		updateAvailability: updateSyncButton,
	};
}
