import {
	LunaSelectItem,
	LunaSelectSetting,
	LunaSettings,
	LunaSwitchSetting,
} from "@luna/ui";
import React from "react";
import { setSetting, settings, subscribeSettings } from "./settings";
import type { DisplayMode, UnknownDisplay } from "./types";

type SwitchProps = React.ComponentProps<typeof LunaSwitchSetting>;
const Switch = LunaSwitchSetting as unknown as React.ComponentType<
	Omit<SwitchProps, "onChange"> & {
		checked: boolean;
		onChange: (_: unknown, checked: boolean) => void;
	}
>;
type SelectProps = React.ComponentProps<typeof LunaSelectSetting>;
const Select = LunaSelectSetting as unknown as React.ComponentType<
	Omit<SelectProps, "onChange"> & {
		value: string;
		onChange: (event: { target: { value: string } }) => void;
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
			<Select
				title="Display mode"
				desc="Choose full, compact, or catalog-only labels"
				value={settings.displayMode}
				onChange={(event) =>
					setSetting("displayMode", event.target.value as DisplayMode)
				}
			>
				<LunaSelectItem value="full">Full</LunaSelectItem>
				<LunaSelectItem value="compact">Compact</LunaSelectItem>
				<LunaSelectItem value="catalog">Catalog label only</LunaSelectItem>
			</Select>
			<Switch
				title="Show codec"
				desc="Append codec when confirmed playback metadata provides it"
				checked={settings.showCodec}
				onChange={(_, value) => setSetting("showCodec", value)}
			/>
			<Switch
				title="Show tooltip details"
				desc="Show source, confirmation, and codec details"
				checked={settings.showTooltip}
				onChange={(_, value) => setSetting("showTooltip", value)}
			/>
			<Select
				title="Unknown quality display"
				desc="Show a dash or hide unavailable quality"
				value={settings.unknownDisplay}
				onChange={(event) =>
					setSetting("unknownDisplay", event.target.value as UnknownDisplay)
				}
			>
				<LunaSelectItem value="dash">Dash</LunaSelectItem>
				<LunaSelectItem value="hide">Hide</LunaSelectItem>
			</Select>
			<Switch
				title="Debug logging"
				desc="Log IDs, safe metadata fields, cache state, and injection status"
				checked={settings.debugLogging}
				onChange={(_, value) => setSetting("debugLogging", value)}
			/>
		</LunaSettings>
	);
};
