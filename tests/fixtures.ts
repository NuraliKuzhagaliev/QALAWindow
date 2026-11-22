import {
  RequestSchema,
  type POI,
  type PlanRequest,
  type Coord,
  type Leg,
} from "../packages/domain/index";
import type { WalkingGraph } from "../packages/planner/routes";
export const baseRequest = (o: Partial<PlanRequest> = {}) =>
  RequestSchema.parse({
    start: [71.4, 51.1],
    end: [71.4, 51.1],
    startTime: "2026-10-18T12:00:00+05:00",
    deadline: "2026-10-18T13:00:00+05:00",
    interests: ["coffee"],
    ...o,
  });
export function poi(id = "a", extra: Partial<POI> = {}): POI {
  return {
    id,
    name: `Synthetic ${id}`,
    coordinates: [71.401, 51.1],
    category: "cafe",
    tags: ["cafe"],
    aliases: ["Синтетикалық", "Синтетика"],
    description: "SYNTHETIC TEST RECORD",
    description_kind: "synthetic",
    hours: "24/7",
    contact: null,
    rating: null,
    popularity: null,
    indoor: true,
    entranceAccess: "unknown",
    sockets: null,
    quiet: null,
    childSuitable: null,
    price: null,
    visitSeconds: [300, 600],
    fields: {
      hours: {
        value: "24/7",
        source_id: "fixture",
        retrieved_at: "2026-10-18T00:00:00Z",
        source_updated_at: null,
        transformation: "SYNTHETIC",
        state: "source",
      },
    },
    sources: [],
    ...extra,
  };
}
export function fixtureGraph(
  seconds = 300,
  options: {
    missing?: string[];
    overrides?: Record<string, number>;
    access?: "unknown" | "tagged";
  } = {},
): WalkingGraph {
  return {
    network: { retrieved_at: "2026-10-18T00:00:00Z", ways: [] },
    route(from: string, a: Coord, to: string, b: Coord): Leg | null {
      if (options.missing?.includes(`${from}>${to}`)) return null;
      const duration = options.overrides?.[`${from}>${to}`] ?? seconds;
      return {
        from,
        to,
        seconds: duration,
        metres: Math.round(duration * 1.15),
        geometry: [a, b],
        snapMetres: [0, 0],
        source: "SYNTHETIC FIXTURE",
        profile: "foot test",
        retrieved_at: "2026-10-18T00:00:00Z",
        access: options.access ?? "unknown",
        wayIds: [],
      };
    },
  } as unknown as WalkingGraph;
}
