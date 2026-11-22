import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
try {
  process.loadEnvFile(".env.local");
} catch {}
const secrets = [
  "GEMINI_API_KEY",
  "HEIGIT_API_KEY",
  "OPENAI_COMPATIBLE_API_KEY",
]
  .map((k) => process.env[k])
  .filter((v) => v && v.length > 10);
const hits = [];
let count = 0;
async function scan(dir) {
  let files;
  try {
    files = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const file of files) {
    const p = path.join(dir, file.name);
    if (file.isDirectory()) await scan(p);
    else {
      count++;
      const bytes = await readFile(p);
      if (secrets.some((s) => bytes.includes(Buffer.from(s)))) hits.push(p);
    }
  }
}
for (const dir of ["dist/client", "apps/desktop", "deploy/site/worker"])
  await scan(dir);
await mkdir("tests/evidence", { recursive: true });
await writeFile(
  "tests/evidence/secret-scan.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      filesScanned: count,
      configuredSecretCount: secrets.length,
      plaintextSecretHits: hits,
    },
    null,
    2,
  ),
);
console.log(
  `Secret scan: ${hits.length} plaintext credential hits in ${count} renderer/desktop/Worker files.`,
);
if (hits.length) process.exitCode = 1;
