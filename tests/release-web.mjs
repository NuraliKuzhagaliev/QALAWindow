import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const url = process.argv[2] || "http://127.0.0.1:8887";
const tag = new URL(url).hostname === "127.0.0.1" ? "local" : "public";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
let aiIntercepted = 0;
await context.route("**/api/explain", (route) => {
  aiIntercepted++;
  return route.abort();
});
const weatherEndpoint = "**/v1/forecast?*";
const planB = () =>
  page.getByRole("button", { name: "Find a Plan B", exact: true }).click();
const dialog = () => page.getByRole("dialog");
const close = () =>
  page.getByRole("button", { name: "Close", exact: true }).click();
const fillPlan = async () => {
  await page.getByRole("button", { name: "Your pace & company" }).click();
  await page
    .locator("input[type=datetime-local]")
    .nth(0)
    .fill("2026-11-22T12:00");
  await page
    .locator("input[type=datetime-local]")
    .nth(1)
    .fill("2026-11-22T13:00");
  await page.getByRole("button", { name: "Your pace & company" }).click();
  await page
    .getByRole("button", { name: "Find my window", exact: true })
    .click();
  await page.locator(".place-card").first().waitFor();
};
try {
  await page.goto(url);
  await fillPlan();
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/weather"),
  );
  let browserForecastRequests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).hostname === "api.open-meteo.com")
      browserForecastRequests++;
  });
  await planB();
  const apiStatus = (await response).status();
  await dialog()
    .getByRole("link", { name: "Open-Meteo · CC BY 4.0" })
    .waitFor({ timeout: 14000 });
  const liveWeather = await page.locator(".weather-card").innerText();
  assert.match(liveWeather, /°C/);
  await dialog()
    .getByRole("button", { name: "Recompute plan", exact: true })
    .click();
  await page.locator(".diff-panel").waitFor();
  const livePlanB = await page.locator(".diff-panel").innerText();
  if (tag === "local") {
    const sixty = page.getByRole("button", { name: /^60\s*min$/ });
    const thirty = page.getByRole("button", { name: /^30\s*min$/ });
    await page.getByRole("button", { name: "Your pace & company" }).click();
    await page
      .locator("input[type=datetime-local]")
      .nth(0)
      .fill("2026-11-22T12:30");
    assert.equal(await sixty.getAttribute("aria-pressed"), "false");
    assert.equal(await thirty.getAttribute("aria-pressed"), "true");
    await context.route("**/api/weather", (r) =>
      r.fulfill({ status: 503, json: {} }),
    );
    await page.reload();
    await fillPlan();
    await planB();
    // A real, free direct Open-Meteo request must bypass a failed application proxy.
    await dialog()
      .getByRole("link", { name: "Open-Meteo · CC BY 4.0" })
      .waitFor({ timeout: 13000 });
    assert.ok(browserForecastRequests > 0);
    await close();
    await context.route(weatherEndpoint, (r) => r.abort());
    await page.reload();
    await fillPlan();
    await planB();
    await dialog().getByText("Unavailable", { exact: true }).first().waitFor();
    await dialog().getByRole("spinbutton").fill("20");
    await dialog()
      .getByRole("button", { name: "Recompute plan", exact: true })
      .click();
    await page.locator(".diff-panel").waitFor();
    assert.ok(await page.locator(".simulation-badge").first().isVisible());
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  assert.ok(
    await dialog()
      .getByRole("button", { name: "Clear saved data", exact: true })
      .isVisible(),
  );
  await close();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(pageErrors, []);
  const result = {
    at: new Date().toISOString(),
    url,
    apiStatus,
    liveWeather,
    livePlanB,
    browserForecastRequests,
    manualAndDirectFallbackTested: tag === "local",
    timePresetRegressionTested: tag === "local",
    mobilePrivacy: true,
    aiIntercepted,
    pageErrors,
  };
  await writeFile(
    `tests/evidence/release-web-${version}-${tag}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
