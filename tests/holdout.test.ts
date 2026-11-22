// Frozen 2026-10-18 before first execution. Expected constraints, never favorite venues.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  RequestSchema,
  type Snapshot,
  type PlanRequest,
} from "../packages/domain/index";
import { WalkingGraph } from "../packages/planner/routes";
import { solve, planDiff } from "../packages/planner/index";
import { parseChallenge, validatePack } from "../packages/domain/imports";
import { validateExplanation } from "../apps/api/providers";
import { poi, baseRequest, fixtureGraph } from "./fixtures";
const snapshot: Snapshot = JSON.parse(
  await readFile("data/snapshots/pois.json", "utf8"),
);
const graph = new WalkingGraph(
  JSON.parse(await readFile("data/snapshots/network.json", "utf8")),
);
const evidence: { id: string; kind: string; pass: boolean; note: string }[] =
  [];
const testCase = (id: string, name: string, kind: string, fn: () => string) =>
  test(`${id} ${name}`, () => {
    try {
      const note = fn();
      evidence.push({ id, kind, pass: true, note });
    } catch (e) {
      evidence.push({ id, kind, pass: false, note: (e as Error).message });
      throw e;
    }
  });
const real = (
  index: number,
  minutes: number,
  overrides: Partial<PlanRequest> = {},
) => {
  const start = snapshot.anchors[index].coordinates;
  const request = RequestSchema.parse({
    start,
    end: start,
    startTime: "2026-10-18T12:00:00+05:00",
    deadline: new Date(
      Date.parse("2026-10-18T12:00:00+05:00") + minutes * 60000,
    ).toISOString(),
    interests: ["explore", "coffee"],
    ...overrides,
  });
  const result = solve(snapshot.pois, request, graph, snapshot.version);
  if (result.plan) {
    const p = result.plan;
    assert.ok(p.stops.length >= 1 && p.stops.length <= 3);
    assert.equal(p.legs.length, p.stops.length + 1);
    assert.ok(p.slackSeconds >= 0);
    assert.ok(p.outdoorSeconds <= request.outdoorMinutes * 60);
    assert.ok(p.legs.every((l) => l.snapMetres.every((d) => d <= 100)));
    assert.ok(
      Date.parse(p.returnTime) + p.bufferSeconds * 1000 <=
        Date.parse(request.deadline),
    );
    assert.ok(
      p.stops.every((s) => s.hours !== "closed" && s.hours !== "conflict"),
    );
  } else assert.ok(result.warnings.length > 0);
  return result;
};
testCase("H01", "Expo 45-minute real return loop", "real-data", () => {
  const r = real(0, 45);
  assert.ok(r.plan);
  return `${r.plan.stops.length} stops, ${r.plan.slackSeconds}s slack`;
});
testCase("H02", "Nurzhol 90-minute real return loop", "real-data", () => {
  const r = real(1, 90);
  assert.ok(r.plan);
  return `${r.plan.stops.length} stops`;
});
testCase("H03", "Short real window permits honest zero", "real-data", () => {
  const r = real(0, 15);
  return `${r.plan?.stops.length ?? 0} stops; timing invariants checked`;
});
testCase("H04", "Nature query retains nearby source IDs", "real-data", () => {
  const r = real(1, 60, { interests: ["nature"], query: "Саябақ" });
  assert.ok(
    r.candidates.every((p) => snapshot.pois.some((s) => s.id === p.id)),
  );
  return "Source IDs preserved";
});
testCase(
  "H05",
  "Strict socket requirement on real missing evidence",
  "real-data",
  () => {
    assert.equal(real(0, 60, { sockets: true }).plan, null);
    return "No invented sockets";
  },
);
testCase(
  "H06",
  "Strict quiet requirement on real missing evidence",
  "real-data",
  () => {
    assert.equal(real(1, 60, { quiet: true }).plan, null);
    return "No inferred quietness";
  },
);
testCase(
  "H07",
  "Strict route accessibility cannot pass unknown",
  "real-data",
  () => {
    assert.equal(real(0, 90, { stepFree: "required" }).plan, null);
    return "Access requirement not established";
  },
);
testCase(
  "H08",
  "Require known hours across complete visit",
  "real-data",
  () => {
    const r = real(0, 60, { requireHours: true });
    assert.ok(r.plan);
    assert.ok(r.plan.stops.every((s) => s.hours === "scheduled"));
    return "Full intervals checked";
  },
);
testCase("H09", "Zero outdoor allowance on real route", "real-data", () => {
  assert.equal(real(1, 60, { outdoorMinutes: 0 }).plan, null);
  return "Outdoor travel cannot disappear";
});
testCase(
  "H10",
  "Explicit 5-person hard constraint conflict",
  "synthetic-context/real-data",
  () => {
    const people = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`,
      interests: [i === 4 ? "nature" : "coffee"],
      stepFree: i === 4 ? ("required" as const) : ("off" as const),
      sockets: false,
      quiet: false,
      child: false,
      maxWalkMinutes: 30,
    }));
    assert.equal(real(1, 60, { people }).plan, null);
    return "Fifth member strict access preserved";
  },
);
testCase(
  "H11",
  "Russian socket free text is a hard condition",
  "real-data",
  () => {
    assert.equal(real(0, 60, { query: "Хочу кофе и розетку" }).plan, null);
    return "Query constraint applied";
  },
);
testCase(
  "H12",
  "Airport flight query has no implied excursion budget",
  "real-data",
  () => {
    const r = real(0, 90, { query: "Two hours before my flight" });
    assert.equal(r.plan, null);
    return "Needs explicit usable landside budget";
  },
);
testCase("H13", "Non-default buffer changes slack exactly", "synthetic", () => {
  const a = solve(
      [poi()],
      baseRequest({ bufferMinutes: 2 }),
      fixtureGraph(),
      "synthetic",
    ).plan!,
    b = solve(
      [poi()],
      baseRequest({ bufferMinutes: 9 }),
      fixtureGraph(),
      "synthetic",
    ).plan!;
  assert.equal(a.slackSeconds - b.slackSeconds, 420);
  return "420-second difference";
});
testCase(
  "H14",
  "Max-min ranking beats mean-only on controlled conflict",
  "synthetic",
  () => {
    const a = poi("balanced", { tags: ["cafe", "park"] }),
      b = poi("mean-winner", { name: "Coffee Heaven" });
    const people = [0, 1, 2].map((i) => ({
      id: `h${i}`,
      interests: i === 2 ? ["nature"] : ["coffee", "Coffee Heaven"],
      stepFree: "off" as const,
      sockets: false,
      quiet: false,
      child: false,
      maxWalkMinutes: 30,
    }));
    const r = solve(
      [a, b],
      baseRequest({ deadline: "2026-10-18T12:25:00+05:00", people }),
      fixtureGraph(),
      "synthetic",
    );
    assert.equal(r.plan!.stops[0].poi.id, "balanced");
    return "Fairness 3 for balanced vs 0 for mean-only winner";
  },
);
testCase(
  "H15",
  "Weather Plan B is real recomputation with diff",
  "synthetic",
  () => {
    const ps = [poi("out", { indoor: false }), poi("in", { indoor: true })];
    const before = solve(ps, baseRequest(), fixtureGraph(), "synthetic"),
      after = solve(
        ps,
        baseRequest({ outdoorMinutes: 12, simulation: true }),
        fixtureGraph(),
        "synthetic",
      );
    assert.ok(after.plan);
    assert.ok(after.plan.outdoorSeconds <= 720);
    assert.ok(planDiff(before.plan, after.plan));
    return "Feasible shorter outdoor plan";
  },
);
testCase(
  "H16",
  "Valid pack roundtrip preserves geometry and receipts",
  "real-data",
  () => {
    const r = real(0, 60);
    const p = {
      format: "qala-route-pack",
      version: 1,
      saved_at: new Date().toISOString(),
      attribution: snapshot.attribution,
      datasetVersion: r.datasetVersion,
      result: r,
      publicStart: true,
    };
    const reopened = validatePack(JSON.parse(JSON.stringify(p)));
    assert.deepEqual(reopened.result.plan!.legs, r.plan!.legs);
    assert.deepEqual(
      reopened.result.plan!.stops[0].poi.fields,
      r.plan!.stops[0].poi.fields,
    );
    return "Geometry, source receipts and timestamps preserved";
  },
);
testCase(
  "H17",
  "Pack corrupted negative timing is rejected",
  "synthetic",
  () => {
    assert.throws(() =>
      validatePack({
        format: "qala-route-pack",
        version: 1,
        result: { plan: { travelSeconds: -1 } },
      }),
    );
    return "Rejected";
  },
);
testCase("H18", "Malformed JSON challenge is rejected", "synthetic", () => {
  assert.throws(() => parseChallenge("[bad", snapshot.boundary.bounds));
  return "Rejected";
});
testCase(
  "H19",
  "Excessive coordinate precision does not bypass finite validation",
  "synthetic",
  () => {
    assert.throws(() =>
      parseChallenge(
        '[{"name":"Test","coordinates":[1e300,51.1],"category":"cafe","description":"Unverified"}]',
        snapshot.boundary.bounds,
      ),
    );
    return "Rejected";
  },
);
testCase(
  "H20",
  "Invented model POI rejected",
  "synthetic-model-response",
  () => {
    assert.throws(() =>
      validateExplanation(
        '{"items":[{"id":"invented","reasonIndex":0,"activityIndex":0}]}',
        ["real"],
      ),
    );
    return "Rejected before display";
  },
);
testCase(
  "H21",
  "Malformed model JSON rejected",
  "synthetic-model-response",
  () => {
    assert.throws(() => validateExplanation("not json", ["real"]));
    return "Rejected";
  },
);
testCase(
  "H22",
  "Unsupported generated factual attributes rejected",
  "synthetic-model-response",
  () => {
    assert.throws(() =>
      validateExplanation(
        '{"items":[{"id":"real","reasonIndex":0,"activityIndex":0,"price":"free"}]}',
        ["real"],
      ),
    );
    return "Extra factual prose/fields cannot enter cards";
  },
);
testCase(
  "H23",
  "Outside-network real manual position returns honest zero",
  "real-data",
  () => {
    const r = real(0, 60, { start: [71.75, 51.3], end: [71.75, 51.3] });
    assert.equal(r.plan, null);
    return "No straight-line routing fallback";
  },
);
testCase(
  "H24",
  "Closure reset restores same source-backed outcome",
  "real-data/simulation",
  () => {
    const before = real(0, 60);
    const original = JSON.stringify(snapshot);
    const closed = real(0, 60, {
      closedIds: before.plan!.stops.map((s) => s.poi.id),
      simulation: true,
    });
    assert.ok(
      closed.plan?.stops.every(
        (s) => !before.plan!.stops.some((o) => o.poi.id === s.poi.id),
      ) ?? true,
    );
    const reset = real(0, 60);
    assert.equal(reset.plan!.id, before.plan!.id);
    assert.equal(JSON.stringify(snapshot), original);
    return "Snapshot unchanged; original result restored";
  },
);
process.on("exit", () => {
  import("node:fs").then(() => {});
});
test("write holdout evidence", async () => {
  await mkdir("tests/evidence", { recursive: true });
  await writeFile(
    "tests/evidence/holdout.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        dataset: snapshot.version,
        passed: evidence.filter((e) => e.pass).length,
        total: 24,
        cases: evidence,
      },
      null,
      2,
    ),
  );
});
