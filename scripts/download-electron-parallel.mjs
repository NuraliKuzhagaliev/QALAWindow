import { mkdir, readFile, writeFile, open, stat } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
const version = JSON.parse(
    await readFile("node_modules/electron/package.json", "utf8"),
  ).version,
  file = `electron-v${version}-win32-x64.zip`,
  expected = JSON.parse(
    await readFile("node_modules/electron/checksums.json", "utf8"),
  )[file];
const url = `https://npmmirror.com/mirrors/electron/${version}/${file}`;
const head = await fetch(url, {
  method: "HEAD",
  signal: AbortSignal.timeout(10000),
});
const total = Number(head.headers.get("content-length"));
if (!head.ok || !total || !/^[a-f0-9]{64}$/.test(expected))
  throw new Error("Release metadata unavailable");
const directory = ".cache/electron-verified",
  partial = directory + "/" + file,
  target = directory + "/parallel-" + file;
await mkdir(directory, { recursive: true });
let prefix = Buffer.alloc(0);
try {
  prefix = await readFile(partial);
} catch {}
if (prefix.length >= total) prefix = Buffer.alloc(0);
await writeFile(target, prefix);
const handle = await open(target, "r+");
await handle.truncate(total);
await handle.close();
const chunk = Math.ceil((total - prefix.length) / 8);
await Promise.all(
  Array.from({ length: 8 }, async (_, i) => {
    const start = prefix.length + i * chunk,
      end = Math.min(total - 1, start + chunk - 1);
    if (start > end) return;
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${end}` },
      signal: AbortSignal.timeout(300000),
    });
    if (
      response.status !== 206 ||
      response.headers.get("content-range") !== `bytes ${start}-${end}/${total}`
    )
      throw new Error("Mirror did not honor byte ranges");
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(target, { flags: "r+", start }),
    );
    console.log(`Range ${i + 1}/8 finished`);
  }),
);
const hash = createHash("sha256");
for await (const bytes of createReadStream(target)) hash.update(bytes);
if (hash.digest("hex") !== expected)
  throw new Error("Checksum mismatch; archive must not be executed");
await writeFile(
  directory + "/verification.json",
  JSON.stringify(
    {
      version,
      file: target,
      sha256: expected,
      expected_source: "Electron npm release checksums.json",
      verified: true,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log("Complete Electron archive verified against release checksum.");
