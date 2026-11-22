import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("tests/evidence/screenshots", { recursive: true });
const context = await chromium.launchPersistentContext(
  "D:/projects/QALAWindow/.tmp/browser-qa",
  {
    headless: true,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  },
);
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/");
await page
  .getByRole("button", { name: "Find my window", exact: true })
  .waitFor();
await page.waitForFunction(
  () => !document.querySelector("button.primary-button")?.disabled,
);
await page.screenshot({ path: "tests/evidence/screenshots/initial-1440.png" });
await page.getByRole("button", { name: "Your pace & company" }).click();
await page
  .locator('input[type="datetime-local"]')
  .nth(0)
  .fill("2026-10-18T12:00");
await page
  .locator('input[type="datetime-local"]')
  .nth(1)
  .fill("2026-10-18T13:00");
await page.getByRole("button", { name: "Your pace & company" }).click();
await page
  .getByLabel("Anything else on your mind?")
  .fill("A small discovery and a short coffee break, returning to start");
const began = Date.now();
await page.getByRole("button", { name: "Find my window", exact: true }).click();
await page.locator(".place-card").first().waitFor({ timeout: 60000 });
const factsMs = Date.now() - began;
await page.waitForFunction(
  () =>
    !document.querySelector(".mode-badge")?.textContent.includes("asking AI"),
  { timeout: 25000 },
);
const mode = await page.locator(".mode-badge").first().textContent();
await page.screenshot({ path: "tests/evidence/screenshots/results-1440.png" });
await page.setViewportSize({ width: 1280, height: 800 });
await page.screenshot({ path: "tests/evidence/screenshots/results-1280.png" });
const axe = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
  .analyze();
await page.locator(".receipt-link").first().click();
await page.screenshot({ path: "tests/evidence/screenshots/evidence-1280.png" });
await page.getByRole("button", { name: "Close", exact: true }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "tests/evidence/screenshots/results-390.png",
  fullPage: true,
});
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
const download = page.waitForEvent("download");
await page
  .getByRole("button", { name: "Save route pack", exact: true })
  .click();
const file = await download;
await file.saveAs("tests/evidence/browser-saved.qala.json");
await page.getByRole("button", { name: "Saved walks", exact: true }).click();
const persisted = await page.locator(".saved-pack").count();
await page.getByRole("button", { name: "Close", exact: true }).click();
await page.reload();
await page.getByRole("button", { name: "Saved walks", exact: true }).click();
const afterReload = await page.locator(".saved-pack").count();
await page.getByRole("button", { name: "Open", exact: true }).first().click();
await page.screenshot({
  path: "tests/evidence/screenshots/saved-reopen-390.png",
  fullPage: true,
});
await writeFile(
  "tests/evidence/browser-smoke.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      mode,
      factsMs,
      completeMs: Date.now() - began,
      pageErrors: errors,
      horizontalOverflow390: overflow,
      packsSaved: persisted,
      packsAfterReload: afterReload,
      axeViolations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      mode,
      factsMs,
      errors,
      overflow,
      persisted,
      afterReload,
      axeViolations: axe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.length,
      })),
    },
    null,
    2,
  ),
);
await context.close();
