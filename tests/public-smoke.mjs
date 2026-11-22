import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
const url = "https://qala-window-astana-2026.nurali6002217.chatgpt.site";
await mkdir("tests/evidence/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(url);
  await page.waitForFunction(
    () => !document.querySelector("button.primary-button")?.disabled,
  );
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
  await page
    .getByLabel("Anything else on your mind?")
    .fill(
      "A new judge query: coffee, a small discovery, and back to this public landmark",
    );
  const start = Date.now();
  await page
    .getByRole("button", { name: "Find my window", exact: true })
    .click();
  await page.locator(".place-card").first().waitFor({ timeout: 30000 });
  const factsMs = Date.now() - start;
  await page.waitForFunction(
    () =>
      document
        .querySelector(".mode-badge")
        ?.textContent.includes("Live grounded AI"),
    { timeout: 25000 },
  );
  const fullMs = Date.now() - start;
  await page.screenshot({ path: "tests/evidence/screenshots/public-1440.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "tests/evidence/screenshots/public-1280.png" });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "tests/evidence/screenshots/public-390.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  const result = {
    at: new Date().toISOString(),
    url,
    anonymous: true,
    newQuery: true,
    factsMs,
    fullMs,
    pageErrors: errors,
    horizontalOverflow390: overflow,
    mode: await page.locator(".mode-badge").first().textContent(),
    axeViolations: axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.length,
    })),
  };
  await writeFile(
    "tests/evidence/public-smoke.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
