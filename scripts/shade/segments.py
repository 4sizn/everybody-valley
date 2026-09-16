"""입력 GeoJSON(구간 LineString·시설 Point) 읽기, valleyId 묶기, 버퍼·회랑 래스터화, 구간 속성 집계."""
from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path

import numpy as np
from pyproj import Transformer
from rasterio import features
from shapely.geometry import LineString, Point, mapping, shape
from shapely.ops import transform as shp_transform

from shade import settings as S
from shade.assets import Bbox, expand_bbox_m
from shade.grid import Grid


def load_collection(path: Path) -> dict:
    """키 순서를 보존해 읽는다(역기입 때 포맷 보존)."""
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=OrderedDict)


def group_by_valley(fc: dict) -> "OrderedDict[str, list[dict]]":
    """`properties.valleyId` 로 묶는다. 계곡 순서 = 첫 구간이 나타난 순서."""
    out: OrderedDict[str, list[dict]] = OrderedDict()
    for f in fc.get("features", []):
        vid = f.get("properties", {}).get("valleyId")
        if not vid:
            raise ValueError(f"properties.valleyId 가 없는 피처: {f.get('properties', {}).get('id')}")
        out.setdefault(vid, []).append(f)
    return out


def _coords_bounds(features: list[dict]) -> Bbox:
    xs, ys = [], []
    for f in features:
        g = f["geometry"]
        pts = g["coordinates"] if g["type"] == "LineString" else [g["coordinates"]]
        for p in pts:
            xs.append(p[0])
            ys.append(p[1])
    return min(xs), min(ys), max(xs), max(ys)


def valley_bbox(segments: list[dict], facilities: list[dict]) -> Bbox:
    """코어 bbox = 구간(+시설) 경계 + 회랑 반폭 + 여유. 회랑 폴리곤·50 m 버퍼가 모두 코어 안에 놓인다."""
    return expand_bbox_m(_coords_bounds(segments + facilities), S.CORRIDOR_HALF_M + S.BBOX_PAD_M)


def to_utm_geoms(features: list[dict], crs: str) -> list[tuple[dict, object]]:
    to_utm = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    return [(f["properties"], shp_transform(to_utm, shape(f["geometry"]))) for f in features]


def rasterize(geoms, grid: Grid) -> np.ndarray:
    if not geoms:
        return np.zeros(grid.core_shape, dtype=bool)
    m = features.rasterize([(mapping(g), 1) for g in geoms], out_shape=grid.core_shape, transform=grid.core_transform, fill=0, dtype="uint8")
    return m.astype(bool)


def buffer_mask(line: LineString, grid: Grid, half_m: float = S.BUFFER_HALF_M) -> np.ndarray:
    """구간 라인 ±half_m 평행 버퍼(끝은 자름, cap_style=2) — R3c 구간 집계 정의."""
    return rasterize([line.buffer(half_m, cap_style=2)], grid)


def corridor_mask(lines: list[LineString], points: list[Point], grid: Grid, half_m: float = S.CORRIDOR_HALF_M) -> np.ndarray:
    """폴리곤 절단 회랑 — 라인 ±half_m(둥근 끝, cap_style=1) ∪ 시설 점 반경 half_m."""
    return rasterize([g.buffer(half_m, cap_style=1) for g in [*lines, *points]], grid)


def segment_props(grid: Grid, segments: list[tuple[dict, LineString]], shades: dict[str, np.ndarray], under: np.ndarray, buffer_half_m: float = S.BUFFER_HALF_M) -> "OrderedDict[str, dict]":
    """{segmentId: {"canopyCover": float, "shadeByHour": [float × len(HOURS)]}} — 버퍼 래스터화 후 mean. 소수 PROP_DECIMALS."""
    out: OrderedDict[str, dict] = OrderedDict()
    for props, line in segments:
        bm = buffer_mask(line, grid, buffer_half_m)
        if not bm.any():
            raise ValueError(f"구간 {props['id']} 의 버퍼가 격자 안에 셀을 하나도 갖지 않는다")
        out[props["id"]] = {
            "canopyCover": round(float(under[bm].mean()), S.PROP_DECIMALS),
            "shadeByHour": [round(float(shades[h][bm].mean()), S.PROP_DECIMALS) for h in S.HOURS],
            "bufferCells": int(bm.sum()),
        }
    return out
