export const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

export const roundToPrecision = (value: number, precision: number): number =>
	Number(value.toFixed(precision));

export function normalizeNumericValue(
	value: number,
	min: number,
	max: number,
	precision: number,
): number | null {
	if (!Number.isFinite(value)) return null;
	return roundToPrecision(clamp(value, min, max), precision);
}
