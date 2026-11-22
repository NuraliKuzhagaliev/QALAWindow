import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import "maplibre-gl/dist/maplibre-gl.css";
import type { Coord, PlanResult, Snapshot } from "../../packages/domain/index";
import type { Network } from "../../packages/planner/routes";
import { copy, type Language } from "./i18n";
type Props = {
  snapshot: Snapshot;
  network: Network;
  result: PlanResult | null;
  start: Coord;
  end: Coord;
  selecting: boolean;
  onPick: (c: Coord) => void;
  selected: number;
  onSelect: (i: number) => void;
  language: Language;
};
export default function MapView(p: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  const pick = useRef(p.onPick),
    selecting = useRef(p.selecting);
  pick.current = p.onPick;
  selecting.current = p.selecting;
  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: p.start,
      zoom: 14,
      attributionControl: { compact: true },
      maxZoom: 18,
    });
    map.current = m;
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    m.on("load", () => {
      setLoaded(true);
      m.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#123f36",
          "line-width": 7,
          "line-opacity": 0.9,
        },
        layout: { "line-join": "round", "line-cap": "round" },
      });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#d5ee8a", "line-width": 3 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
    });
    m.on("error", (e) => {
      if (!m.isStyleLoaded()) setFailed(true);
    });
    m.on("click", (e) => {
      if (selecting.current) pick.current([e.lngLat.lng, e.lngLat.lat]);
    });
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !loaded) return;
    const m = map.current;
    markers.current.forEach((x) => x.remove());
    markers.current = [];
    function marker(c: Coord, label: string, cls: string, index?: number) {
      const button = document.createElement("button");
      button.className = `map-pin ${cls}`;
      button.textContent = label;
      button.setAttribute(
        "aria-label",
        index === undefined
          ? label
          : p.result?.plan?.stops[index].poi.name || label,
      );
      if (index !== undefined) button.onclick = () => p.onSelect(index);
      markers.current.push(
        new maplibregl.Marker({ element: button }).setLngLat(c).addTo(m),
      );
    }
    marker(p.start, "S", "start-pin");
    const plan = p.result?.plan;
    plan?.stops.forEach((s, i) =>
      marker(
        s.poi.coordinates,
        String(i + 1),
        i === p.selected ? "selected-pin" : "",
        i,
      ),
    );
    if (p.end[0] !== p.start[0] || p.end[1] !== p.start[1])
      marker(p.end, "E", "start-pin");
    const features = (plan?.legs || [])
      .filter((l) => l.geometry.length > 1)
      .map((l) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: l.geometry },
      }));
    (m.getSource("route") as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features,
    });
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(p.start);
    plan?.stops.forEach((s) => bounds.extend(s.poi.coordinates));
    if (plan)
      m.fitBounds(bounds, {
        padding: 90,
        maxZoom: 15,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 400,
      });
    else m.easeTo({ center: p.start, duration: 400 });
  }, [p.result, p.start, p.end, loaded, p.selected]);
  const points = [
    p.start,
    ...(p.result?.plan?.stops.map((s) => s.poi.coordinates) || []),
  ];
  const geometry = p.result?.plan?.legs.flatMap((l) => l.geometry) || points;
  const all = geometry.length ? geometry : points;
  const pad = p.result?.plan ? 0.003 : 0.012;
  const minx =
      Math.min(...all.map((c) => c[0]), ...points.map((c) => c[0])) - pad,
    maxx = Math.max(...all.map((c) => c[0]), ...points.map((c) => c[0])) + pad,
    miny = Math.min(...all.map((c) => c[1]), ...points.map((c) => c[1])) - pad,
    maxy = Math.max(...all.map((c) => c[1]), ...points.map((c) => c[1])) + pad;
  const project = (c: Coord) => [
    50 + ((c[0] - minx) / (maxx - minx)) * 700,
    50 + ((maxy - c[1]) / (maxy - miny)) * 600,
  ];
  const localWays = p.network.ways.filter((w) =>
    w.coordinates.some(
      (c) => c[0] > minx && c[0] < maxx && c[1] > miny && c[1] < maxy,
    ),
  );
  return (
    <>
      <div
        ref={container}
        className={`map-canvas ${p.selecting ? "map-selecting" : ""}`}
        style={{ opacity: loaded ? 1 : 0 }}
        aria-label="Astana map"
      />
      {!loaded && (
        <div className="schematic">
          <svg
            viewBox="0 0 800 700"
            role="img"
            aria-label={copy[p.language].noMap}
            onClick={(e) => {
              if (!p.selecting) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 800,
                y = ((e.clientY - rect.top) / rect.height) * 700;
              p.onPick([
                minx + ((x - 50) / 700) * (maxx - minx),
                maxy - ((y - 50) / 600) * (maxy - miny),
              ]);
            }}
          >
            {localWays.map((w) => (
              <polyline
                key={w.id}
                points={w.coordinates
                  .map((c) => project(c).join(","))
                  .join(" ")}
                fill="none"
                stroke={
                  ["footway", "pedestrian", "path"].includes(w.tags.highway)
                    ? "#c1cdb6"
                    : "#f8f8ee"
                }
                strokeWidth={
                  ["footway", "pedestrian", "path"].includes(w.tags.highway)
                    ? 2
                    : 5
                }
                strokeLinecap="round"
              />
            ))}
            {p.result?.plan?.legs.map((l, i) => (
              <polyline
                key={i}
                points={l.geometry.map((c) => project(c).join(",")).join(" ")}
                fill="none"
                stroke="#123f36"
                strokeWidth="5"
                strokeLinecap="round"
              />
            ))}
            {points.map((c, i) => (
              <g key={i} transform={`translate(${project(c).join(",")})`}>
                <circle
                  r={i === p.selected + 1 ? 22 : 18}
                  fill={i ? "#123f36" : "#d5ee8a"}
                  stroke="#f6f3ec"
                  strokeWidth="3"
                />
                <text textAnchor="middle" y="6" fill={i ? "white" : "#123f36"}>
                  {i || "S"}
                </text>
              </g>
            ))}
          </svg>
          <p>
            {copy[p.language].noMap} · {p.network.retrieved_at.slice(0, 10)}
          </p>
        </div>
      )}
      <div className="map-caption">
        <span className="status-dot" />
        {copy[p.language].coverageDetail}
      </div>
      <div className="north">
        N<span>↑</span>
      </div>
      {p.selecting && (
        <div className="map-select-hint">{copy[p.language].mapHint}</div>
      )}
    </>
  );
}
