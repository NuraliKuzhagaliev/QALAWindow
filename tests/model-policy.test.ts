import assert from "node:assert/strict";
import { test } from "node:test";
import { nextGeminiDailyReset } from "../apps/api/model-policy";

test("daily quota uses midnight in Pacific time including DST transitions", () => {
  const examples = [
    ["2026-11-22T01:00:00Z", "2026-11-22T08:00:00Z"],
    ["2026-11-22T08:01:00Z", "2026-11-23T08:00:00Z"],
    ["2026-07-22T01:00:00Z", "2026-07-22T07:00:00Z"],
    ["2026-03-08T00:00:00Z", "2026-03-08T08:00:00Z"],
    ["2026-11-01T00:00:00Z", "2026-11-01T07:00:00Z"],
  ];
  for (const [instant, reset] of examples)
    assert.equal(
      nextGeminiDailyReset(Date.parse(instant)),
      Date.parse(reset),
      instant,
    );
});
