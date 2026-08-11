import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { listen, pluginBuildOptions } from "luna/build";

const pluginDefinitions = [
	{ directory: "rora-romanized-lyrics", artifact: "rora.romanized-lyrics" },
	{ directory: "rora-tidal-mv", artifact: "rora.tidal-mv" },
];
const artifactNames: string[] = [];
const builds = await Promise.all(
	pluginDefinitions.map(async ({ directory, artifact }) => {
		const pluginPackage = JSON.parse(
			await readFile(`./plugins/${directory}/package.json`, "utf8"),
		) as { releaseVersion: string };
		const artifactName = `${artifact}-${pluginPackage.releaseVersion}.mjs`;
		artifactNames.push(artifactName);
		return pluginBuildOptions(`./plugins/${directory}`, {
			outfile: `./dist/${artifactName}`,
		});
	}),
);
listen(builds);

const workspacePackage = JSON.parse(
	await readFile("./package.json", "utf8"),
) as Record<string, unknown>;
workspacePackage.plugins = artifactNames;
await mkdir("./dist", { recursive: true });
await copyFile("./plugins/rora-tidal-mv/src/player-v2.html", "./dist/rora.tidal-mv-player-v2.html");
await writeFile("./dist/store.json", JSON.stringify(workspacePackage));
