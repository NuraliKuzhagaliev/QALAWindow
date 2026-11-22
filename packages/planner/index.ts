import OpeningHours from "opening_hours";
import {
  astanaWallDate,
  normalize,
  type POI,
  type PlanRequest,
  type PlanResult,
  type Plan,
  type Stop,
  type Leg,
} from "../domain/index";
import { retrieve, interestScore } from "../retrieval/index";
import type { WalkingGraph } from "./routes";
const hoursCache = new WeakMap<POI, OpeningHours | null>();
export function hoursDuring(
  p: POI,
  arrival: number,
  departure: number,
): Stop["hours"] {
  if (p.fields.hours?.state === "conflict") return "conflict";
  if (!p.hours || /\b(PH|SH)\b/.test(p.hours)) return "unknown";
  try {
    if (!hoursCache.has(p))
      hoursCache.set(
        p,
        new OpeningHours(p.hours, {
          lat: p.coordinates[1],
          lon: p.coordinates[0],
          address: { country_code: "kz", state: "Astana" },
        } as never),
      );
    const hours = hoursCache.get(p)!;
    for (let t = arrival; t <= departure; t += 60000) {
      const d = astanaWallDate(new Date(t));
      if (hours.getUnknown(d)) return "unknown";
      if (!hours.getState(d)) return "closed";
    }
    if (!hours.getState(astanaWallDate(new Date(departure)))) return "closed";
    return "scheduled";
  } catch {
    hoursCache.set(p, null);
    return "unknown";
  }
}
export function hardReasons(p: POI, r: PlanRequest) {
  const reasons: string[] = [];
  if (r.closedIds.includes(p.id)) reasons.push("simulated_closed");
  const people = r.people;
  const strictAccess =
    r.stepFree === "required" || people.some((x) => x.stepFree === "required");
  if (strictAccess) {
    if (p.entranceAccess !== "tagged")
      reasons.push("entrance_access_unverified");
    reasons.push("route_step_free_unverified");
  }
  for (const key of ["sockets", "quiet", "childSuitable"] as const) {
    const required =
      key === "childSuitable"
        ? r.child || people.some((x) => x.child)
        : r[key] || people.some((x) => x[key]);
    if (required && p[key] !== true) reasons.push(`${key}_unverified`);
  }
  if (r.freeOnly && p.price !== "free") reasons.push("price_unverified");
  if (r.breakPreference === "indoor" && p.indoor !== true)
    reasons.push("indoor_unverified");
  return reasons;
}
const text = {
  en: {
    why: "Matches your interests within the retrieved nearby places.",
    neutral: "A nearby option from the collected dataset.",
    activity:
      "Suggested activity: pause and notice one detail you would normally walk past.",
  },
  ru: {
    why: "Соответствует интересам среди найденных мест рядом.",
    neutral: "Место поблизости из собранного набора данных.",
    activity:
      "Идея: остановитесь и найдите одну деталь, которую обычно не замечаете.",
  },
  kk: {
    why: "Жақын жерден табылған орындардың ішінде қызығушылығыңызға сай.",
    neutral: "Жиналған деректердегі жақын орын.",
    activity: "Идея: тоқтап, әдетте байқамайтын бір бөлшекке назар аударыңыз.",
  },
};
export function solve(
  pois: POI[],
  r: PlanRequest,
  graph: WalkingGraph,
  datasetVersion: string,
): PlanResult {
  const begin = performance.now(),
    requestId = globalThis.crypto.randomUUID(),
    warnings: string[] = [],
    exclusions: PlanResult["exclusions"] = [],
    trace: PlanResult["trace"] = [];
  const base = {
    requestId,
    datasetVersion,
    retrievedAt: new Date().toISOString(),
    mode: "local_solver" as const,
    provider: null,
    model: null,
    simulation: r.simulation,
  };
  if (
    /airport|flight|аэропорт|вылет|әуежай|ұшақ/i.test(r.query) &&
    !r.usableAirportBudget
  )
    return {
      ...base,
      plan: null,
      candidates: [],
      exclusions: [],
      trace: [
        {
          stage: "guard",
          summary:
            "Explicit usable landside budget required. Stay at the airport until this is established.",
        },
      ],
      warnings: [
        "Airport excursion budget is not established. Flight time does not equal free time.",
      ],
      elapsedMs: performance.now() - begin,
    };
  const interpreted = {
    ...r,
    sockets:
      r.sockets ||
      (/socket|розетк/i.test(r.query) &&
        !/prefer.*socket|желательно.*розет|розет.*қалаулы/i.test(r.query)),
    quiet:
      r.quiet ||
      (/quiet|тихое|тишин|тыныш/i.test(r.query) &&
        !/prefer.*quiet|желательно.*тих/i.test(r.query)),
    child: r.child || /with.*child|с ребен|с ребён|баламен/i.test(r.query),
    stepFree: (/wheelchair|required.*step.free|инвалид.*коляс|арбамен/i.test(
      r.query,
    )
      ? "required"
      : r.stepFree) as PlanRequest["stepFree"],
  };
  const retrieved = retrieve(pois, interpreted);
  trace.push({
    stage: "retrieve",
    summary: `Spatial pruning + multilingual lexical ranking retrieved ${retrieved.length} candidates.`,
    ids: retrieved.map((x) => x.poi.id),
  });
  const candidates = retrieved
    .filter((x) => {
      const reasons = hardReasons(x.poi, interpreted);
      if (reasons.length) exclusions.push({ id: x.poi.id, reasons });
      return !reasons.length;
    })
    .slice(0, 8)
    .map((x) => x.poi);
  trace.push({
    stage: "constraints",
    summary: `${exclusions.length} candidate exclusions; no hard requirement relaxed. ${candidates.length} routed candidates. Applied query constraints: sockets=${interpreted.sockets}, quiet=${interpreted.quiet}, child=${interpreted.child}, stepFree=${interpreted.stepFree}. Group hard constraints remain individual: ${
      r.people
        .filter(
          (p) => p.stepFree === "required" || p.sockets || p.quiet || p.child,
        )
        .map((p) => p.id)
        .join(", ") || "none"
    }.`,
  });
  const start = Date.parse(r.startTime),
    deadline = Date.parse(r.deadline),
    buffer = r.bufferMinutes * 60;
  const plans: Plan[] = [];
  let attempted = 0;
  const failureCounts = new Map<string, number>();
  const fail = (id: string, reason: string) => {
    failureCounts.set(reason, (failureCounts.get(reason) || 0) + 1);
    if (!exclusions.some((x) => x.id === id && x.reasons.includes(reason)))
      exclusions.push({ id, reasons: [reason] });
  };
  function assess(sequence: POI[]) {
    attempted++;
    let time = start,
      travel = 0,
      visits = 0,
      outdoor = 0,
      metres = 0;
    const legs: Leg[] = [],
      stops: Stop[] = [];
    let coord = r.start,
      from = "start";
    for (const poi of sequence) {
      const leg = graph.route(from, coord, poi.id, poi.coordinates);
      if (!leg) {
        fail(poi.id, "walking_route_unavailable_or_snap_over_100m");
        return;
      }
      if (
        leg.seconds >
        Math.min(r.maxWalkMinutes, ...r.people.map((p) => p.maxWalkMinutes)) *
          60
      ) {
        fail(poi.id, "continuous_walk_limit");
        return;
      }
      travel += leg.seconds;
      metres += leg.metres;
      outdoor += leg.seconds;
      time += leg.seconds * 1000;
      const dwell = Math.max(...poi.visitSeconds);
      const status = hoursDuring(poi, time, time + dwell * 1000);
      if (
        status === "closed" ||
        status === "conflict" ||
        (r.requireHours && status !== "scheduled")
      ) {
        fail(poi.id, `hours_${status}`);
        return;
      }
      if (poi.indoor !== true) outdoor += dwell;
      const matches = (
        r.people.length ? r.people : [{ interests: r.interests }]
      ).map((p) =>
        interestScore(poi, p.interests, r.people.length ? "" : r.query),
      );
      stops.push({
        poi,
        arrival: new Date(time).toISOString(),
        departure: new Date(time + dwell * 1000).toISOString(),
        dwellSeconds: dwell,
        hours: status,
        matches,
        reason: matches.some((x) => x > 0)
          ? text[r.language].why
          : text[r.language].neutral,
        activity: text[r.language].activity,
      });
      time += dwell * 1000;
      visits += dwell;
      legs.push(leg);
      coord = poi.coordinates;
      from = poi.id;
    }
    const back = graph.route(from, coord, "end", r.end);
    if (!back) {
      fail(from, "return_route_unavailable");
      return;
    }
    if (
      back.seconds >
      Math.min(r.maxWalkMinutes, ...r.people.map((p) => p.maxWalkMinutes)) * 60
    ) {
      fail(from, "return_continuous_walk_limit");
      return;
    }
    travel += back.seconds;
    metres += back.metres;
    outdoor += back.seconds;
    time += back.seconds * 1000;
    legs.push(back);
    const slack = Math.floor((deadline - time) / 1000) - buffer;
    if (
      slack < 0 ||
      outdoor > r.outdoorMinutes * 60 ||
      metres > r.maxDistanceMetres
    ) {
      fail(
        from,
        slack < 0
          ? "deadline_with_buffer"
          : outdoor > r.outdoorMinutes * 60
            ? "outdoor_limit"
            : "distance_limit",
      );
      return;
    }
    if (
      r.breakPreference === "rest" &&
      !sequence.some((p) => ["cafe", "park", "mall"].includes(p.category))
    ) {
      fail(from, "rest_preference_no_stop");
      return;
    }
    const personScores = stops[0].matches.map((_, i) =>
        stops.reduce((s, p) => s + p.matches[i], 0),
      ),
      fairness = Math.min(...personScores),
      aggregateMatch = personScores.reduce((a, b) => a + b, 0);
    const uncertain =
      stops.some((s) => s.hours !== "scheduled") ||
      legs.some((l) => l.snapMetres.some((d) => d > 30));
    plans.push({
      id: sequence.map((p) => p.id).join("~"),
      stops,
      legs,
      travelSeconds: travel,
      visitSeconds: visits,
      outdoorSeconds: outdoor,
      bufferSeconds: buffer,
      slackSeconds: slack,
      returnTime: new Date(time).toISOString(),
      feasibility: uncertain ? "not_established" : "modeled",
      fairness,
      aggregateMatch,
      warnings: [
        ...(uncertain
          ? [
              "Visit hours are unknown. Time fit is conditional on access; verify before setting out.",
            ]
          : []),
        "Route accessibility, crossings and sidewalk conditions are unverified. Network may be incomplete. Snap connectors are included in time but are not verified paths.",
      ],
    });
  }
  function enumerate(seq: POI[]) {
    if (seq.length) assess(seq);
    if (seq.length === 3) return;
    for (const poi of candidates)
      if (!seq.includes(poi)) enumerate([...seq, poi]);
  }
  enumerate([]);
  const diversity = (p: Plan) =>
    new Set(
      p.stops.map((s) =>
        s.poi.category === "restaurant" ? "cafe" : s.poi.category,
      ),
    ).size;
  const accessMatch = (p: Plan) =>
    r.stepFree === "preferred" ||
    r.people.some((x) => x.stepFree === "preferred")
      ? p.stops.filter((s) => s.poi.entranceAccess === "tagged").length
      : 0;
  plans.sort(
    (a, b) =>
      b.fairness - a.fairness ||
      b.aggregateMatch - a.aggregateMatch ||
      accessMatch(b) - accessMatch(a) ||
      diversity(b) - diversity(a) ||
      Number(a.feasibility === "not_established") -
        Number(b.feasibility === "not_established") ||
      a.travelSeconds - b.travelSeconds ||
      b.stops.length - a.stops.length,
  );
  trace.push(
    {
      stage: "route",
      summary: `${attempted} ordered sequences checked with outbound, inter-stop, return, full dwell and one buffer. Foot network timestamp ${graph.network.retrieved_at}.`,
    },
    {
      stage: "rank",
      summary: `${plans.length} time-fitting plans. Max-min preference match first, aggregate second, evidence then walking economy. Best among retrieved candidates.`,
    },
    {
      stage: "validation",
      summary: JSON.stringify(Object.fromEntries(failureCounts)),
    },
  );
  if (!plans.length)
    warnings.push(
      "No plan establishes your constraints. Try increasing time, moving the start, or explicitly relaxing an unmet requirement.",
    );
  if (r.people.length && plans[0]?.fairness === 0)
    warnings.push(
      "At least one person has no positive preference match. Hard constraints remain enforced.",
    );
  return {
    ...base,
    plan: plans[0] ?? null,
    candidates,
    exclusions,
    trace,
    warnings,
    elapsedMs: performance.now() - begin,
  };
}
export function planDiff(a: Plan | null, b: Plan | null) {
  return {
    removed:
      a?.stops
        .filter((s) => !b?.stops.some((t) => s.poi.id === t.poi.id))
        .map((s) => s.poi.name) ?? [],
    added:
      b?.stops
        .filter((s) => !a?.stops.some((t) => s.poi.id === t.poi.id))
        .map((s) => s.poi.name) ?? [],
    walkingSeconds: (b?.travelSeconds ?? 0) - (a?.travelSeconds ?? 0),
    slackSeconds: (b?.slackSeconds ?? 0) - (a?.slackSeconds ?? 0),
  };
}
