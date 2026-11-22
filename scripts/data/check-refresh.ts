import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inCity, RequestSchema, type Snapshot } from "../../packages/domain";
import { POISchema } from "../../packages/domain/imports";
import { solve } from "../../packages/planner";
import { WalkingGraph, type Network } from "../../packages/planner/routes";

const dir = process.argv[2];
if (!dir) throw new Error("A staged snapshot directory is required");
const read = async (name: string) => JSON.parse(await readFile(join(dir, name), "utf8"));
const snapshot: Snapshot & { source_timestamp: string; source_sha256: string } = await read("pois.json");
const network: Network & { source_timestamp: string; source_sha256: string } = await read("network.json");
assert.equal(snapshot.version, network.version);
assert.equal(snapshot.source_timestamp, network.source_timestamp);
assert.equal(snapshot.source_sha256, network.source_sha256);
assert.match(snapshot.source_sha256, /^[a-f0-9]{64}$/);
assert.ok(Date.now() - Date.parse(snapshot.source_timestamp) < 7 * 86_400_000);
assert.equal(new Set(snapshot.pois.map((poi) => poi.id)).size, snapshot.pois.length);
for (const poi of snapshot.pois) {
  POISchema.parse(poi);
  assert.ok(inCity(poi.coordinates, snapshot.boundary.bounds));
}
for (const way of network.ways) {
  assert.equal(way.nodes.length, way.coordinates.length);
  assert.ok(way.coordinates.length >= 2);
}
const graph = new WalkingGraph(network);
const scenarios = snapshot.anchors.map((anchor) => {
  const request = RequestSchema.parse({
    start: anchor.coordinates,
    end: anchor.coordinates,
    startTime: "2026-11-22T12:00:00+05:00",
    deadline: "2026-11-22T13:30:00+05:00",
    interests: ["explore", "coffee"],
  });
  const result = solve(snapshot.pois, request, graph, snapshot.version);
  assert.ok(result.plan, `No walking plan at ${anchor.id}`);
  assert.equal(result.plan.legs.length, result.plan.stops.length + 1);
  assert.ok(result.plan.legs.every((leg) => leg.geometry.length > 0));
  return { anchor: anchor.id, stops: result.plan.stops.length, returnTime: result.plan.returnTime };
});
console.log(JSON.stringify({
  version: snapshot.version, sourceTimestamp: snapshot.source_timestamp,
  sourceSha256: snapshot.source_sha256, places: snapshot.pois.length,
  networkWays: network.ways.length, scenarios,
}, null, 2));
