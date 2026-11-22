import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  RequestSchema,
  inCity,
  type Snapshot,
} from "../../packages/domain/index";
import { parseChallenge } from "../../packages/domain/imports";
import { WalkingGraph, type Network } from "../../packages/planner/routes";
import { solve, hardReasons } from "../../packages/planner/index";
import { retrieve } from "../../packages/retrieval/index";
import {
  fetchCityWeather,
  WeatherHttpError,
  weatherFreshMs,
  type WeatherSnapshot,
} from "../../packages/domain/weather";
import {
  generateExplanation,
  prepareExplanation,
  hostedMatrix,
  hydrateDirections,
  type ProviderConfig,
} from "./providers";
export function createApp(
  snapshot: Snapshot,
  network: Network,
  config: ProviderConfig,
) {
  const graph = new WalkingGraph(network);
  const app = new Hono();
  let active = 0;
  const buckets = new Map<string, { count: number; reset: number }>();
  const explanationTTL = 120_000;
  const pendingExplanations = new Map<
    string,
    {
      context: NonNullable<ReturnType<typeof prepareExplanation>>;
      expiresAt: number;
    }
  >();
  const expireExplanations = (now: number) => {
    for (const [id, entry] of pendingExplanations)
      if (entry.expiresAt <= now) pendingExplanations.delete(id);
  };
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 100000,
      onError: (c) => c.json({ error: "Request exceeds 100 KB" }, 413),
    }),
  );
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", "geolocation=(self)");
    c.header("Cache-Control", "no-store");
  });
  app.use("/api/*", async (c, next) => {
    if (c.req.method === "GET") return next();
    const key = c.req.header("x-qala-session")?.slice(0, 80) || "anonymous";
    const now = Date.now();
    if (buckets.size > 5000) buckets.clear();
    const b = buckets.get(key);
    if (!b || b.reset < now) buckets.set(key, { count: 1, reset: now + 60000 });
    else if (++b.count > 24)
      return c.json(
        { error: "Capacity reached. Retry in one minute.", retryAfter: 60 },
        429,
      );
    if (active >= 4)
      return c.json({ error: "The planner is busy. Retry shortly." }, 503);
    active++;
    try {
      await next();
    } finally {
      active--;
    }
  });
  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      dataset: snapshot.version,
      places: snapshot.pois.length,
      modelConfigured: !!config.GEMINI_API_KEY,
      routeConfigured: !!config.HEIGIT_API_KEY,
      timezone: "Asia/Almaty",
    }),
  );
  app.post("/api/plan", async (c) => {
    try {
      const payload = await c.req.json();
      const request = RequestSchema.parse(payload.request);
      if (
        !inCity(request.start, snapshot.boundary.bounds) ||
        !inCity(request.end, snapshot.boundary.bounds)
      )
        return c.json(
          { error: "Position outside the verified Astana coverage bounds" },
          400,
        );
      const pois = payload.challenge
        ? parseChallenge(payload.challenge, snapshot.boundary.bounds)
        : snapshot.pois;
      const requestGraph = new WalkingGraph(graph.network);
      let engine: Pick<WalkingGraph, "route" | "network"> = requestGraph;
      let routeWarning = "";
      try {
        const candidates = retrieve(pois, request)
          .filter((x) => !hardReasons(x.poi, request).length)
          .slice(0, 8)
          .map((x) => x.poi);
        if (candidates.length)
          engine = await hostedMatrix(
            request,
            candidates,
            requestGraph,
            config,
          );
      } catch (e) {
        routeWarning =
          (e as Error).message + "; using timestamped collected OSM network.";
      }
      let result = solve(
        pois,
        request,
        engine as WalkingGraph,
        snapshot.version,
      );
      if (routeWarning) result.warnings.push(routeWarning);
      if (engine !== requestGraph && result.plan) {
        try {
          result = await hydrateDirections(result, request, config);
          const exact = new Map(
            result.plan!.legs.map((l) => [`${l.from}>${l.to}`, l]),
          );
          const exactEngine = {
            network: engine.network,
            route: (a: string, ac: any, b: string, bc: any) =>
              exact.get(`${a}>${b}`) ?? null,
          };
          const checked = solve(
            result.plan!.stops.map((s) => s.poi),
            request,
            exactEngine as unknown as WalkingGraph,
            snapshot.version,
          );
          result = {
            ...checked,
            requestId: result.requestId,
            candidates: result.candidates,
            exclusions: [...result.exclusions, ...checked.exclusions],
            trace: [
              ...result.trace,
              ...checked.trace,
              {
                stage: "directions",
                summary:
                  "Selected leg geometry and exact durations revalidated through production solver.",
              },
            ],
            warnings: [...result.warnings, ...checked.warnings],
          };
        } catch (e) {
          result = solve(pois, request, requestGraph, snapshot.version);
          result.warnings.push(
            "Hosted geometry unavailable; recalculated using timestamped local network.",
          );
        }
      }
      const now = Date.now();
      expireExplanations(now);
      const context = !payload.challenge && prepareExplanation(result, request);
      if (context) {
        pendingExplanations.set(result.requestId, {
          context,
          expiresAt: now + explanationTTL,
        });
        if (typeof process !== "undefined" && process.release?.name === "node")
          setTimeout(
            () => expireExplanations(Date.now()),
            explanationTTL,
          ).unref?.();
      }
      if (pendingExplanations.size > 100)
        pendingExplanations.delete(pendingExplanations.keys().next().value!);
      return c.json(result);
    } catch {
      return c.json(
        {
          error:
            "Invalid request or challenge data. Check coordinates, time window, fields and import limits.",
        },
        400,
      );
    }
  });
  app.post("/api/explain", async (c) => {
    try {
      const payload = await c.req.json();
      expireExplanations(Date.now());
      const saved = pendingExplanations.get(payload.requestId);
      if (!saved) throw new Error("Plan expired");
      pendingExplanations.delete(payload.requestId);
      const generated = await generateExplanation(saved.context, config);
      return c.json(generated);
    } catch (e) {
      return c.json(
        {
          error: (e as Error).message.startsWith("Gemini HTTP")
            ? (e as Error).message
            : "AI explanation unavailable; validated local facts remain usable.",
        },
        503,
      );
    }
  });
  let weatherCache: WeatherSnapshot | null = null;
  app.get("/api/weather", async (c) => {
    if (
      weatherCache &&
      Date.now() - Date.parse(weatherCache.retrieved_at) < weatherFreshMs
    )
      return c.json(weatherCache);
    try {
      weatherCache = await fetchCityWeather(5000);
      return c.json(weatherCache);
    } catch (error) {
      // Record only the class of failure and HTTP status, never headers or bodies.
      const category =
        error instanceof WeatherHttpError
          ? `http_${error.status}`
          : error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : error instanceof Error &&
                ["ZodError", "SyntaxError"].includes(error.name)
              ? "invalid_response"
              : "connection_failed";
      console.warn("qala_weather_unavailable", category);
      return c.json(
        {
          error:
            "Forecast unavailable. Choose your outdoor comfort limit manually.",
        },
        503,
      );
    }
  });

  app.onError((_, c) =>
    c.json({ error: "Request failed. No personal input was logged." }, 500),
  );
  return app;
}
