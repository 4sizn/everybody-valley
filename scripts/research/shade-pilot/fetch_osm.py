"""1단계: OSM Overpass 로 백운계곡 하천 라인·주변 봉우리를 받아 3구간 GeoJSON 을 만든다.

실행:  .venv/bin/python fetch_osm.py [--offline]
  --offline 이면 data/overpass.json 을 재사용한다(재요청 없음).
산출:  data/overpass.json, out/segments.geojson, out/peaks.geojson
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request

from pyproj import Geod

import config as C

QUERY = f"""
[out:json][timeout:60];
(
  way({C.OSM_WAY_ID});
  node["natural"="peak"]({C.BBOX[1]-0.02},{C.BBOX[0]-0.02},{C.BBOX[3]+0.02},{C.BBOX[2]+0.02});
  node["natural"="saddle"]({C.BBOX[1]-0.02},{C.BBOX[0]-0.02},{C.BBOX[3]+0.02},{C.BBOX[2]+0.02});
);
out geom tags;
"""
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def fetch() -> dict:
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    last = None
    for url in MIRRORS:
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": "modu-valley-research/0.1"})
            with urllib.request.urlopen(req, timeout=120) as r:
                txt = r.read().decode()
            if txt.lstrip().startswith("{"):
                return json.loads(txt)
            last = txt[:200]
        except Exception as e:  # noqa: BLE001
            last = repr(e)
    raise SystemExit(f"Overpass 실패: {last}")


def main() -> None:
    C.DATA.mkdir(exist_ok=True)
    C.OUT.mkdir(exist_ok=True)
    if "--offline" in sys.argv and C.OVERPASS_JSON.exists():
        d = json.loads(C.OVERPASS_JSON.read_text())
    else:
        d = fetch()
        C.OVERPASS_JSON.write_text(json.dumps(d, ensure_ascii=False))

    way = next(e for e in d["elements"] if e["type"] == "way" and e["id"] == C.OSM_WAY_ID)
    coords = [[p["lon"], p["lat"]] for p in way["geometry"]]
    geod = Geod(ellps="WGS84")

    feats = []
    for order, (sid, (a, b)) in enumerate(C.SEGMENT_NODE_RANGES.items(), start=1):
        line = coords[a : b + 1]
        length = sum(geod.inv(*line[i], *line[i + 1])[2] for i in range(len(line) - 1))
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "id": sid,
                    "order": order,
                    "label": C.SEGMENT_LABELS[sid],
                    "osmWay": C.OSM_WAY_ID,
                    "nodeRange": [a, b],
                    "lengthM": round(length),
                },
                "geometry": {"type": "LineString", "coordinates": line},
            }
        )
        print(f"{sid:14s} nodes {a:3d}-{b:3d}  {length:6.0f} m  {line[0]} -> {line[-1]}")
    C.SEGMENTS_GEOJSON.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, indent=1))

    peaks = [
        {
            "type": "Feature",
            "properties": {"name": e.get("tags", {}).get("name"), "ele": e.get("tags", {}).get("ele"), "kind": e["tags"].get("natural")},
            "geometry": {"type": "Point", "coordinates": [e["lon"], e["lat"]]},
        }
        for e in d["elements"]
        if e["type"] == "node" and e.get("tags", {}).get("natural") in ("peak", "saddle")
    ]
    (C.OUT / "peaks.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": peaks}, ensure_ascii=False, indent=1))
    print(f"peaks/saddles: {len(peaks)} → {C.OUT/'peaks.geojson'}")


if __name__ == "__main__":
    main()
