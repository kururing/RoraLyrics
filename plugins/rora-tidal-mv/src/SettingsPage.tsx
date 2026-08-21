import React from "react";
import { LunaSettings, LunaSwitchSetting } from "@luna/ui";
import { setSetting, settings, subscribeSettings } from "./settings";

export const Settings = () => {
	const [, redraw] = React.useReducer((value) => value + 1, 0);
	React.useEffect(() => subscribeSettings(redraw), []);
	return (
		<LunaSettings>
			<LunaSwitchSetting
				title="Enable MV button"
				desc="Show the music video button in the player"
				checked={settings.enableMvButton}
				onChange={(_: unknown, checked: boolean) =>
					setSetting("enableMvButton", checked)
				}
			/>
		</LunaSettings>
	);
};
