import {
  normalize,
  haversine,
  type POI,
  type PlanRequest,
} from "../domain/index";
const vocabulary: Record<string, string[]> = {
  cafe: ["coffee", "кофе", "кафе", "кофехана", "кофе ішу"],
  museum: ["culture", "art", "музей", "мәдениет", "өнер"],
  park: ["nature", "green", "парк", "природа", "саябақ", "табиғат"],
  attraction: [
    "explore",
    "architecture",
    "достопримечательности",
    "сәулет",
    "unusual",
    "необычное",
  ],
  playground: ["family", "children", "дети", "ребенок", "бала"],
  mall: ["indoor", "break", "внутри", "үзіліс", "перерыв"],
};
const family: Record<string, string> = {
  gallery: "museum",
  artwork: "attraction",
  viewpoint: "attraction",
  garden: "park",
  restaurant: "cafe",
};
export function interestScore(p: POI, interests: string[], query = "") {
  const terms = normalize([...interests, query].join(" "));
  let score = 0;
  for (const [cat, aliases] of Object.entries(vocabulary)) {
    if (
      (p.category === cat ||
        family[p.category] === cat ||
        p.tags.includes(cat)) &&
      [cat, ...aliases].some((t) => terms.includes(normalize(t)))
    )
      score += 3;
  }
  for (const name of [p.name, ...p.aliases])
    if (normalize(name) && terms.includes(normalize(name))) score += 8;
  return score;
}
export function retrieve(pois: POI[], request: PlanRequest) {
  const tokens = normalize(request.query)
    .split(" ")
    .filter((t) => t.length > 1);
  const documents = pois.map((p) =>
    normalize([p.name, ...p.aliases, p.description, ...p.tags].join(" ")),
  );
  const df = new Map(
    tokens.map((t) => [t, documents.filter((d) => d.includes(t)).length]),
  );
  const ranked = pois
    .map((p, i) => {
      const distance = haversine(request.start, p.coordinates);
      const lexical = tokens.reduce(
        (s, t) =>
          s +
          (documents[i].includes(t)
            ? Math.log(
                1 +
                  (pois.length - (df.get(t) || 0) + 0.5) /
                    ((df.get(t) || 0) + 0.5),
              )
            : 0),
        0,
      );
      return {
        poi: p,
        distance,
        score:
          interestScore(p, request.interests, request.query) +
          lexical -
          distance / 1000 +
          (p.hours?.length?.valueOf() ? 0.6 : 0),
      };
    })
    .filter((p) => p.distance <= Math.min(request.maxDistanceMetres, 3000))
    .sort((a, b) => b.score - a.score);
  const diverse = ranked
    .filter(
      (p, i) =>
        p.score > 0 &&
        ranked.findIndex(
          (q) =>
            (family[q.poi.category] || q.poi.category) ===
            (family[p.poi.category] || p.poi.category),
        ) === i,
    )
    .slice(0, 5);
  const ids = new Set(diverse.map((p) => p.poi.id));
  return [...diverse, ...ranked.filter((p) => !ids.has(p.poi.id))].slice(0, 16);
}
