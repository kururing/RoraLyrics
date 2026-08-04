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

// ===== STATE MANAGEMENT =====
interface LyricsState {
	songId: string | null;
	lyrics: any | null;
	isLoading: boolean;
	canSync: boolean;
	showSyncButton: boolean;
}

const state: LyricsState = {
	songId: null,
	lyrics: null,
	isLoading: false,
	canSync: false,
	showSyncButton: false,
};

// ===== CORE FUNCTIONS =====
function updateSyncState(): void {
	// Kiểm tra điều kiện hiển thị nút Sync
	const hasLyrics = state.lyrics !== null;
	const hasTimestamps = hasLyrics && 
		state.lyrics.timestamps && 
		Array.isArray(state.lyrics.timestamps) && 
		state.lyrics.timestamps.length > 0;
	
	state.canSync = !state.isLoading && hasLyrics && hasTimestamps;
	
	// Nút hiện khi: có thể sync HOẶC đang có lyrics (kể cả chưa có timestamp)
	state.showSyncButton = hasLyrics || state.canSync;
	
	console.log('[Rora] Sync state updated:', {
		hasLyrics,
		hasTimestamps,
		isLoading: state.isLoading,
		canSync: state.canSync,
		showSyncButton: state.showSyncButton,
		songId: state.songId
	});
	
	// Dispatch event để cập nhật UI
	window.dispatchEvent(new CustomEvent('rora-sync-state-update', {
		detail: {
			canSync: state.canSync,
			showSyncButton: state.showSyncButton,
			isLoading: state.isLoading
		}
	}));
}

// ===== EXPORTED FUNCTIONS =====
export function setSong(songId: string, hasLyrics: boolean = true): void {
	console.log('[Rora] Setting song:', songId, 'hasLyrics:', hasLyrics);
	
	state.songId = songId;
	state.lyrics = null;
	state.isLoading = true;
	state.canSync = false;
	state.showSyncButton = false;
	
	updateSyncState();
	
	if (!hasLyrics) {
		state.isLoading = false;
		updateSyncState();
		return;
	}
	
	// Giả lập tải lyrics
	setTimeout(() => {
		state.lyrics = {
			timestamps: [
				{ time: 0, text: 'Line 1' },
				{ time: 5, text: 'Line 2' },
				{ time: 10, text: 'Line 3' }
			]
		};
		state.isLoading = false;
		updateSyncState();
		
		console.log('[Rora] Lyrics loaded for song:', songId);
	}, 500);
}

export function getSyncState(): { canSync: boolean; showSyncButton: boolean } {
	return {
		canSync: state.canSync,
		showSyncButton: state.showSyncButton,
	};
}

// ===== MAIN INTEGRATION =====
export function integrateQuickSettings(
	unloads: Set<LunaUnload>,
	onSyncLyrics: () => void,
	canOpenLyrics: () => boolean,
	canSyncLyrics: () => boolean,
): void {
	
	// ===== INSTALL LYRICS MENU =====
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
			} else {
				closeMenu();
			}
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
			// Menu button chỉ ẩn khi không thể mở lyrics
			menuButton.hidden = !canOpenLyrics();
			if (menuButton.hidden) closeMenu();
		};
		
		const matchShape = (): void => {
			const rect = lyricsButton.getBoundingClientRect();
			if (rect.height > 0) {
				menuButton.style.width = `${rect.height}px`;
				menuButton.style.height = `${rect.height}px`;
			}
			menuButton.style.borderRadius = getComputedStyle(lyricsButton).borderRadius;
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
			document.removeEventListener("click", closeMenu);
			document.removeEventListener("keydown", closeFromEscape);
			menuButton.remove();
			menu.remove();
		});
	};

	// ===== INSTALL PANEL SYNC BUTTON =====
	const installPanelSync = (panel: HTMLElement): void => {
		const attach = (host: HTMLElement): void => {
			// Kiểm tra nút đã tồn tại
			if (host.querySelector(":scope > .rora-panel-sync-button")) {
				console.log('[Rora] Sync button already exists');
				return;
			}
			
			console.log('[Rora] Attaching sync button to host:', host);
			
			// Tạo nút
			const button = document.createElement("button");
			button.type = "button";
			button.className = "rora-panel-sync-button";
			button.textContent = "Sync Lyrics";
			
			// Cập nhật trạng thái nút
			const updateButton = (): void => {
				// Lấy state mới nhất
				const canSync = state.canSync;
				const show = state.showSyncButton;
				
				button.disabled = !canSync;
				
				// QUAN TRỌNG: Nút hiển thị khi showSyncButton = true
				// KHÔNG phụ thuộc vào menu lyrics
				if (show) {
					button.hidden = false;
				} else {
					button.hidden = true;
				}
				
				console.log('[Rora] Button update:', {
					canSync,
					show,
					disabled: button.disabled,
					hidden: button.hidden,
					text: button.textContent
				});
			};
			
			// Click handler
			button.addEventListener("click", () => {
				console.log('[Rora] Sync button clicked');
				if (state.canSync) {
					onSyncLyrics();
				} else {
					console.warn('[Rora] Cannot sync lyrics');
				}
			});
			
			// Append button vào host
			host.appendChild(button);
			
			// Đảm bảo host có position: relative
			if (getComputedStyle(host).position === 'static') {
				host.style.position = 'relative';
			}
			
			// Lắng nghe sự kiện cập nhật state
			const handleStateUpdate = (): void => {
				updateButton();
			};
			
			window.addEventListener('rora-sync-state-update', handleStateUpdate);
			
			// Update lần đầu
			updateButton();
			
			// Cleanup
			unloads.add(() => {
				window.removeEventListener('rora-sync-state-update', handleStateUpdate);
				button.remove();
				console.log('[Rora] Sync button removed');
			});
		};
		
		// Tìm host
		const existingHost = panel.querySelector<HTMLElement>(".rora-lyrics-host");
		if (existingHost) {
			attach(existingHost);
			return;
		}
		
		// Observer để chờ host xuất hiện
		const hostObserver = new MutationObserver(() => {
			const host = panel.querySelector<HTMLElement>(".rora-lyrics-host");
			if (host) {
				hostObserver.disconnect();
				attach(host);
			}
		});
		
		hostObserver.observe(panel, { 
			childList: true,
			subtree: true
		});
		
		const timeoutId = setTimeout(() => {
			hostObserver.disconnect();
			console.warn('[Rora] Lyrics host not found after timeout');
		}, 10000);
		
		unloads.add(() => {
			clearTimeout(timeoutId);
			hostObserver.disconnect();
		});
	};

	// ===== DETECT SONG CHANGE =====
	const detectSongChange = (): void => {
		let currentTitle = '';
		let currentArtist = '';
		
		const checkSong = (): void => {
			const titleEl = document.querySelector('[data-test="now-playing-title"]');
			const artistEl = document.querySelector('[data-test="now-playing-artist"]');
			
			if (titleEl && titleEl.textContent) {
				const title = titleEl.textContent.trim();
				const artist = artistEl ? artistEl.textContent?.trim() || '' : '';
				
				if (title !== currentTitle || artist !== currentArtist) {
					currentTitle = title;
					currentArtist = artist;
					
					console.log('[Rora] Song detected:', { title, artist });
					
					// Lấy song ID từ URL
					const url = window.location.href;
					const match = url.match(/\/track\/(\d+)/);
					const songId = match ? match[1] : `song-${Date.now()}`;
					
					// Update state
					setSong(songId, true);
				}
			}
		};
		
		// Check ngay lập tức
		checkSong();
		
		// Observer cho DOM changes
		const observer = new MutationObserver(() => {
			checkSong();
		});
		
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true
		});
		
		unloads.add(() => observer.disconnect());
	};

	// ===== INSTALL EVERYTHING =====
	
	// 1. Install lyrics menu
	document
		.querySelectorAll<HTMLElement>('[data-test="toggle-lyrics"]')
		.forEach(installLyricsMenu);
	observe<HTMLElement>(
		unloads,
		'[data-test="toggle-lyrics"]',
		installLyricsMenu,
	);
	
	// 2. Install panel sync button
	document
		.querySelectorAll<HTMLElement>('[data-test="now-playing-lyrics"]')
		.forEach(installPanelSync);
	observe<HTMLElement>(
		unloads,
		'[data-test="now-playing-lyrics"]',
		installPanelSync,
	);
	
	// 3. Detect song changes
	detectSongChange();
	
	// 4. Handle URL changes (SPA navigation)
	let lastUrl = location.href;
	const urlObserver = new MutationObserver(() => {
		if (location.href !== lastUrl) {
			lastUrl = location.href;
			console.log('[Rora] URL changed:', lastUrl);
			
			if (lastUrl.includes('/track/')) {
				setTimeout(() => {
					const panel = document.querySelector('[data-test="now-playing-lyrics"]');
					if (panel) {
						installPanelSync(panel as HTMLElement);
					}
				}, 500);
			}
		}
	});
	
	urlObserver.observe(document, { subtree: true, childList: true });
	unloads.add(() => urlObserver.disconnect());
	
	console.log('[Rora] Integration complete');
}