import { _electron as electron } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const executable =
  process.env.QALA_TEST_EXE ||
  "D:/projects/QALAWindow/release/windows/win-unpacked/QALA Window.exe";
const profile = process.env.QALA_TEST_PROFILE || "D:/projects/QALAWindow/.tmp/native-qa-full";
const nativeFile = process.env.QALA_NATIVE_FILE || "D:/projects/QALAWindow/.tmp/native-route.qala.json";
await mkdir("tests/evidence/screenshots", { recursive: true });
const launch = () =>
  electron.launch({
    executablePath: executable,
    env: {
      ...process.env,
      QALA_DATA_DIR: profile,
      GEMINI_API_KEY: "",
      HEIGIT_API_KEY: "",
    },
  });
let app = await launch();
let page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.waitForFunction(
  () => !document.querySelector("button.primary-button")?.disabled,
);
await app.context().setOffline(true);
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
await page
  .getByRole("button", { name: "Save route pack", exact: true })
  .click();
console.log("NATIVE_SAVE_DIALOG_READY. Save as " + nativeFile);
await page
  .getByText("Saved locally", { exact: true })
  .waitFor({ timeout: 180000 });
const saved = JSON.parse(await readFile(nativeFile, "utf8"));
await app.close();
app = await launch();
page = await app.firstWindow();
await page.waitForFunction(
  () => !document.querySelector("button.primary-button")?.disabled,
);
await app.context().setOffline(true);
await page.getByRole("button", { name: "Saved walks", exact: true }).click();
const afterRestart = await page.locator(".saved-pack").count();
await page.getByRole("button", { name: "Open a pack", exact: true }).click();
console.log("NATIVE_OPEN_DIALOG_READY. Open " + nativeFile);
await page.locator(".place-card").first().waitFor({ timeout: 180000 });
await page.screenshot({
  path: "tests/evidence/screenshots/native-offline-restart.png",
});
const bridge = await page.evaluate(() => ({
  native: !!window.qalaNative,
  nodeIntegration: typeof window.require !== "undefined",
  apiBase: window.qalaNative?.apiBase,
  offline: !navigator.onLine,
}));
const paths = await app.evaluate(({ app }) => ({
  packaged: app.isPackaged,
  version: app.getVersion(),
  userData: app.getPath("userData"),
  temp: app.getPath("temp"),
}));
const evidence = {
  at: new Date().toISOString(),
  executable,
  realNativeSave: true,
  realNativeOpen: true,
  restart: true,
  afterRestart,
  bridge,
  paths,
  packFormat: saved.format,
  geometryPreserved: saved.result.plan.legs.every((l) => l.geometry.length > 0),
  sourceReceipts: saved.result.plan.stops.every(
    (s) => Object.keys(s.poi.fields).length > 0,
  ),
  pageErrors: errors,
};
await writeFile(
  "tests/evidence/native-smoke.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
await app.close();
