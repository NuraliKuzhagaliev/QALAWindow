import { chromium } from "@playwright/test";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
const folder = "submission/recording";
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: folder, size: { width: 1280, height: 800 } },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const video = page.video(),
  captions = [],
  events = [],
  began = Date.now();
const elapsed = () => Date.now() - began;
const hold = async (text, seconds = 8) => {
  const start = elapsed();
  await page.waitForTimeout(seconds * 1000);
  captions.push({ start, end: elapsed(), text });
  events.push({ at: start, text });
};
const close = () =>
  page.getByRole("button", { name: "Close", exact: true }).click();
const find = async () => {
  await page
    .getByRole("button", { name: "Find my window", exact: true })
    .click();
  await page.locator(".place-card").first().waitFor({ timeout: 30000 });
};
try {
  await page.goto("https://qala-window-astana-2026.nurali6002217.chatgpt.site");
  await page.waitForFunction(
    () => !document.querySelector("button.primary-button")?.disabled,
  );
  await hold(
    "QALA Window: an actual public-release session, with no account required.",
    7,
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
  await hold(
    "Selected planning time: noon to 13:00 in Astana. This is not a claim of current availability.",
    7,
  );
  await page.getByRole("button", { name: "Your pace & company" }).click();
  await page
    .getByLabel("Anything else on your mind?")
    .fill(
      "A judge demo: one small discovery and a coffee break, returning within my hour.",
    );
  await find();
  await page.waitForFunction(
    () =>
      !document.querySelector(".mode-badge")?.textContent.includes("asking AI"),
    { timeout: 25000 },
  );
  await hold(
    "A fresh query retrieves collected POIs, solves the complete return loop, then requests grounded AI wording.",
    10,
  );
  await page.locator(".place-card").first().scrollIntoViewIfNeeded();
  await hold(
    "Cards show source schedules, visit estimates and real network walking estimates. Unknowns remain visible.",
    8,
  );
  await page.locator(".receipt-link").first().click();
  await hold(
    "Evidence receipts separate source facts, calculated estimates and suggested activities.",
    8,
  );
  await page
    .getByRole("dialog")
    .evaluate((el) => el.scrollTo({ top: 550, behavior: "smooth" }));
  await hold(
    "Field dates, raw source tags and the return calculation can be inspected. A source hash is not proof of truth.",
    8,
  );
  await close();
  await page
    .getByRole("button", { name: "Find a Plan B", exact: true })
    .click();
  await page.waitForTimeout(1200);
  await page.getByLabel("New outdoor limit, min").fill("20");
  await hold(
    "Plan B applies an explicit 20-minute outdoor cap. Forecast data is timestamped; unavailable weather is a simulation.",
    8,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Recompute plan", exact: true })
    .click();
  await page.waitForTimeout(4500);
  await hold(
    "The same solver recomputes the outing and reports the change. It can return zero if constraints cannot be established.",
    9,
  );
  await context.setOffline(true);
  await page.getByRole("button", { name: "Your pace & company" }).click();
  await page.getByLabel("Outdoor limit, min", { exact: true }).fill("90");
  await page.getByRole("button", { name: "Your pace & company" }).click();
  await find();
  const download = context.waitForEvent("page").catch(() => null);
  void download;
  const saving = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save route pack", exact: true })
    .click();
  await (await saving).saveAs(folder + "/demo-route.qala.json");
  await hold(
    "Network is now disabled. The local solver uses the bundled timestamped OSM snapshot; no live AI is claimed.",
    9,
  );
  await page.reload();
  await page.getByRole("button", { name: "Saved walks", exact: true }).click();
  await hold(
    "Saved routes retain their geometry, field receipts and previous text in local storage.",
    7,
  );
  await page
    .locator(".saved-pack")
    .first()
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await hold(
    "The saved route reopens offline with last-synced and stale-data warnings. Native Windows save/open is separately verified.",
    9,
  );
  await page
    .getByRole("button", { name: "Judge challenge", exact: true })
    .click();
  await page
    .locator(".import-area")
    .fill(
      '[{"name":"Judge supplied artwork","coordinates":[71.4075409,51.0890223],"category":"artwork","description":"Unverified isolated judge test record"}]',
    );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Recompute plan", exact: true })
    .click();
  await hold(
    "The judge desk accepts schema-validated isolated data. Imported records remain unverified and explicitly simulated.",
    9,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Find my window", exact: true })
    .click();
  await page.waitForTimeout(1800);
  await hold(
    "Independent judge input follows the production retrieval and planner path. It never modifies the source snapshot.",
    8,
  );
  await page
    .getByRole("button", { name: "Judge challenge", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset challenge", exact: true })
    .click();
  await close();
  await hold(
    "Reset returns to the original dataset. English, Russian and Kazakh preserve original source names.",
    7,
  );
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "KZ", exact: true }).click();
  await page.waitForTimeout(2500);
  await hold(
    "Remaining limits: physical access and source freshness, native Kazakh review, and unverified hosted HeiGIT access.",
    8,
  );
} finally {
  await context.close();
  await browser.close();
}
const raw = await video.path();
await copyFile(raw, folder + "/browser-release.webm");
function time(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
await writeFile(
  "submission/demo.srt",
  captions
    .map((c, i) => `${i + 1}\n${time(c.start)} --> ${time(c.end)}\n${c.text}\n`)
    .join("\n"),
);
await writeFile(
  folder + "/recording-log.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      url: page.url(),
      kind: "actual released web UI; deliberate offline network loss and explicitly isolated judge import",
      durationMs: elapsed(),
      events,
    },
    null,
    2,
  ),
);
console.log("Actual release recording and caption source saved.");
