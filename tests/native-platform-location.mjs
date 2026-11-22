import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Version required");
const executable = resolve(
  `release/windows/QALAWindow-${version}-Windows-x64.exe`,
);
const profile = await mkdtemp(resolve(".tmp/real-location-"));
const port = await new Promise((resolve, reject) => {
  const listener = createServer().once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const address = listener.address();
    listener.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
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
let browser;
let page;
try {
  let endpoint;
  for (let attempt = 0; attempt < 180 && proc.exitCode === null; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      endpoint = (await response.json()).webSocketDebuggerUrl;
      if (endpoint) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!endpoint) throw new Error("Native window did not start");
  browser = await chromium.connectOverCDP(endpoint);
  page = browser.contexts()[0].pages()[0];
  await page.waitForFunction(
    () => typeof window.qalaNative?.version === "string",
  );
  if ((await page.evaluate(() => window.qalaNative.version)) !== version)
    throw new Error("Connected renderer does not match the requested EXE");
  const button = page.locator(".location-actions button").first();
  await button.waitFor();
  await page.evaluate(() => {
    const geo = navigator.geolocation;
    if (!geo) {
      window.__locationProbe = "api-unavailable";
      return;
    }
    const native = geo.getCurrentPosition.bind(geo);
    geo.getCurrentPosition = (success, failure, options) => {
      window.__locationProbe = "waiting";
      return native(
        (position) => {
          window.__locationProbe = "position-returned";
          success(position);
        },
        (error) => {
          window.__locationProbe =
            ["unknown", "permission-denied", "position-unavailable", "timeout"][
              error.code
            ] ?? "unknown";
          failure(error);
        },
        { ...options, maximumAge: 0 },
      );
    };
  });
  await button.click();
  await page.waitForFunction(
    () => window.__locationProbe && window.__locationProbe !== "waiting",
    {},
    { timeout: 25000 },
  );
  const result = await page.evaluate(() => ({
    appVersion: window.qalaNative.version,
    platformFix: window.__locationProbe,
    manualStartAvailable: !!document.querySelector("#start-point"),
    startUpdated: document.querySelector("#start-point")?.value === "custom",
    emulated: false,
  }));
  await writeFile(
    resolve(`.tmp/real-location-${version}.json`),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await page?.close().catch(() => {});
  await browser?.close();
  if (proc.exitCode === null) proc.kill();
}
