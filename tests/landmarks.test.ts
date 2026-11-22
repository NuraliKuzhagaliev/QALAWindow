import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveLandmark } from "../packages/retrieval/landmarks";
import type { Snapshot } from "../packages/domain/index";
const data: Snapshot = JSON.parse(
  await readFile("data/snapshots/pois.json", "utf8"),
);
test("L01 Cyrillic and Latin area aliases resolve to the same explicit source anchor", () => {
  for (const alias of ["Bayterek", "Бәйтерек", "Нұржол"]) {
    const r = resolveLandmark(data, alias);
    assert.equal(r.state, "found");
    assert.equal(r.matches[0].label, "Керуен");
  }
});
test("L02 source POI also used as an anchor does not become ambiguous", () =>
  assert.equal(resolveLandmark(data, "Керуен").state, "found"));
test("L03 repeated branch names stay ambiguous", () => {
  const sample = {
    ...data,
    anchors: [],
    pois: [
      { ...data.pois[0], id: "one", name: "Branch", aliases: [] },
      { ...data.pois[1], id: "two", name: "Branch", aliases: [] },
    ],
  };
  assert.equal(resolveLandmark(sample, "Branch").state, "ambiguous");
});
test("L04 no fuzzy invented place on unknown input", () =>
  assert.equal(resolveLandmark(data, "invented observatory").state, "none"));
