import { haversine, type Coord, type Leg } from "../domain/index";
export type Network = {
  version: string;
  retrieved_at: string;
  source: string;
  attribution: string;
  ways: {
    id: number;
    nodes: number[];
    coordinates: Coord[];
    tags: Record<string, string>;
  }[];
};
type Edge = { to: number; metres: number; way: number };
export class WalkingGraph {
  nodes = new Map<number, Coord>();
  adj = new Map<number, Edge[]>();
  cache = new Map<string, Leg | null>();
  constructor(public network: Network) {
    for (const w of network.ways) {
      if (
        w.tags.foot === "no" ||
        w.tags.access === "private" ||
        (w.tags.highway === "path" && w.tags.access === "no")
      )
        continue;
      if (
        ["primary", "secondary", "tertiary"].includes(w.tags.highway) &&
        !["yes", "designated"].includes(w.tags.foot) &&
        !w.tags.sidewalk?.match(/yes|both|left|right/)
      )
        continue;
      for (let i = 0; i < w.nodes.length; i++) {
        this.nodes.set(w.nodes[i], w.coordinates[i]);
        if (i) {
          const a = w.nodes[i - 1],
            b = w.nodes[i],
            m = haversine(w.coordinates[i - 1], w.coordinates[i]);
          this.adj.set(a, [
            ...(this.adj.get(a) || []),
            { to: b, metres: m, way: w.id },
          ]);
          this.adj.set(b, [
            ...(this.adj.get(b) || []),
            { to: a, metres: m, way: w.id },
          ]);
        }
      }
    }
  }
  nearest(c: Coord) {
    let found: number | undefined,
      metres = Infinity;
    for (const [id, pos] of this.nodes) {
      const d = haversine(c, pos);
      if (d < metres) {
        found = id;
        metres = d;
      }
    }
    return { id: found, metres };
  }
  route(from: string, a: Coord, to: string, b: Coord): Leg | null {
    const key = JSON.stringify([a, b]);
    if (this.cache.has(key)) {
      const leg = this.cache.get(key);
      return leg ? { ...leg, from, to } : null;
    }
    const start = this.nearest(a),
      end = this.nearest(b);
    if (
      start.id === undefined ||
      end.id === undefined ||
      start.metres > 100 ||
      end.metres > 100
    ) {
      this.cache.set(key, null);
      return null;
    }
    const distances = new Map<number, number>([[start.id, 0]]),
      previous = new Map<number, { node: number; way: number }>(),
      queue: { id: number; d: number }[] = [{ id: start.id, d: 0 }];
    // Binary min-heap keeps shortest path computation bounded by this collected network.
    const push = (v: { id: number; d: number }) => {
      queue.push(v);
      let i = queue.length - 1;
      while (i) {
        const p = (i - 1) >> 1;
        if (queue[p].d <= v.d) break;
        queue[i] = queue[p];
        i = p;
      }
      queue[i] = v;
    };
    const pop = () => {
      const v = queue[0],
        last = queue.pop()!;
      if (queue.length) {
        let i = 0;
        while (i * 2 + 1 < queue.length) {
          let child = i * 2 + 1;
          if (child + 1 < queue.length && queue[child + 1].d < queue[child].d)
            child++;
          if (queue[child].d >= last.d) break;
          queue[i] = queue[child];
          i = child;
        }
        queue[i] = last;
      }
      return v;
    };
    while (queue.length) {
      const current = pop();
      if (current.d !== distances.get(current.id)) continue;
      if (current.id === end.id) break;
      for (const e of this.adj.get(current.id) || []) {
        const d = current.d + e.metres;
        if (d < (distances.get(e.to) ?? Infinity)) {
          distances.set(e.to, d);
          previous.set(e.to, { node: current.id, way: e.way });
          push({ id: e.to, d });
        }
      }
    }
    if (!distances.has(end.id)) {
      this.cache.set(key, null);
      return null;
    }
    const coords: Coord[] = [],
      ways: number[] = [];
    let n = end.id;
    coords.push(this.nodes.get(n)!);
    while (n !== start.id) {
      const p = previous.get(n);
      if (!p) {
        this.cache.set(key, null);
        return null;
      }
      ways.push(p.way);
      n = p.node;
      coords.push(this.nodes.get(n)!);
    }
    coords.reverse();
    ways.reverse();
    // Geometry stays on the recorded network. Snap connectors are disclosed, never drawn as roads.
    if (coords.length < 2 && haversine(a, b) > 15) {
      this.cache.set(key, null);
      return null;
    }
    const metres = distances.get(end.id)! + start.metres + end.metres;
    const leg: Leg = {
      from,
      to,
      metres,
      seconds: Math.ceil(metres / 1.15),
      geometry: coords,
      snapMetres: [start.metres, end.metres],
      source: "Collected OSM pedestrian network · local Dijkstra",
      profile: "foot (1.15 m/s modeled)",
      retrieved_at: this.network.retrieved_at,
      access: "unknown",
      wayIds: [...new Set(ways)],
    };
    this.cache.set(key, leg);
    return leg;
  }
}
