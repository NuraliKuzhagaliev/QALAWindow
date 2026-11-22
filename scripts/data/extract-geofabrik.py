"""Extract Astana POIs and walking ways from a public Geofabrik OSM PBF."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from math import cos, radians
from pathlib import Path

import osmium


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def facts(obj):
    edited = obj.timestamp.isoformat().replace("+00:00", "Z")
    return {"id": obj.id, "tags": dict(obj.tags), "timestamp": edited}


def is_destination(tags):
    return bool(tags.get("name")) and (
        tags.get("tourism") in {"museum", "attraction", "artwork", "gallery", "viewpoint"}
        or tags.get("amenity") in {"cafe", "restaurant", "library", "arts_centre"}
        or tags.get("leisure") in {"park", "playground", "garden"}
        or tags.get("shop") == "mall"
    )


def extract(source, reference, output):
    city = reference["boundary"]
    area = city["bounds"]
    anchors = [a["coordinates"] for a in reference["anchors"]]
    anchor_ids = {a["id"] for a in reference["anchors"]}
    ways = {}
    points = {}
    pois = {}
    walking = []
    boundary = None
    # Include a margin so a way can cross the prior boundary without losing vertices.
    west, east = area["minlon"] - 0.02, area["maxlon"] + 0.02
    south, north = area["minlat"] - 0.02, area["maxlat"] + 0.02

    def inside(x, y):
        return west <= x <= east and south <= y <= north

    def nearby(x, y, metres):
        return any(
            ((x - lon) * 111_320 * cos(radians(lat))) ** 2
            + ((y - lat) * 111_320) ** 2 <= metres ** 2
            for lon, lat in anchors
        )

    class Collector(osmium.SimpleHandler):
        def node(self, node):
            if not node.location.valid():
                return
            lon, lat = node.location.lon, node.location.lat
            if not inside(lon, lat):
                return
            points[node.id] = (lon, lat)
            if nearby(lon, lat, 2300) and (is_destination(node.tags) or f"node/{node.id}" in anchor_ids):
                pois[("node", node.id)] = {"type": "node", **facts(node), "lat": lat, "lon": lon}

        def way(self, way):
            ids = [node.ref for node in way.nodes]
            coords = [points.get(node_id) for node_id in ids]
            if not coords or any(point is None for point in coords):
                return
            xs, ys = zip(*coords)
            center = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)
            ways[way.id] = (min(xs), min(ys), max(xs), max(ys))
            if nearby(*center, 2300) and (is_destination(way.tags) or f"way/{way.id}" in anchor_ids):
                pois[("way", way.id)] = {
                    "type": "way", **facts(way), "center": {"lon": center[0], "lat": center[1]}
                }
            if (
                len(ids) >= 2 and way.tags.get("highway") in {
                    "footway", "pedestrian", "path", "living_street", "residential",
                    "service", "steps", "cycleway", "track", "unclassified",
                }
                and way.tags.get("access") != "private" and way.tags.get("foot") != "no"
                and any(nearby(x, y, 1500) for x, y in coords)
            ):
                walking.append({
                    "type": "way", **facts(way), "nodes": ids,
                    "geometry": [{"lon": x, "lat": y} for x, y in coords],
                })

        def relation(self, relation):
            nonlocal boundary
            if relation.id != city["id"] and not is_destination(relation.tags):
                return
            members = [m.ref for m in relation.members if m.type == "w" and m.role != "inner"]
            boxes = [ways[ref] for ref in members if ref in ways]
            if not boxes or len(boxes) != len(members):
                return
            box = dict(zip(
                ("minlon", "minlat", "maxlon", "maxlat"),
                (min(b[0] for b in boxes), min(b[1] for b in boxes),
                 max(b[2] for b in boxes), max(b[3] for b in boxes)),
            ))
            if relation.id == city["id"] and relation.tags.get("wikidata") == "Q1520":
                boundary = {"type": "relation", **facts(relation), "bounds": box}
            elif is_destination(relation.tags):
                lon, lat = (box["minlon"] + box["maxlon"]) / 2, (box["minlat"] + box["maxlat"]) / 2
                if nearby(lon, lat, 2300):
                    pois[("relation", relation.id)] = {
                        "type": "relation", **facts(relation), "center": {"lon": lon, "lat": lat}
                    }

    with osmium.io.Reader(str(source)) as reader:
        source_timestamp = reader.header().get("osmosis_replication_timestamp")
    if not source_timestamp:
        raise ValueError("PBF has no replication timestamp")
    Collector().apply_file(str(source))
    found = {f"{kind}/{id_}" for kind, id_ in pois}
    if boundary is None or anchor_ids - found or len(pois) < 60 or len(walking) < 2000:
        raise ValueError(f"Incomplete extract: boundary={bool(boundary)}, POIs={len(pois)}, ways={len(walking)}")
    metadata = {
        "endpoint": "https://download.geofabrik.de/asia/kazakhstan.html",
        "source_timestamp": source_timestamp,
        "source_sha256": digest(source),
        "retrieved_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    output.mkdir(parents=True, exist_ok=True)
    for name, elements in (("boundary", [boundary]), ("pois", list(pois.values())), ("network", walking)):
        out = output / f"{name}.raw.json"
        out.write_text(json.dumps({**metadata, "elements": elements}, ensure_ascii=False), encoding="utf-8")
    print(f"{source_timestamp}: {len(pois)} POI candidates and {len(walking)} walking ways")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("pbf", type=Path)
    parser.add_argument("reference", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    extract(args.pbf, json.loads(args.reference.read_text(encoding="utf-8")), args.output)
