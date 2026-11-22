import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const executable = resolve(
  `release/windows/QALAWindow-${version}-Windows-x64.exe`,
);
const profile = await mkdtemp(resolve(".tmp/portable-smoke-"));
const port = 9348;
const proc = spawn(executable, [`--remote-debugging-port=${port}`], {
  windowsHide: true,
  env: {
    ...process.env,
    QALA_DATA_DIR: profile,
    GEMINI_API_KEY: "",
    HEIGIT_API_KEY: "",
  },
  stdio: "ignore",
});
let endpoint;
for (let attempt = 0; attempt < 200 && proc.exitCode === null; attempt++) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    endpoint = (await response.json()).webSocketDebuggerUrl;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!endpoint) {
  proc.kill();
  throw Error(
    `Portable CDP endpoint not ready (exit: ${proc.exitCode ?? "timeout"})`,
  );
}
const browser = await chromium.connectOverCDP(endpoint);
const page = browser.contexts()[0].pages()[0];
await page.waitForFunction(
  () => !document.querySelector("button.primary-button")?.disabled,
);
await browser.contexts()[0].setOffline(true);
await page.getByRole("button", { name: "Your pace & company" }).click();
await page
  .locator("input[type=datetime-local]")
  .nth(0)
  .fill("2026-10-18T12:00");
await page
  .locator("input[type=datetime-local]")
  .nth(1)
  .fill("2026-10-18T13:00");
await page.getByRole("button", { name: "Your pace & company" }).click();
await page.getByRole("button", { name: "Find my window", exact: true }).click();
await page.locator(".place-card").first().waitFor();
const result = await page.evaluate(() => ({
  native: !!window.qalaNative,
  appVersion: window.qalaNative?.version,
  nodeIntegration: typeof window.require !== "undefined",
  offline: !navigator.onLine,
  cards: document.querySelectorAll(".place-card").length,
  mode: document.querySelector(".mode-badge")?.textContent,
}));
assert.equal(result.appVersion, version);
assert.ok(result.offline && result.cards > 0 && !result.nodeIntegration);
await page.screenshot({
  path: `tests/evidence/screenshots/portable-launch-${version}.png`,
});
await writeFile(
  `tests/evidence/portable-launch-${version}.json`,
  JSON.stringify(
    { at: new Date().toISOString(), executable, ...result },
    null,
    2,
  ),
);
console.log(JSON.stringify(result));
await page.close();
await browser.close();
