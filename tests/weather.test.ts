import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createApp } from "../apps/api/app";
import { WeatherSnapshotSchema } from "../packages/domain/weather";

const snapshot = JSON.parse(await readFile("data/snapshots/pois.json", "utf8"));
const network = JSON.parse(
  await readFile("data/snapshots/network.json", "utf8"),
);
const weather = {
  current: {
    time: "2026-11-22T18:00",
    temperature_2m: -3,
    apparent_temperature: -6,
    precipitation: 0.4,
    wind_speed_10m: 16,
  },
  current_units: { temperature_2m: "°C" },
  hourly: { time: ["2026-11-22T18:00"], precipitation_probability: [null] },
};

test("weather API validates, timestamps and reuses the city snapshot", async (t) => {
  const provider = t.mock.method(globalThis, "fetch", (input: string) => {
    const url = new URL(input);
    assert.equal(url.hostname, "api.open-meteo.com");
    assert.equal(url.searchParams.get("latitude"), "51.1");
    assert.equal(url.searchParams.get("longitude"), "71.4");
    return Promise.resolve(Response.json(weather));
  });
  const api = createApp(snapshot, network, {});
  const first = await api.request("/api/weather");
  assert.equal(first.status, 200);
  const value = WeatherSnapshotSchema.parse(await first.json());
  assert.equal(value.current.apparent_temperature, -6);
  assert.deepEqual(await (await api.request("/api/weather")).json(), value);
  assert.equal(provider.mock.callCount(), 1);
});

test("weather API rejects malformed responses and recovers after an upstream refusal", async (t) => {
  const replies = [
    Response.json({ current: { apparent_temperature: null } }),
    new Response(null, { status: 429 }),
    Response.json(weather),
  ];
  t.mock.method(globalThis, "fetch", () => Promise.resolve(replies.shift()!));
  const warn = t.mock.method(console, "warn", () => {});
  const api = createApp(snapshot, network, {});
  assert.equal((await api.request("/api/weather")).status, 503);
  assert.equal((await api.request("/api/weather")).status, 503);
  assert.equal((await api.request("/api/weather")).status, 200);
  assert.deepEqual(
    warn.mock.calls.map((c) => c.arguments),
    [
      ["qala_weather_unavailable", "invalid_response"],
      ["qala_weather_unavailable", "http_429"],
    ],
  );
});
