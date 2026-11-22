import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createApp } from "../apps/api/app";
import { prepareExplanation } from "../apps/api/providers";
import {
  applyExplanation,
  ExplanationPatchSchema,
} from "../packages/domain/explanations";
import type { PlanResult, Snapshot } from "../packages/domain/index";
import type { Network } from "../packages/planner/routes";
import { baseRequest } from "./fixtures";

test("Only public stop facts reach the model, and the explanation expires and can be used once", async (t) => {
  const snapshot: Snapshot = JSON.parse(
    await readFile("data/snapshots/pois.json", "utf8"),
  );
  const network: Network = JSON.parse(
    await readFile("data/snapshots/network.json", "utf8"),
  );
  const request = baseRequest({
    start: snapshot.anchors[0].coordinates,
    end: snapshot.anchors[0].coordinates,
    query: "private-synthetic-marker",
    interests: ["coffee", "private-synthetic-marker"],
    deadline: "2026-10-18T13:30:00+05:00",
  });
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const stub = t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init: RequestInit) => {
      assert.equal(
        new URL(String(url)).hostname,
        "generativelanguage.googleapis.com",
      );
      const body = JSON.parse(String(init.body));
      const context = JSON.parse(body.contents[0].parts[0].text);
      assert.deepEqual(context.interests, ["coffee"]);
      assert.doesNotMatch(
        JSON.stringify(body),
        /private-synthetic-marker|coordinates|geometry|departure|arrival/,
      );
      const items = context.facts.map(({ id }: { id: string }) => ({
        id,
        reasonIndex: 0,
        activityIndex: 1,
      }));
      return Response.json({
        candidates: [
          { content: { parts: [{ text: JSON.stringify({ items }) }] } },
        ],
      });
    },
  );
  const app = createApp(snapshot, network, {
    MODEL_ID: "deterministic-explanation-test",
    GEMINI_API_KEY: "test-key",
    ROUTING_PROVIDER: "local-network",
  });
  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-qala-session": "deterministic-explanation-test",
      },
      body: JSON.stringify(body),
    });
  const plan = async () => {
    const response = await post("/api/plan", { request });
    assert.equal(response.status, 200);
    const result: PlanResult = await response.json();
    assert.ok(result.plan);
    return result;
  };
  const first = await plan();
  const retained = prepareExplanation(first, request);
  assert.deepEqual(Object.keys(retained!).sort(), [
    "dataset",
    "facts",
    "interests",
    "language",
    "requestId",
  ]);
  now += 119_999;
  const response = await post("/api/explain", { requestId: first.requestId });
  assert.equal(response.status, 200);
  const raw = await response.json();
  assert.deepEqual(Object.keys(raw).sort(), [
    "model",
    "provider",
    "requestId",
    "stops",
    "trace",
  ]);
  const patch = ExplanationPatchSchema.parse(raw);
  const decorated = applyExplanation(first, patch);
  assert.equal(decorated.mode, "live_ai");
  assert.deepEqual(decorated.plan!.legs, first.plan!.legs);
  assert.throws(() =>
    applyExplanation(first, { ...patch, requestId: "different" }),
  );
  assert.equal(
    (await post("/api/explain", { requestId: first.requestId })).status,
    503,
  );
  const second = await plan();
  now += 120_000;
  assert.equal(
    (await post("/api/explain", { requestId: second.requestId })).status,
    503,
  );
  assert.equal(stub.mock.callCount(), 1);
});
