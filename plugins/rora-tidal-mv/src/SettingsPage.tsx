import React from "react";
import { LunaSettings, LunaSwitchSetting, LunaTextSetting } from "@luna/ui";
import { setSetting, settings, subscribeSettings } from "./settings";

export const Settings = () => {
	const [, redraw] = React.useReducer((value) => value + 1, 0);
	React.useEffect(() => subscribeSettings(redraw), []);
	return <LunaSettings><LunaTextSetting title="YouTube Data API key (optional)" value={settings.youtubeApiKey} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSetting("youtubeApiKey", event.target.value)} /><LunaSwitchSetting title="Resume TIDAL after closing MV" checked={settings.resumeTidalOnClose} onChange={(_: unknown, checked: boolean) => setSetting("resumeTidalOnClose", checked)} /></LunaSettings>;
};
