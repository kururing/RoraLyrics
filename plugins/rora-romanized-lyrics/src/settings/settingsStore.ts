import { ReactiveStore } from "@luna/core";

export const settings = await ReactiveStore.getPluginStorage(
	"RoraRomanizedLyrics",
	{
		schemaVersion: 1,
		showOriginal: true,
		showRomanized: true,
		showTimestamp: false,
		preferSynchronized: true,
		showSourceBadge: true,
		fontSize: 30,
		lineSpacing: 1.35,
		romanizedOpacity: 0.7,
		syncOffsetMs: 0,
		debugLogging: false,
	},
);

const validNumber = (
	value: unknown,
	fallback: number,
	minimum: number,
	maximum: number,
): number =>
	typeof value === "number" && Number.isFinite(value)
		? Math.min(maximum, Math.max(minimum, value))
		: fallback;

// Repair values written by older builds and clamp manually edited storage.
const storedFontSize: unknown = settings.fontSize;
settings.fontSize =
	typeof storedFontSize === "number" && storedFontSize > 64
		? validNumber((storedFontSize / 100) * 30, 30, 12, 64)
		: validNumber(storedFontSize, 30, 12, 64);
settings.lineSpacing = validNumber(settings.lineSpacing, 1.35, 0.8, 3);
settings.romanizedOpacity = validNumber(settings.romanizedOpacity, 0.7, 0, 1);
settings.syncOffsetMs = validNumber(settings.syncOffsetMs, 0, -5000, 5000);

type Listener = () => void;
const listeners = new Set<Listener>();
export const notifySettingsChanged = (): void => {
	for (const listener of listeners) listener();
};
export const subscribeSettings = (listener: Listener): (() => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
export const setSetting = <K extends keyof typeof settings>(
	key: K,
	value: (typeof settings)[K],
): void => {
	settings[key] = value;
	notifySettingsChanged();
};
