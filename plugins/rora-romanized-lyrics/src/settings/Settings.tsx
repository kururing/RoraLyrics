import { LunaSettings, LunaSwitchSetting } from "@luna/ui";
import React from "react";
import { NumericSettingControl } from "../components/NumericSettingControl";
import { setSetting, settings, subscribeSettings } from "./settingsStore";

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
				title="Show original lyrics"
				desc="Display the original script"
				checked={settings.showOriginal}
				onChange={(_, value) => setSetting("showOriginal", value)}
			/>
			<Switch
				title="Show romanized lyrics"
				desc="Display a local Latin-script reading"
				checked={settings.showRomanized}
				onChange={(_, value) => setSetting("showRomanized", value)}
			/>
			<Switch
				title="Show timestamp"
				desc="Display timestamps for synchronized lyrics"
				checked={settings.showTimestamp}
				onChange={(_, value) => setSetting("showTimestamp", value)}
			/>
			<Switch
				title="Prefer synchronized lyrics"
				desc="Prefer timed lyrics when available"
				checked={settings.preferSynchronized}
				onChange={(_, value) => setSetting("preferSynchronized", value)}
			/>
			<Switch
				title="Show source badge"
				desc="Show the active lyrics provider above lyrics"
				checked={settings.showSourceBadge}
				onChange={(_, value) => setSetting("showSourceBadge", value)}
			/>
			<NumericSettingControl
				label="Font size"
				description="Main/original lyric size"
				min={12}
				max={64}
				step={1}
				precision={0}
				unit="px"
				value={settings.fontSize}
				onChange={(value) => setSetting("fontSize", value)}
			/>
			<NumericSettingControl
				label="Line spacing"
				description="Space between lyric rows"
				min={0.8}
				max={3}
				step={0.1}
				precision={1}
				unit="x"
				value={settings.lineSpacing}
				onChange={(value) => setSetting("lineSpacing", value)}
			/>
			<NumericSettingControl
				label="Romanized opacity"
				description="Romanized text opacity (0–1)"
				min={0}
				max={1}
				step={0.05}
				precision={2}
				value={settings.romanizedOpacity}
				onChange={(value) => setSetting("romanizedOpacity", value)}
			/>
			<NumericSettingControl
				label="Lyrics Sync Offset"
				description="Positive values advance lyrics; negative values delay lyrics."
				min={-5000}
				max={5000}
				step={50}
				precision={0}
				unit="ms"
				value={settings.syncOffsetMs}
				onChange={(value) => setSetting("syncOffsetMs", value)}
				onReset={() => setSetting("syncOffsetMs", 0)}
			/>
			<Switch
				title="Debug logging"
				desc="Log TIDAL lyric availability without lyric content"
				checked={settings.debugLogging}
				onChange={(_, value) => setSetting("debugLogging", value)}
			/>
		</LunaSettings>
	);
};
