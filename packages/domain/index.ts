import { z } from "zod";
export type Coord = [number, number];
export const CoordSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
export const inCity = (
  c: Coord,
  bounds?: { minlat: number; maxlat: number; minlon: number; maxlon: number },
) =>
  bounds
    ? c[0] >= bounds.minlon &&
      c[0] <= bounds.maxlon &&
      c[1] >= bounds.minlat &&
      c[1] <= bounds.maxlat
    : c[0] >= 70.7 && c[0] <= 72 && c[1] >= 50.8 && c[1] <= 51.6;
export const safeText = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    // eslint-disable-next-line no-control-regex -- reject executable markup and control bytes.
    (s) => !/[<>\u0000-\u0008]|^\s*[=+@-]/.test(s),
    "Executable/markup content is not accepted",
  );
export const PersonSchema = z
  .object({
    id: z.string().max(40),
    interests: z.array(z.string().max(40)).max(6),
    stepFree: z.enum(["off", "preferred", "required"]).default("off"),
    sockets: z.boolean().default(false),
    quiet: z.boolean().default(false),
    child: z.boolean().default(false),
    maxWalkMinutes: z.number().min(1).max(90).default(30),
  })
  .strict();
export const RequestSchema = z
  .object({
    query: z.string().max(800).default(""),
    start: CoordSchema,
    end: CoordSchema,
    startTime: z.string().datetime({ offset: true }),
    deadline: z.string().datetime({ offset: true }),
    interests: z.array(z.string().max(40)).max(8).default([]),
    language: z.enum(["en", "ru", "kk"]).default("en"),
    movement: z.literal("walking").default("walking"),
    bufferMinutes: z.number().int().min(0).max(30).default(5),
    outdoorMinutes: z.number().min(0).max(180).default(90),
    maxWalkMinutes: z.number().min(1).max(90).default(30),
    maxDistanceMetres: z.number().min(50).max(15000).default(5000),
    stepFree: z.enum(["off", "preferred", "required"]).default("off"),
    breakPreference: z.enum(["none", "rest", "indoor"]).default("none"),
    sockets: z.boolean().default(false),
    quiet: z.boolean().default(false),
    child: z.boolean().default(false),
    freeOnly: z.boolean().default(false),
    requireHours: z.boolean().default(false),
    people: z.array(PersonSchema).max(5).default([]),
    closedIds: z.array(z.string().max(80)).max(20).default([]),
    simulation: z.boolean().default(false),
    usableAirportBudget: z.boolean().default(false),
  })
  .strict()
  .refine(
    (r) =>
      Date.parse(r.deadline) > Date.parse(r.startTime) &&
      Date.parse(r.deadline) - Date.parse(r.startTime) <= 180 * 60000,
    "Window must be 1-180 minutes",
  );
export type PlanRequest = z.infer<typeof RequestSchema>;
export type Field = {
  value: unknown;
  source_id: string;
  retrieved_at: string;
  source_updated_at: string | null;
  transformation: string;
  state: "source" | "unknown" | "conflict";
};
export type Source = {
  id: string;
  url: string;
  retrieved_at: string;
  source_updated_at: string | null;
  raw_tags: Record<string, string>;
  hash: string;
  license: string;
};
export type POI = {
  id: string;
  name: string;
  coordinates: Coord;
  category: string;
  tags: string[];
  aliases: string[];
  description: string;
  description_kind: string;
  hours: string | null;
  contact: string | null;
  rating: number | null;
  popularity: number | null;
  indoor: boolean | null;
  entranceAccess: "tagged" | "no" | "unknown";
  sockets: boolean | null;
  quiet: boolean | null;
  childSuitable: boolean | null;
  price: string | null;
  visitSeconds: number[];
  fields: Record<string, Field>;
  sources: Source[];
  challenge?: boolean;
};
export type Snapshot = {
  version: string;
  retrieved_at: string;
  boundary: {
    id: number;
    bounds: { minlat: number; maxlat: number; minlon: number; maxlon: number };
    source_url: string;
  };
  anchors: {
    id: string;
    name: string;
    coordinates: Coord;
    aliases: string[];
  }[];
  attribution: string;
  pois: POI[];
};
export type Leg = {
  from: string;
  to: string;
  metres: number;
  seconds: number;
  geometry: Coord[];
  snapMetres: [number, number];
  source: string;
  profile: string;
  retrieved_at: string;
  access: "unknown" | "tagged";
  wayIds: number[];
};
export type Stop = {
  poi: POI;
  arrival: string;
  departure: string;
  dwellSeconds: number;
  hours: "scheduled" | "unknown" | "conflict" | "closed";
  matches: number[];
  reason: string;
  activity: string;
};
export type Plan = {
  id: string;
  stops: Stop[];
  legs: Leg[];
  travelSeconds: number;
  visitSeconds: number;
  outdoorSeconds: number;
  bufferSeconds: number;
  slackSeconds: number;
  returnTime: string;
  feasibility: "modeled" | "not_established";
  fairness: number;
  aggregateMatch: number;
  warnings: string[];
};
export type Trace = { stage: string; summary: string; ids?: string[] };
export type PlanResult = {
  requestId: string;
  datasetVersion: string;
  retrievedAt: string;
  mode: "local_solver" | "live_ai";
  provider: string | null;
  model: string | null;
  plan: Plan | null;
  candidates: POI[];
  exclusions: { id: string; reasons: string[] }[];
  trace: Trace[];
  warnings: string[];
  simulation: boolean;
  elapsedMs: number;
};
export const haversine = (a: Coord, b: Coord) => {
  const r = Math.PI / 180;
  return Math.round(
    12742000 *
      Math.asin(
        Math.sqrt(
          Math.sin(((b[1] - a[1]) * r) / 2) ** 2 +
            Math.cos(a[1] * r) *
              Math.cos(b[1] * r) *
              Math.sin(((b[0] - a[0]) * r) / 2) ** 2,
        ),
      ),
  );
};
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function astanaWallDate(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}
export function astanaInput(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(" ", "T");
}
export const isoAstana = (input: string) =>
  new Date(input + "+05:00").toISOString();
export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
export const redact = (s: string) =>
  s
    .replace(/[-+]?\d{1,3}\.\d{3,}/g, "[coordinate]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/(?:\+?\d[\d ()-]{8,}\d)/g, "[number]")
    .slice(0, 800);
