"""마스크 → GeoJSON 폴리곤 — R3c `clean_mask`·`polygonize` 그대로 + 분리형 레이어 파일 쓰기.

분리형: canopy.geojson(수관, CHM > 2 m, 시각 무관) 1장 + shadow-<HH>.geojson(개방지 그림자 = 시각 t 그늘 − 수관) 9장.
범위 = 구간 회랑(±200 m). 3×3 닫힘→열림 → shapes(4-연결) → 25 m² 미만 제거 → simplify 2 m → WGS84 [lng, lat] 소수 5자리.
"""
from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path

import numpy as np
from pyproj import Transformer
from rasterio import features
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform

from shade import settings as S
from shade.grid import Grid


def clean_mask(m: np.ndarray) -> np.ndarray:
    """3×3 닫힘(closing) 후 열림(opening) — 1셀 구멍·1셀 점 제거."""

    def dil(a):
        p = np.pad(a, 1)
        return p[:-2, :-2] | p[:-2, 1:-1] | p[:-2, 2:] | p[1:-1, :-2] | p[1:-1, 1:-1] | p[1:-1, 2:] | p[2:, :-2] | p[2:, 1:-1] | p[2:, 2:]

    def ero(a):
        p = np.pad(a, 1, constant_values=True)
        return p[:-2, :-2] & p[:-2, 1:-1] & p[:-2, 2:] & p[1:-1, :-2] & p[1:-1, 1:-1] & p[1:-1, 2:] & p[2:, :-2] & p[2:, 1:-1] & p[2:, 2:]

    return dil(ero(ero(dil(m))))


def _round(o, nd):
    if isinstance(o, float):
        return round(o, nd)
    if isinstance(o, (list, tuple)):
        return [_round(x, nd) for x in o]
    return o


def polygonize(mask: np.ndarray, transform, crs: str, tol_m: float = S.POLY_TOL_M, min_area_m2: float = S.POLY_MIN_AREA_M2, decimals: int = S.COORD_DECIMALS) -> list[dict]:
    """bool 마스크 → WGS84 GeoJSON geometry 목록(래스터 순서, 결정적)."""
    to_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform
    geoms = []
    for geom, _ in features.shapes(mask.astype(np.uint8), mask=mask, transform=transform, connectivity=4):
        g = shape(geom)
        if g.area < min_area_m2:
            continue
        if tol_m > 0:
            g = g.simplify(tol_m, preserve_topology=True)
        if g.is_empty:
            continue
        gj = mapping(shp_transform(to_wgs, g))
        gj = {"type": gj["type"], "coordinates": _round(gj["coordinates"], decimals)}
        geoms.append(gj)
    return geoms


def feature_collection(geoms: list[dict], props: dict, metadata: dict) -> dict:
    return OrderedDict([("type", "FeatureCollection"), ("metadata", metadata), ("features", [OrderedDict([("type", "Feature"), ("properties", dict(props)), ("geometry", g)]) for g in geoms])])


def dumps_compact(fc: dict) -> str:
    return json.dumps(fc, ensure_ascii=False, separators=(",", ":")) + "\n"


def write_shade_layers(grid: Grid, shades: dict[str, np.ndarray], under: np.ndarray, corridor: np.ndarray, valley_id: str, out_dir: Path, metadata: dict, tol_m: float = S.POLY_TOL_M, min_area_m2: float = S.POLY_MIN_AREA_M2, decimals: int = S.COORD_DECIMALS) -> "OrderedDict[str, str]":
    """분리형 레이어 텍스트를 만든다(쓰지는 않는다 — 호출자가 기존 파일과 비교 후 쓴다). 반환: {파일명: 본문}."""
    files: OrderedDict[str, str] = OrderedDict()
    base_meta = OrderedDict(metadata)
    canopy_geoms = polygonize(clean_mask(under & corridor), grid.core_transform, grid.crs, tol_m, min_area_m2, decimals)
    meta_c = OrderedDict(base_meta)
    meta_c["layer"] = "canopy"
    meta_c["description"] = f"수관 아래(CHM > {S.CANOPY_THRESHOLD_M:g} m) — 시각 무관. 구간 회랑 ±{S.CORRIDOR_HALF_M:g} m 절단"
    files["canopy.geojson"] = dumps_compact(feature_collection(canopy_geoms, {"valleyId": valley_id, "layer": "canopy", "date": S.REPRESENTATIVE_DATE}, meta_c))
    for hh in S.HOURS:
        geoms = polygonize(clean_mask(shades[hh] & ~under & corridor), grid.core_transform, grid.crs, tol_m, min_area_m2, decimals)
        meta_s = OrderedDict(base_meta)
        meta_s["layer"] = "shadow"
        meta_s["timeLocal"] = hh
        meta_s["description"] = f"개방지(CHM ≤ {S.CANOPY_THRESHOLD_M:g} m)에 드리운 나무·지형 그림자, {S.REPRESENTATIVE_DATE} {hh} KST. canopy 위에 겹쳐 그린다"
        files[f"shadow-{hh[:2]}.geojson"] = dumps_compact(feature_collection(geoms, {"valleyId": valley_id, "layer": "shadow", "date": S.REPRESENTATIVE_DATE, "timeLocal": hh}, meta_s))
    return files
