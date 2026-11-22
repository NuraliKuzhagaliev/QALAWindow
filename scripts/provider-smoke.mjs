import { readFile, writeFile, mkdir } from "node:fs/promises";
try {
  process.loadEnvFile(".env.local");
} catch {}
await mkdir("tests/evidence", { recursive: true });
const evidence = { at: new Date().toISOString(), gemini: null, heigit: null };
try {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("key missing");
  const model = process.env.MODEL_ID || "gemini-3.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Return JSON {"ok":true}. This is a minimal connectivity check.',
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 64,
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      `HTTP ${response.status}; ${body.error?.status || "provider error"}`,
    );
  }
  const body = await response.json();
  const value = JSON.parse(
    body.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
      "null",
  );
  if (value?.ok !== true)
    throw new Error("structured output validation failed");
  evidence.gemini = {
    success: true,
    model,
    usage: body.usageMetadata ?? null,
    calls: 1,
  };
  console.log("Gemini: success (structured JSON validated)");
} catch (e) {
  evidence.gemini = {
    success: false,
    error: e.message.replace(/[A-Za-z0-9_-]{30,}/g, "[redacted]"),
    calls: 1,
  };
  console.log("Gemini:", evidence.gemini.error);
}
try {
  const key = process.env.HEIGIT_API_KEY;
  if (!key) throw new Error("key missing");
  const raw = JSON.parse(
    await readFile("data/snapshots/pois.raw.json", "utf8"),
  );
  const point = raw.elements.find((e) => e.tags?.name === "Mega Silk Way");
  const c = [point.center.lon, point.center.lat];
  const response = await fetch(
    "https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: key },
      body: JSON.stringify({
        coordinates: [c, [c[0] + 0.001, c[1] + 0.001]],
        radiuses: [150, 150],
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      `HTTP ${response.status}; code ${body.error?.code ?? "provider_error"}`,
    );
  }
  const body = await response.json();
  const f = body.features?.[0];
  if (
    !f?.geometry?.coordinates?.length ||
    !Number.isFinite(f.properties.summary.duration)
  )
    throw new Error("route schema validation failed");
  await writeFile(
    "tests/evidence/heigit-public-route.json",
    JSON.stringify({
      retrieved_at: new Date().toISOString(),
      endpoint:
        "https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson",
      response: body,
    }),
  );
  evidence.heigit = { success: true, profile: "foot-walking", calls: 1 };
  console.log("HeiGIT: success (pedestrian geometry and duration validated)");
} catch (e) {
  evidence.heigit = {
    success: false,
    error: e.message.replace(/[A-Za-z0-9_-]{30,}/g, "[redacted]"),
    calls: 1,
  };
  console.log("HeiGIT:", evidence.heigit.error);
}
await writeFile(
  "tests/evidence/provider-smoke.json",
  JSON.stringify(evidence, null, 2),
);
