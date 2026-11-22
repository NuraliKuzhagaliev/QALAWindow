import assert from "node:assert/strict";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { _electron } from "@playwright/test";

const { version, devDependencies } = JSON.parse(
  await readFile("package.json", "utf8"),
);
const dir = await mkdtemp(resolve(`.tmp/native-clear-${version}-`));
const managed = resolve(dir, "profile/packs");
const managedPack = resolve(managed, "built-in.qala.json");
const exportedPack = resolve(dir, "exported.qala.json");
const otherFile = resolve(managed, "keep.txt");
const executable = resolve("release/windows/win-unpacked/QALA Window.exe");
await mkdir(managed, { recursive: true });
await copyFile("tests/evidence/browser-saved.qala.json", managedPack);
await copyFile(managedPack, exportedPack);
await writeFile(otherFile, "unrelated test file");

const launch = () =>
  _electron.launch({
    executablePath: executable,
    env: {
      ...process.env,
      QALA_DATA_DIR: resolve(dir, "profile"),
      GEMINI_API_KEY: "",
      HEIGIT_API_KEY: "",
    },
  });
let app = await launch();
const pageErrors = [];
const firstOfflinePage = async () => {
  const page = await app.firstWindow();
  await app.context().setOffline(true);
  page.on("pageerror", (error) => pageErrors.push(error.name));
  return page;
};
try {
  const runtime = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    electron: process.versions.electron,
  }));
  assert.deepEqual(runtime, {
    packaged: true,
    version,
    electron: devDependencies.electron,
  });
  let page = await firstOfflinePage();
  const cdp = await app.context().newCDPSession(page);
  await cdp.send("Emulation.setGeolocationOverride", {
    latitude: 51.0890223,
    longitude: 71.4075409,
    accuracy: 25,
  });
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("#start-point")?.value === "custom",
  );
  const platformLocation = await app.evaluate(({ app }) =>
    app.commandLine
      .getSwitchValue("enable-features")
      .includes("LocationProviderManagerMode/PlatformOnly"),
  );
  assert.ok(platformLocation);
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, exportedPack);
  await page.getByRole("button", { name: "Saved walks", exact: true }).click();
  await page.getByRole("button", { name: "Open a pack", exact: true }).click();
  await page.locator(".place-card").first().waitFor();
  await app.close();
  app = await launch();
  page = await firstOfflinePage();
  await page.getByRole("button", { name: "Saved walks", exact: true }).click();
  await page.locator(".saved-pack").first().waitFor();
  assert.equal(await page.locator(".saved-pack").count(), 1);
  await page
    .locator(".saved-pack")
    .getByRole("button", { name: "Open", exact: true })
    .click();
  const offlineStops = await page.locator(".place-card").count();
  assert.ok(offlineStops > 0);
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear saved data", exact: true })
    .click();
  await page.getByText("Saved data cleared.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Saved walks", exact: true }).click();
  assert.equal(await page.locator(".saved-pack").count(), 0);
  await assert.rejects(access(managedPack), { code: "ENOENT" });
  await access(exportedPack);
  await access(otherFile);
  assert.deepEqual(pageErrors, []);
  await app.close();
  app = await launch();
  page = await firstOfflinePage();
  await page.getByRole("button", { name: "Saved walks", exact: true }).click();
  assert.equal(await page.locator(".saved-pack").count(), 0);
  const result = {
    at: new Date().toISOString(),
    ...runtime,
    offlineStops,
    clearedAfterRestart: true,
    managedPackRemoved: true,
    exportedPackPreserved: true,
    unrelatedFilePreserved: true,
    geolocationPermissionWithEmulatedPosition: true,
    platformLocation,
    picker: "test double; actual IPC and file IO",
    pageErrors,
  };
  await writeFile(
    `tests/evidence/native-clear-${version}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await app.close();
}
