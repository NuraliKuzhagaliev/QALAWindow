import { readFile, writeFile, mkdir } from "node:fs/promises";
import { RequestSchema, type Snapshot } from "../packages/domain/index";
import { WalkingGraph } from "../packages/planner/routes";
import { solve } from "../packages/planner/index";
import { explain } from "../apps/api/providers";
import { modelUsage } from "../apps/api/model-policy";
try {
  process.loadEnvFile(".env.local");
} catch {}
const snapshot: Snapshot = JSON.parse(
  await readFile("data/snapshots/pois.json", "utf8"),
);
const graph = new WalkingGraph(
  JSON.parse(await readFile("data/snapshots/network.json", "utf8")),
);
const cases = [
  ["en", 0, "A short discovery and coffee"],
  ["ru", 0, "Хочу кофе и небольшую прогулку"],
  ["kk", 0, "Кофе ішіп, аздап серуендегім келеді"],
  ["en", 1, "Architecture and a relaxed break"],
  ["ru", 1, "Прогулка и что-то интересное рядом"],
  ["kk", 1, "Жақын жерден қызықты орын іздеймін"],
] as const;
const results = [];
for (const [language, index, query] of cases) {
  const start = snapshot.anchors[index].coordinates;
  const request = RequestSchema.parse({
    start,
    end: start,
    startTime: "2026-10-18T12:00:00+05:00",
    deadline: "2026-10-18T13:00:00+05:00",
    language,
    query,
    interests: ["explore", "coffee"],
  });
  const facts = solve(snapshot.pois, request, graph, snapshot.version);
  const started = performance.now();
  try {
    const generated = await explain(facts, request);
    const invariant =
      JSON.stringify(
        generated.plan?.stops.map((s) => [
          s.poi.id,
          s.arrival,
          s.departure,
          s.hours,
          s.poi.fields,
        ]),
      ) ===
      JSON.stringify(
        facts.plan?.stops.map((s) => [
          s.poi.id,
          s.arrival,
          s.departure,
          s.hours,
          s.poi.fields,
        ]),
      );
    const row = {
      language,
      query,
      success: generated.mode === "live_ai" && invariant,
      latencyMs: performance.now() - started,
      mode: generated.mode,
      items: generated.plan?.stops.map((s) => ({
        id: s.poi.id,
        name: s.poi.name,
        reason: s.reason,
        activity: s.activity,
        hours: s.hours,
      })),
      trace: generated.trace.at(-1),
    };
    results.push(row);
    console.log(
      language,
      index,
      row.success ? "PASS" : "FAIL",
      Math.round(row.latencyMs) + "ms",
    );
  } catch (e) {
    results.push({
      language,
      query,
      success: false,
      error: (e as Error).message,
    });
    console.log(language, index, "FAIL", (e as Error).message);
  }
}
await mkdir("tests/evidence", { recursive: true });
await writeFile(
  "tests/evidence/live-quality.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      model: process.env.MODEL_ID || "gemini-3.5-flash-lite",
      dataset: snapshot.version,
      results,
      usage: modelUsage,
      cost: "Not measured from billing. No paid fallback or billing change.",
      review:
        "Automated source/ID/time invariants; semantic review required separately. Kazakh native review pending.",
    },
    null,
    2,
  ),
);
