import React from "react";
import { normalizeNumericValue } from "../settings/numeric";

export interface NumericSettingControlProps {
	label: string;
	description?: string;
	value: number;
	min: number;
	max: number;
	step: number;
	unit?: string;
	precision?: number;
	onChange: (value: number) => void;
	onReset?: () => void;
}

const formatValue = (value: number, precision: number): string =>
	precision === 0 ? String(Math.round(value)) : value.toFixed(precision);

export function NumericSettingControl({
	label,
	description,
	value,
	min,
	max,
	step,
	unit,
	precision = 0,
	onChange,
	onReset,
}: NumericSettingControlProps) {
	const [draft, setDraft] = React.useState(() => formatValue(value, precision));
	const [editing, setEditing] = React.useState(false);
	const latestValue = React.useRef(value);
	const cancelBlur = React.useRef(false);

	React.useEffect(() => {
		latestValue.current = value;
		if (!editing) setDraft(formatValue(value, precision));
	}, [value, precision, editing]);

	const apply = React.useCallback(
		(next: number): void => {
			const normalized = normalizeNumericValue(next, min, max, precision);
			if (normalized === null) return;
			latestValue.current = normalized;
			setDraft(formatValue(normalized, precision));
			onChange(normalized);
		},
		[min, max, precision, onChange],
	);

	const commitDraft = (): void => {
		if (cancelBlur.current) {
			cancelBlur.current = false;
			setDraft(formatValue(latestValue.current, precision));
			setEditing(false);
			return;
		}
		const parsed = Number.parseFloat(draft);
		if (Number.isFinite(parsed)) apply(parsed);
		else setDraft(formatValue(latestValue.current, precision));
		setEditing(false);
	};

	const stepBy = (direction: -1 | 1): void => {
		setEditing(false);
		apply(latestValue.current + direction * step);
	};

	return (
		<div className="rora-numeric-setting">
			<div className="rora-setting-copy">
				<strong>{label}</strong>
				{description && <small>{description}</small>}
			</div>
			<div className="rora-number-control">
				<button
					type="button"
					aria-label={`Decrease ${label}`}
					onClick={() => stepBy(-1)}
				>
					−
				</button>
				<div className="rora-number-input-wrap">
					<input
						type="text"
						inputMode="decimal"
						aria-label={label}
						value={draft}
						onFocus={() => setEditing(true)}
						onChange={(event) => setDraft(event.target.value)}
						onBlur={commitDraft}
						onKeyDown={(event) => {
							if (event.key === "Enter") event.currentTarget.blur();
							if (event.key === "Escape") {
								cancelBlur.current = true;
								setDraft(formatValue(latestValue.current, precision));
								setEditing(false);
								event.currentTarget.blur();
							}
						}}
					/>
					{unit && <span>{unit}</span>}
				</div>
				<button
					type="button"
					aria-label={`Increase ${label}`}
					onClick={() => stepBy(1)}
				>
					+
				</button>
				{onReset && (
					<button type="button" className="rora-reset" onClick={onReset}>
						Reset
					</button>
				)}
			</div>
		</div>
	);
}
