import { normalize, type Snapshot, type Coord } from "../domain/index";
export function resolveLandmark(
  snapshot: Snapshot,
  query: string,
): {
  state: "none" | "ambiguous" | "found";
  matches: { id: string; label: string; coordinates: Coord }[];
} {
  const term = normalize(query);
  if (!term) return { state: "none", matches: [] };
  const matches = new Map<
    string,
    { id: string; label: string; coordinates: Coord }
  >();
  for (const anchor of snapshot.anchors)
    if (
      [anchor.name, ...anchor.aliases].some((name) => normalize(name) === term)
    )
      matches.set(anchor.id, {
        id: anchor.id,
        label: anchor.name,
        coordinates: anchor.coordinates,
      });
  for (const poi of snapshot.pois)
    if ([poi.name, ...poi.aliases].some((name) => normalize(name) === term))
      matches.set(poi.id, {
        id: poi.id,
        label: poi.name,
        coordinates: poi.coordinates,
      });
  const list = [...matches.values()];
  return {
    state: list.length === 1 ? "found" : list.length ? "ambiguous" : "none",
    matches: list,
  };
}
