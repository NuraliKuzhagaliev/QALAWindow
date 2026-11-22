import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
const version = JSON.parse(
  await readFile("node_modules/electron/package.json", "utf8"),
).version;
const file = `electron-v${version}-win32-x64.zip`;
const expected = JSON.parse(
  await readFile("node_modules/electron/checksums.json", "utf8"),
)[file];
if (!/^[a-f0-9]{64}$/.test(expected))
  throw new Error("No package-supplied Electron release checksum");
await mkdir(".cache/electron-verified", { recursive: true });
const target = ".cache/electron-verified/" + file;
const response = await fetch(
  `https://npmmirror.com/mirrors/electron/${version}/${file}`,
  { signal: AbortSignal.timeout(300000) },
);
if (!response.ok) throw new Error(`Mirror HTTP ${response.status}`);
await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
const hash = createHash("sha256");
for await (const chunk of createReadStream(target)) hash.update(chunk);
const actual = hash.digest("hex");
if (actual !== expected)
  throw new Error(
    "Electron archive checksum mismatch. Do not execute or package.",
  );
await writeFile(
  ".cache/electron-verified/verification.json",
  JSON.stringify(
    {
      version,
      file,
      sha256: actual,
      expected_source: "installed Electron npm package checksums.json",
      mirror: "npmmirror.com",
      verified: true,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  "Electron archive downloaded on D: and verified against release checksum.",
);
