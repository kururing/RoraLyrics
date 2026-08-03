import { mkdir, readFile, writeFile } from "node:fs/promises";
import { listen, pluginBuildOptions } from "luna/build";

const pluginDefinitions = [
	{ directory: "rora-romanized-lyrics", artifact: "rora.romanized-lyrics" },
	{ directory: "rora-audio-quality", artifact: "rora.audio-quality" },
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
await writeFile("./dist/store.json", JSON.stringify(workspacePackage));
