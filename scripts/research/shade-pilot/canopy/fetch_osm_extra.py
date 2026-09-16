"""R3c 보조: OSM 물 폴리곤·임상 폴리곤·도로를 받아 물가 정의 / canopyCover 대조 / CHM 오분류 점검에 쓴다.

실행:  .venv/bin/python -m canopy.fetch_osm_extra [--offline]
산출:  data/overpass_extra.json  (커밋 안 함)
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request

import config as C

S_, W_, N_, E_ = C.BBOX[1] - 0.005, C.BBOX[0] - 0.005, C.BBOX[3] + 0.005, C.BBOX[2] + 0.005
BB = f"({S_},{W_},{N_},{E_})"
QUERY_WAYS = f"""[out:json][timeout:120];
(
  way["natural"="water"]{BB};
  relation["natural"="water"]{BB};
  way["waterway"="riverbank"]{BB};
  way["waterway"]{BB};
  way["landuse"="forest"]{BB};
  way["natural"="wood"]{BB};
  way["highway"]{BB};
  way["building"]{BB};
);
out geom tags;
"""
# 임상 relation(대형 multipolygon)은 무거워 별도 요청 — 실패해도 진행(대조 항목만 비어 있음)
QUERY_RELS = f"""[out:json][timeout:180];
(
  relation["landuse"="forest"]{BB};
  relation["natural"="wood"]{BB};
);
out geom{BB} tags;
"""
MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
OUT = C.DATA / "overpass_extra.json"


def fetch(query: str):
    body = urllib.parse.urlencode({"data": query}).encode()
    for url in MIRRORS:
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": "modu-valley-research/0.1"})
            return json.loads(urllib.request.urlopen(req, timeout=200).read())
        except Exception as e:  # noqa: BLE001
            print(f"  {url}: {e!r}", file=sys.stderr)
    return None


def main() -> None:
    if "--offline" in sys.argv and OUT.exists():
        d = json.loads(OUT.read_text())
    else:
        d = fetch(QUERY_WAYS)
        if d is None:
            raise SystemExit("Overpass 실패(ways)")
        rels = fetch(QUERY_RELS)
        if rels is None:
            print("경고: 임상 relation 요청 실패(504) — 대조 항목은 way 폴리곤만으로", file=sys.stderr)
            d["relationsFailed"] = True
        else:
            d["elements"] += rels["elements"]
        OUT.write_text(json.dumps(d, ensure_ascii=False))
    kinds = {}
    for e in d["elements"]:
        t = e.get("tags", {})
        k = "water" if t.get("natural") == "water" or t.get("waterway") == "riverbank" else "waterway" if "waterway" in t else "forest" if t.get("landuse") == "forest" or t.get("natural") == "wood" else "highway" if "highway" in t else "building" if "building" in t else "other"
        n = len(e.get("geometry", [])) if e["type"] == "way" else sum(len(m.get("geometry") or []) for m in e.get("members", []))
        kinds.setdefault(k, []).append((e["type"], e["id"], n))
    for k, v in kinds.items():
        print(f"{k:9s} {len(v):3d}개  정점 {sum(x[2] for x in v):,}  예: {v[:3]}")
    print("→", OUT)


if __name__ == "__main__":
    main()
