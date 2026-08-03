import React from "react";
import { setSetting, settings, subscribeSettings } from "./settings";

const LunaSettings = ({ children }: React.PropsWithChildren) => (
	<div className="rora-settings">{children}</div>
);
const Switch = ({
	title,
	desc,
	checked,
	onChange,
}: {
	title: string;
	desc: string;
	checked: boolean;
	onChange: (_: unknown, checked: boolean) => void;
}) => (
	<label className="rora-setting-switch-row">
		<span className="rora-setting-copy">
			<strong>{title}</strong>
			<small>{desc}</small>
		</span>
		<input
			type="checkbox"
			role="switch"
			aria-checked={checked}
			checked={checked}
			onChange={(event) => onChange(event, event.currentTarget.checked)}
		/>
	</label>
);

export const Settings = () => {
	const [, redraw] = React.useReducer((value) => value + 1, 0);
	React.useEffect(() => subscribeSettings(redraw), []);
	return (
		<LunaSettings>
			<Switch
				title="Enable track-list quality column"
				desc="Add QUALITY before TIME in shared track tables"
				checked={settings.enableTrackList}
				onChange={(_, value) => setSetting("enableTrackList", value)}
			/>
			<Switch
				title="Enable now-playing quality"
				desc="Show confirmed stream quality beside TIDAL's quality indicator"
				checked={settings.enableNowPlaying}
				onChange={(_, value) => setSetting("enableNowPlaying", value)}
			/>
		</LunaSettings>
	);
};
