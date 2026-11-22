import { z } from "zod";
import {
  CoordSchema,
  safeText,
  inCity,
  type POI,
  type PlanResult,
  type Snapshot,
} from "./index";
const ChallengeSchema = z
  .object({
    name: safeText,
    coordinates: CoordSchema,
    category: z.enum([
      "cafe",
      "museum",
      "park",
      "attraction",
      "artwork",
      "gallery",
      "viewpoint",
      "playground",
      "mall",
      "restaurant",
      "library",
      "garden",
    ]),
    description: safeText,
    hours: z.string().max(200).nullable().optional(),
  })
  .strict();
export function parseChallenge(
  text: string,
  bounds: Snapshot["boundary"]["bounds"],
): POI[] {
  if (new TextEncoder().encode(text).length > 64000)
    throw new Error("Import exceeds 64 KB");
  let rows: unknown;
  if (text.trim().startsWith("[")) rows = JSON.parse(text);
  else {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift()?.split(",");
    if (
      headers?.join(",") !==
      "name,longitude,latitude,category,description,hours"
    )
      throw new Error(
        "CSV headers: name,longitude,latitude,category,description,hours. Use JSON for commas inside values.",
      );
    rows = lines.map((line) => {
      const v = line.split(",");
      if (v.length !== 6) throw new Error("CSV must have exactly six cells");
      return {
        name: v[0],
        coordinates: [Number(v[1]), Number(v[2])],
        category: v[3],
        description: v[4],
        hours: v[5] || null,
      };
    });
  }
  const data = z.array(ChallengeSchema).min(1).max(30).parse(rows),
    stamp = new Date().toISOString();
  return data.map((p, i) => {
    if (!inCity(p.coordinates, bounds))
      throw new Error(
        "Challenge coordinates outside the verified city boundary bounds",
      );
    const id = `challenge/${i}`;
    const field = (value: unknown) => ({
      value,
      source_id: id,
      retrieved_at: stamp,
      source_updated_at: null,
      transformation: "Judge supplied, unverified",
      state: "unknown" as const,
    });
    return {
      id,
      ...p,
      hours: null,
      tags: [p.category],
      aliases: [],
      description_kind: "judge supplied, unverified",
      contact: null,
      rating: null,
      popularity: null,
      indoor: null,
      entranceAccess: "unknown",
      sockets: null,
      quiet: null,
      childSuitable: null,
      price: null,
      visitSeconds: [300, 600],
      fields: {
        name: field(p.name),
        coordinates: field(p.coordinates),
        hours: field(p.hours ?? null),
        category: field(p.category),
      },
      sources: [],
      challenge: true,
    };
  });
}
export type Pack = {
  format: "qala-route-pack";
  version: 1;
  saved_at: string;
  attribution: string;
  datasetVersion: string;
  result: PlanResult;
  publicStart: boolean;
};
const short = z.string().max(1000),
  date = z.string().datetime({ offset: true }),
  nonnegative = z.number().finite().nonnegative();
const FieldSchema = z
  .object({
    value: z.union([
      short,
      z.number().finite(),
      z.boolean(),
      CoordSchema,
      z.null(),
    ]),
    source_id: short,
    retrieved_at: date,
    source_updated_at: date.nullable(),
    transformation: short,
    state: z.enum(["source", "unknown", "conflict"]),
  })
  .strict();
const SourceSchema = z
  .object({
    id: short,
    url: z
      .string()
      .url()
      .refine((s) => s.startsWith("https://www.openstreetmap.org/")),
    retrieved_at: date,
    source_updated_at: date.nullable(),
    raw_tags: z.record(z.string().max(200), z.string().max(3000)),
    hash: z.string().max(100),
    license: short,
  })
  .strict();
export const POISchema = z
  .object({
    id: short,
    name: safeText,
    coordinates: CoordSchema,
    category: short,
    tags: z.array(short).max(30),
    aliases: z.array(short).max(30),
    description: short,
    description_kind: short,
    hours: short.nullable(),
    contact: short.nullable(),
    rating: z.number().nullable(),
    popularity: z.number().nullable(),
    indoor: z.boolean().nullable(),
    entranceAccess: z.enum(["tagged", "no", "unknown"]),
    sockets: z.boolean().nullable(),
    quiet: z.boolean().nullable(),
    childSuitable: z.boolean().nullable(),
    price: short.nullable(),
    visitSeconds: z.array(nonnegative.max(10800)).min(1).max(2),
    fields: z.record(z.string().max(50), FieldSchema),
    sources: z.array(SourceSchema).max(10),
    challenge: z.boolean().optional(),
  })
  .strict();
const LegSchema = z
  .object({
    from: short,
    to: short,
    metres: nonnegative.max(100000),
    seconds: nonnegative.max(86400),
    geometry: z.array(CoordSchema).max(50000),
    snapMetres: z.tuple([nonnegative, nonnegative]),
    source: short,
    profile: short,
    retrieved_at: date,
    access: z.enum(["unknown", "tagged"]),
    wayIds: z.array(z.number().int()).max(20000),
  })
  .strict();
const PlanSchema = z
  .object({
    id: short,
    stops: z
      .array(
        z
          .object({
            poi: POISchema,
            arrival: date,
            departure: date,
            dwellSeconds: nonnegative.max(10800),
            hours: z.enum(["scheduled", "unknown", "conflict", "closed"]),
            matches: z.array(nonnegative).max(5),
            reason: short,
            activity: short,
          })
          .strict(),
      )
      .min(1)
      .max(3),
    legs: z.array(LegSchema).min(2).max(4),
    travelSeconds: nonnegative,
    visitSeconds: nonnegative,
    outdoorSeconds: nonnegative,
    bufferSeconds: nonnegative,
    slackSeconds: nonnegative,
    returnTime: date,
    feasibility: z.enum(["modeled", "not_established"]),
    fairness: nonnegative,
    aggregateMatch: nonnegative,
    warnings: z.array(short).max(30),
  })
  .strict()
  .refine(
    (p) => p.legs.length === p.stops.length + 1,
    "Pack legs must include a return leg",
  );
const ResultSchema = z
  .object({
    requestId: short,
    datasetVersion: short,
    retrievedAt: date,
    mode: z.enum(["local_solver", "live_ai"]),
    provider: short.nullable(),
    model: short.nullable(),
    plan: PlanSchema.nullable(),
    candidates: z.array(POISchema).max(30),
    exclusions: z
      .array(z.object({ id: short, reasons: z.array(short).max(20) }).strict())
      .max(1000),
    trace: z
      .array(
        z
          .object({
            stage: short,
            summary: z.string().max(10000),
            ids: z.array(short).max(100).optional(),
          })
          .strict(),
      )
      .max(100),
    warnings: z.array(short).max(100),
    simulation: z.boolean(),
    elapsedMs: nonnegative,
  })
  .strict();
export function validatePack(value: unknown): Pack {
  const p = z
    .object({
      format: z.literal("qala-route-pack"),
      version: z.literal(1),
      saved_at: date,
      attribution: z.string().max(500),
      datasetVersion: z.string().max(100),
      result: ResultSchema,
      publicStart: z.boolean(),
    })
    .strict()
    .parse(value);
  return p as Pack;
}
