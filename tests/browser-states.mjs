import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const profile = "D:/projects/QALAWindow/.tmp/browser-states";
const launch = () =>
  chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 1280, height: 800 },
  });
let context = await launch(),
  page = context.pages()[0];
page.setDefaultTimeout(12000);
const checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route("**/api/explain", (r) =>
  r.fulfill({
    status: 503,
    json: { error: "QA injected provider outage; no live model call" },
  }),
);
await context.route("**/api/weather", (r) =>
  r.fulfill({ status: 503, json: { error: "QA injected forecast outage" } }),
);
await page.goto("http://127.0.0.1:8887");
await page.waitForFunction(
  () => !document.querySelector("button.primary-button")?.disabled,
);
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
});
await page.reload();
await page
  .getByRole("button", { name: "Use my location", exact: true })
  .click();
await page
  .getByText("Location unavailable. Select a landmark or enter coordinates.", { exact: false })
  .waitFor({ timeout: 10000 });
checks.push({
  name: "GPS denial keeps manual planning usable",
  pass: await page
    .getByRole("button", { name: "Find my window", exact: true })
    .isEnabled(),
});
await page.getByRole("button", { name: "Your pace & company" }).click();
await page
  .locator("input[type=datetime-local]")
  .nth(0)
  .fill("2026-10-18T12:00");
await page
  .locator("input[type=datetime-local]")
  .nth(1)
  .fill("2026-10-18T13:00");
await page.getByLabel("Search local names").fill("Бәйтерек");
await page.getByLabel("Search local names").press("Tab");
assert.ok(
  (
    await page
      .getByLabel("Position · longitude, latitude")
      .inputValue()
      .catch(() => page.locator('input[placeholder="71.4, 51.1"]').inputValue())
  ).startsWith("71.425"),
);
checks.push({
  name: "Cyrillic area alias resolves to Keruen source anchor",
  pass: true,
});
await page.getByRole("button", { name: "Your pace & company" }).click();
await page.getByRole("button", { name: "Find my window", exact: true }).click();
await page.locator(".place-card").first().waitFor();
await page.waitForFunction(
  () =>
    !document.querySelector(".mode-badge")?.textContent.includes("asking AI"),
);
assert.ok(
  !(await page.locator(".mode-badge").first().innerText()).includes(
    "Live grounded AI",
  ),
);
checks.push({
  name: "Injected model outage retains validated places, no live AI claim",
  pass: true,
  kind: "injected failure",
});
await page.screenshot({
  path: "tests/evidence/screenshots/pre-save-state.png",
});
console.log(
  "Before save errors:",
  await page.locator("[role=alert]").allTextContents(),
);
const downloadPromise = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Save route pack", exact: true })
  .click();
await (await downloadPromise).saveAs("tests/evidence/web-state-pack.qala.json");
await page.setViewportSize({ width: 390, height: 844 });
await page.locator(".sheet-toggle").click();
assert.equal(
  await page.locator(".sheet-toggle").getAttribute("aria-expanded"),
  "false",
);
await page.screenshot({
  path: "tests/evidence/screenshots/mobile-collapsed.png",
});
await page.locator(".sheet-toggle").click();
checks.push({ name: "390px mobile sheet collapses and expands", pass: true });
await page.setViewportSize({ width: 1280, height: 800 });
await page
  .getByRole("button", { name: "Judge challenge", exact: true })
  .click();
await page
  .locator(".import-area")
  .fill(
    '[{"name":"Out of bounds","coordinates":[0,0],"category":"artwork","description":"QA"}]',
  );
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Recompute plan", exact: true })
  .click();
assert.ok((await page.getByRole("dialog").innerText()).includes("outside"));
await page
  .locator(".import-area")
  .fill(
    '[{"name":"QA isolated stop","coordinates":[71.4253099,51.1277901],"category":"artwork","description":"Synthetic imported record"}]',
  );
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Recompute plan", exact: true })
  .click();
await page.getByText("1 judge-supplied entries.", { exact: false }).waitFor();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Find my window", exact: true })
  .click();
await page.locator(".place-card").first().waitFor();
assert.ok(
  (await page.locator(".place-card").first().innerText()).includes(
    "QA isolated stop",
  ),
);
assert.ok(await page.locator(".simulation-badge").first().isVisible());
checks.push({
  name: "Judge import rejects bad bounds and uses isolated marked test record",
  pass: true,
  kind: "synthetic import",
});
await page
  .getByRole("button", { name: "Judge challenge", exact: true })
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Reset challenge", exact: true })
  .click();
await page.getByRole("button", { name: "Close", exact: true }).click();
await page.getByRole("button", { name: "Find my window", exact: true }).click();
await page.locator(".place-card").first().waitFor();
assert.ok(
  !(await page.locator(".place-card").first().innerText()).includes(
    "QA isolated stop",
  ),
);
checks.push({ name: "Judge reset restores source dataset", pass: true });
await context.close();
context = await launch();
page = context.pages()[0];
await context.setOffline(true);
await page.goto("http://127.0.0.1:8887");
await page.getByRole("button", { name: "Saved walks", exact: true }).click();
assert.ok((await page.locator(".saved-pack").count()) > 0);
await page
  .locator(".saved-pack")
  .first()
  .getByRole("button", { name: "Open", exact: true })
  .click();
await page.locator(".place-card").first().waitFor();
assert.ok(
  (await page.locator(".mode-badge").first().innerText())
    .toLowerCase()
    .includes("offline"),
);
await page.screenshot({
  path: "tests/evidence/screenshots/web-offline-restart.png",
});
checks.push({
  name: "Closed browser, reopened same profile fully offline: shell, IndexedDB pack and geometry available",
  pass: true,
});
await context.close();
await writeFile(
  "tests/evidence/browser-states.json",
  JSON.stringify({ at: new Date().toISOString(), checks, errors }, null, 2),
);
console.log(JSON.stringify(checks));
