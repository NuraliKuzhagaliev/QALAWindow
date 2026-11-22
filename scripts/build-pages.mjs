import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const repository =
  process.env.QALA_GITHUB_REPOSITORY || "NuraliKuzhagaliev/QALAWindow";
if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
  throw new Error("Expected owner/repository");
const release = `https://github.com/${repository}/releases/download/v${version}`;
const exe = `QALAWindow-${version}-Windows-x64.exe`;
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run via npm run build:pages");
const result = spawnSync(process.execPath, [npm, "run", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_STATIC_HOST: "true",
    VITE_DESKTOP_DOWNLOAD_URL: `${release}/${exe}`,
    VITE_DESKTOP_CHECKSUM_URL: `${release}/${exe}.sha256`,
  },
});
if (result.status !== 0)
  throw new Error("Static site build failed", { cause: result.error });
await writeFile("dist/client/.nojekyll", "");
