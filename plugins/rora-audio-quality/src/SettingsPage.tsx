import { LunaSettings, LunaSwitchSetting } from "@luna/ui";
import React from "react";
import { setSetting, settings, subscribeSettings } from "./settings";

type SwitchProps = React.ComponentProps<typeof LunaSwitchSetting>;
const Switch = LunaSwitchSetting as unknown as React.ComponentType<
	Omit<SwitchProps, "onChange"> & {
		checked: boolean;
		disabled?: boolean;
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
				title="Quality display"
				desc="Choose whether to show a quality name or the original specs"
				checked={settings.qualityDisplay}
				onChange={(_, value) => setSetting("qualityDisplay", value)}
			/>
			<Switch
				title="Name only"
				desc="Example: Hi-Res"
				disabled={!settings.qualityDisplay}
				checked={settings.qualityDisplayMode === "name"}
				onChange={(_, value) => {
					if (value) setSetting("qualityDisplayMode", "name");
				}}
			/>
			<Switch
				title="Detailed"
				desc="Example: 24-bit / 96 kHz"
				disabled={!settings.qualityDisplay}
				checked={settings.qualityDisplayMode === "detailed"}
				onChange={(_, value) => {
					if (value) setSetting("qualityDisplayMode", "detailed");
				}}
			/>
			<Switch
				title="Search quality filter"
				desc="Show a Quality filter in music search"
				checked={settings.enableSearchQualityFilter}
				onChange={(_, value) => setSetting("enableSearchQualityFilter", value)}
			/>
		</LunaSettings>
	);
};
