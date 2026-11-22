import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import AxeBuilder from "@axe-core/playwright";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const prefix = "/QALAWindow/";
const local = !process.argv[2];
const server = local
  ? await new Promise((done) => {
      const handler = new Hono();
      handler.use(
        prefix + "*",
        serveStatic({
          root: `release/web-${version}/site`,
          rewriteRequestPath: (path) =>
            path.startsWith(prefix) ? path.slice(prefix.length - 1) : path,
        }),
      );
      const server = serve(
        {
          port: 0,
          hostname: "127.0.0.1",
          fetch: handler.fetch,
        },
        () => done(server),
      );
    })
  : null;
const url =
  process.argv[2] || `http://127.0.0.1:${server.address().port}${prefix}`;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  let applicationApiRequests = 0;
  await context.route("**/api/**", (route) => {
    if (new URL(route.request().url()).origin !== new URL(url).origin)
      return route.continue();
    applicationApiRequests++;
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.name));
  assert.equal((await page.goto(url)).status(), 200);
  const data = await page.evaluate(async () =>
    (await fetch("./data/pois.json")).json(),
  );
  assert.match(data.source_timestamp, /^2026-11-21T/);
  await page.getByRole("button", { name: "Your pace & company" }).click();
  await page
    .locator("input[type=datetime-local]")
    .nth(0)
    .fill("2026-11-22T12:00");
  await page
    .locator("input[type=datetime-local]")
    .nth(1)
    .fill("2026-11-22T13:30");
  await page.getByRole("button", { name: "Your pace & company" }).click();
  await page
    .getByRole("button", { name: "Find my window", exact: true })
    .click();
  await page.locator(".place-card").first().waitFor();
  const cards = await page.locator(".place-card").count();
  assert.ok(cards >= 1 && cards <= 3);
  await page
    .getByRole("button", { name: "Find a Plan B", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open-Meteo · CC BY 4.0" })
    .waitFor({ timeout: 12_000 });
  assert.match(await page.locator(".weather-card").innerText(), /°C/);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Desktop", exact: true }).click();
  const asset = await page
    .getByRole("link", { name: `Windows portable · ${version}` })
    .getAttribute("href");
  assert.equal(new URL(asset).hostname, "github.com");
  assert.ok(
    new URL(asset).pathname.includes(`/releases/download/v${version}/`),
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "Clear saved data", exact: true })
      .isVisible(),
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const attribution = page.locator(".maplibregl-ctrl-attrib").first();
  await attribution.waitFor({ state: "attached" });
  const controls = page.locator(".maplibregl-ctrl-bottom-right");
  const summary = page.locator(".map-plan-summary");
  const [credit, card] = await Promise.all([
    attribution.boundingBox(),
    summary.boundingBox(),
  ]);
  assert.ok(
    credit && card && card.y + card.height <= credit.y,
    `Map summary overlaps attribution: ${JSON.stringify({ credit, card })}`,
  );
  await context.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await page.reload();
  await page.locator(".schematic").waitFor();
  await page.getByRole("button", { name: "Your pace & company" }).click();
  await page
    .locator("input[type=datetime-local]")
    .nth(0)
    .fill("2026-11-22T12:00");
  await page
    .locator("input[type=datetime-local]")
    .nth(1)
    .fill("2026-11-22T13:30");
  await page.getByLabel("Group of").selectOption("5");
  const people = page.locator(".person");
  assert.equal(await people.count(), 5);
  const first = people.first(),
    last = people.last();
  const firstAccess = first.getByRole("combobox", { name: /Step-free/ });
  await firstAccess.selectOption("preferred");
  await last
    .getByRole("combobox", { name: /Step-free/ })
    .selectOption("required");
  await last.getByLabel("Uninterrupted walk, min", { exact: true }).fill("5");
  for (const label of [
    "Socket required",
    "Quiet required",
    "Child suitability required",
  ]) {
    await last.getByLabel(label, { exact: true }).check();
    assert.equal(
      await first.getByLabel(label, { exact: true }).isChecked(),
      false,
    );
  }
  assert.equal(await firstAccess.inputValue(), "preferred");
  await page
    .getByRole("button", { name: "Find my window", exact: true })
    .click();
  await page
    .getByText("This window needs a little more room.", { exact: true })
    .waitFor();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    })),
    [],
  );
  for (const [label, expected] of [
    ["RU", "ru"],
    ["KZ", "kk"],
    ["EN", "en"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    assert.equal(await page.locator("html").getAttribute("lang"), expected);
  }
  assert.ok(await controls.count());
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(applicationApiRequests, 0);
  assert.deepEqual(errors, []);
  const evidence = {
    at: new Date().toISOString(),
    url,
    dataset: data.version,
    source: data.source_timestamp,
    cards,
    weather: true,
    asset,
    groupPreferences: true,
    mobilePrivacy: true,
    attributionOverlap: false,
    fallbackAxeViolations: axe.violations.length,
    applicationApiRequests,
    errors,
  };
  await writeFile(
    `tests/evidence/static-web-${version}-${local ? "local" : "public"}.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
  server?.close();
}
