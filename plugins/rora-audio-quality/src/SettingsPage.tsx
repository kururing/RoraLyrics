import React from "react";
import { LunaSettings, LunaSwitchSetting } from "@luna/ui";
import { setSetting, settings, subscribeSettings } from "./settings";

type SwitchProps = React.ComponentProps<typeof LunaSwitchSetting>;
const Switch = LunaSwitchSetting as unknown as React.ComponentType<
	Omit<SwitchProps, "onChange"> & {
		checked: boolean;
		onChange: (_: unknown, checked: boolean) => void;
	}
>;

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
