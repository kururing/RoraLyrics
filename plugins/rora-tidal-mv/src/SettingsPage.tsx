import React from "react";
import { LunaSelectItem, LunaSelectSetting, LunaSettings, LunaSwitchSetting, LunaTextSetting } from "@luna/ui";
import { setSetting, settings, subscribeSettings, type MvQuality } from "./settings";

const qualityOptions: Array<{ value: MvQuality; label: string }> = [
	{ value: "auto", label: "Auto" },
	{ value: "hd720", label: "720p" },
	{ value: "hd1080", label: "1080p" },
	{ value: "highres", label: "Highest available" },
];

export const Settings = () => {
	const [, redraw] = React.useReducer((value) => value + 1, 0);
	React.useEffect(() => subscribeSettings(redraw), []);
	return (
		<LunaSettings>
			<LunaSwitchSetting
				title="Enable MV button"
				desc="Show the music video button in the player"
				checked={settings.enableMvButton}
				onChange={(_: unknown, checked: boolean) => setSetting("enableMvButton", checked)}
			/>
			<LunaTextSetting
				title="YouTube Data API key (optional)"
				desc="Used to find and rank official music videos"
				value={settings.youtubeApiKey}
				onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSetting("youtubeApiKey", event.target.value)}
			/>
			<LunaSwitchSetting
				title="Prefer official MV"
				desc="Rank official music videos above fan uploads"
				checked={settings.preferOfficialMv}
				onChange={(_: unknown, checked: boolean) => setSetting("preferOfficialMv", checked)}
			/>
			<LunaSelectSetting
				title="Open MV quality"
				desc="Suggested YouTube quality when the video opens"
				value={settings.mvQuality}
				onChange={(event: { target: { value: MvQuality } }) => setSetting("mvQuality", event.target.value)}
			>
				{qualityOptions.map((option) => (
					<LunaSelectItem key={option.value} value={option.value}>{option.label}</LunaSelectItem>
				))}
			</LunaSelectSetting>
			<LunaSwitchSetting
				title="Remember MV results"
				desc="Cache the video found for each track"
				checked={settings.rememberMvResults}
				onChange={(_: unknown, checked: boolean) => setSetting("rememberMvResults", checked)}
			/>
			<LunaSwitchSetting
				title="Resume TIDAL after closing MV"
				desc="Resume playback if it was playing before the MV opened"
				checked={settings.resumeTidalOnClose}
				onChange={(_: unknown, checked: boolean) => setSetting("resumeTidalOnClose", checked)}
			/>
		</LunaSettings>
	);
};
