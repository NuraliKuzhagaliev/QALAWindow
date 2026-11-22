import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://127.0.0.1:8887";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const fileName = `QALAWindow-${version}-Windows-x64.exe`;
const expectedLine = await readFile(
  `release/windows/${fileName}.sha256`,
  "utf8",
);
const expectedHash = expectedLine.trim().split(/\s+/)[0];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Desktop", exact: true }).click();
  const panel = page.getByRole("dialog");
  const exe = await panel
    .getByRole("link", { name: `Windows portable · ${version}` })
    .getAttribute("href");
  const sha = await panel
    .getByRole("link", { name: "SHA256", exact: true })
    .getAttribute("href");
  assert.ok(exe && sha);
  const exeUrl = new URL(exe, base);
  assert.equal(exeUrl.pathname.split("/").at(-1), fileName);
  const shaResponse = await fetch(new URL(sha, base), {
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(shaResponse.status, 200);
  assert.equal((await shaResponse.text()).trim(), expectedLine.trim());
  const response = await fetch(exeUrl, {
    signal: AbortSignal.timeout(240_000),
  });
  assert.equal(response.status, 200);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of response.body) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  assert.equal(hash.digest("hex"), expectedHash);
  const evidence = {
    at: new Date().toISOString(),
    version,
    site: base,
    exeUrl: exeUrl.toString(),
    bytes,
    sha256: expectedHash,
  };
  await writeFile(
    `tests/evidence/download-${version}-${new URL(base).hostname === "127.0.0.1" ? "local" : "public"}.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
