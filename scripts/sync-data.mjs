import { mkdir, copyFile, readFile } from "node:fs/promises";
const versions = await Promise.all(
  ["pois.json", "network.json"].map(async (name) =>
    JSON.parse(await readFile("data/snapshots/" + name, "utf8")).version,
  ),
);
if (versions[0] !== versions[1]) throw new Error("Mixed POI and network snapshot versions");
await mkdir("public/data", { recursive: true });
for (const name of ["pois.json", "network.json", "DATA_AUDIT.json"])
  await copyFile("data/snapshots/" + name, "public/data/" + name);
