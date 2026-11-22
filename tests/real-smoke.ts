import { readFile, writeFile, mkdir } from "node:fs/promises";
import { RequestSchema, type Snapshot } from "../packages/domain/index";
import { WalkingGraph } from "../packages/planner/routes";
import { solve } from "../packages/planner/index";
const snapshot: Snapshot = JSON.parse(
  await readFile("data/snapshots/pois.json", "utf8"),
);
const graph = new WalkingGraph(
  JSON.parse(await readFile("data/snapshots/network.json", "utf8")),
);
const results = [];
for (const [i, a] of snapshot.anchors.entries()) {
  const r = RequestSchema.parse({
    start: a.coordinates,
    end: a.coordinates,
    startTime: "2026-10-18T12:00:00+05:00",
    deadline: "2026-10-18T13:00:00+05:00",
    interests: ["explore", "coffee"],
  });
  const result = solve(snapshot.pois, r, graph, snapshot.version);
  results.push({
    anchor: a.name,
    plan: result.plan?.stops.map((s) => ({
      id: s.poi.id,
      name: s.poi.name,
      hours: s.hours,
    })),
    elapsed: result.elapsedMs,
    legs: result.plan?.legs.map((l) => ({
      metres: l.metres,
      seconds: l.seconds,
      snap: l.snapMetres,
      points: l.geometry.length,
    })),
    trace: result.trace,
    warnings: result.warnings,
  });
  if (i === 0) {
    await mkdir("tests/evidence", { recursive: true });
    await writeFile(
      "tests/evidence/real-retrieval-trace.json",
      JSON.stringify(result, null, 2),
    );
  }
}
console.log(JSON.stringify(results, null, 2));
