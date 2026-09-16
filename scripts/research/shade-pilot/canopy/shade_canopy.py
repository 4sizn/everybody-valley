"""R3c 2단계: 지형(GLO-30 30m) + 수관(CHM 1m) 시간대별 그늘.

셀 (x, t) 가 그늘이면:
  (a) 셀의 CHM > 2 m — 나무 아래(시각 무관)
  (b) 태양 반대 방향으로 전파한 그림자 높이 H(x) > 표면 z(x) — 나무·근거리 지형이 드리운 그림자.
      H 는 태양 방위 방향으로 스캔라인 전파(O(N)): H = max(z, H_prev − step·tan(el)). 유효 사거리 제한 없음(격자 = bbox + 200 m).
  (c) R3b 30m 지형 마스크(6 km 지평선) — 원거리 능선 그림자를 OR.

표면 z = 지반 + CHM. 지반은 GLO-30 이 DSM(수관 포함)이라 **GLO-30 − CHM 의 30 m 평균** 으로 보정한 값을 기본으로 쓰고,
보정 없이 GLO-30 + CHM 을 쓴 변형("naive")을 민감도로 함께 낸다.

실행:  .venv/bin/python -m canopy.shade_canopy [--res 1|2] [--no-polygons] [--sens]
전제:  canopy.fetch_chm 실행(data/chm_utm_*.tif, data/dem_utm_*.tif), out/dem_utm.tif, out/segments.geojson
산출:  out/canopy/result-<res>m.json, out/canopy/shade-0801-<HH>.geojson (9장), out/canopy/masks-<res>m.npz(커밋 안 함),
       out/canopy/polygon-sizes-<res>m.json
"""
from __future__ import annotations

import gzip
import json
import resource
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio import features
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform

import config as C
from canopy import settings as S
from shade import Dem, sun_position

TZ = ZoneInfo(C.TZ)


def local(date: str, hhmm: str) -> datetime:
    return datetime.fromisoformat(f"{date}T{hhmm}:00").replace(tzinfo=TZ)


def rss_mb() -> float:
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 * 1024)  # macOS: bytes


# --------------------------------------------------------------------------- 격자
class Grid:
    """UTM 52N res m 격자: CHM, DSM(GLO-30 bilinear), 보정 지반, 코어(bbox) 창."""

    def __init__(self, res: int):
        self.res = res
        with rasterio.open(S.chm_utm(res)) as src:
            self.chm = src.read(1).astype(np.float32)
            self.transform = src.transform
        with rasterio.open(S.dem_utm_fine(res)) as src:
            self.dsm = src.read(1)
        self.dsm = np.where(np.isnan(self.dsm), np.nanmin(self.dsm), self.dsm).astype(np.float32)
        # 코어(bbox) 창
        to_utm = Transformer.from_crs("EPSG:4326", C.CRS_METRIC, always_xy=True)
        w, s, e, n = C.BBOX
        xs, ys = to_utm.transform([w, e, w, e], [s, s, n, n])
        inv = ~self.transform
        c0, r0 = inv * (min(xs), max(ys))
        c1, r1 = inv * (max(xs), min(ys))
        self.core = (slice(int(np.floor(r0)), int(np.ceil(r1))), slice(int(np.floor(c0)), int(np.ceil(c1))))
        self.core_transform = self.transform * rasterio.Affine.translation(self.core[1].start, self.core[0].start)
        self.core_shape = (self.core[0].stop - self.core[0].start, self.core[1].stop - self.core[1].start)
        self.ground = self.corrected_ground()

    def corrected_ground(self) -> np.ndarray:
        """GLO-30(DSM) − 30 m 블록 평균 CHM ≈ 지반. 30 m 격자로 평균 → bilinear 로 다시 올린다."""
        with rasterio.open(C.DEM_UTM) as src:
            t30, w30, h30 = src.transform, src.width, src.height
        chm30 = np.zeros((h30, w30), dtype=np.float32)
        reproject(self.chm, chm30, src_transform=self.transform, src_crs=C.CRS_METRIC, dst_transform=t30, dst_crs=C.CRS_METRIC, resampling=Resampling.average, dst_nodata=0)
        chm30_fine = np.zeros_like(self.dsm)
        reproject(chm30, chm30_fine, src_transform=t30, src_crs=C.CRS_METRIC, dst_transform=self.transform, dst_crs=C.CRS_METRIC, resampling=Resampling.bilinear, dst_nodata=0)
        return self.dsm - chm30_fine

    def crop(self, a: np.ndarray) -> np.ndarray:
        return a[self.core]


# --------------------------------------------------------------------------- 그림자 전파
def _propagate_rows(z: np.ndarray, f: float, drop: float) -> np.ndarray:
    """행 0 → 끝 방향으로 그림자 높이 전파. 한 행 내려갈 때 열은 f 만큼 이동, 높이는 drop 만큼 감소.

    열 이동은 누적 오프셋 round(i·f) 의 차분(0 또는 ±1, Bresenham 식)으로 정수 이동한다 — 선형 보간은 좁은 물체의
    그림자를 감쇠시키고(1셀 기둥이 대각 방위에서 3 m 만 드리움), 매 행 round(f) 는 방향을 틀리게 하므로.
    """
    h, w = z.shape
    H = np.empty_like(z)
    H[0] = z[0]
    neg = np.float32(-1e9)
    offs = np.round(np.arange(h) * f).astype(np.int64)
    for i in range(1, h):
        prev = H[i - 1]
        k = offs[i] - offs[i - 1]  # 이번 행에서의 열 이동(그림자는 열 +k 방향으로 간다)
        if k == 0:
            s = prev
        elif k > 0:
            s = np.concatenate([np.full(k, neg, dtype=np.float32), prev[:-k]])
        else:
            s = np.concatenate([prev[-k:], np.full(-k, neg, dtype=np.float32)])
        H[i] = np.maximum(z[i], s - drop)
    return H


def cast_shadow_height(z: np.ndarray, res: float, az_deg: float, el_deg: float) -> np.ndarray:
    """태양(방위 az, 고도 el)이 표면 z 에 드리우는 그림자 높이 H (H > z 이면 그늘)."""
    az = np.deg2rad(az_deg)
    tan_el = np.tan(np.deg2rad(el_deg))
    # 그림자 진행 방향(태양 반대) — 픽셀 좌표: 열(+동) = −sin(az), 행(+남) = +cos(az)
    dcol, drow = -np.sin(az), np.cos(az)
    if abs(drow) >= abs(dcol):
        zz = z if drow > 0 else z[::-1]
        f = dcol / abs(drow)
        step = res * np.sqrt(1 + f * f)
        H = _propagate_rows(zz, f, np.float32(step * tan_el))
        return H if drow > 0 else H[::-1]
    zt = z.T  # 열 방향 전파 → 전치해서 행 전파로
    zz = zt if dcol > 0 else zt[::-1]
    f = drow / abs(dcol)
    step = res * np.sqrt(1 + f * f)
    H = _propagate_rows(zz, f, np.float32(step * tan_el))
    H = H if dcol > 0 else H[::-1]
    return H.T


def terrain_mask_fine(dem30: Dem, az: float, el: float, grid: Grid) -> np.ndarray:
    """R3b 30 m 지형 마스크(코어 창)를 세밀 격자 코어 창에 nearest 로 올린다."""
    m30 = dem30.shade_mask(az, el).astype(np.uint8)
    out = np.zeros(grid.core_shape, dtype=np.uint8)
    reproject(m30, out, src_transform=dem30.core_transform, src_crs=C.CRS_METRIC, dst_transform=grid.core_transform, dst_crs=C.CRS_METRIC, resampling=Resampling.nearest, dst_nodata=0)
    return out.astype(bool)


# --------------------------------------------------------------------------- 구간·버퍼
def load_segments_utm():
    fc = json.loads(C.SEGMENTS_GEOJSON.read_text())
    to_utm = Transformer.from_crs("EPSG:4326", C.CRS_METRIC, always_xy=True).transform
    return [(f["properties"], shp_transform(to_utm, shape(f["geometry"]))) for f in fc["features"]]


def buffer_masks(segs, grid: Grid) -> dict[str, dict[str, np.ndarray]]:
    """{segId: {bufferName: bool mask(core)}}"""
    out = {}
    for p, line in segs:
        out[p["id"]] = {}
        for name, half in S.BUFFERS_M.items():
            poly = line.buffer(half, cap_style=2)
            m = features.rasterize([(mapping(poly), 1)], out_shape=grid.core_shape, transform=grid.core_transform, fill=0, dtype="uint8")
            out[p["id"]][name] = m.astype(bool)
    return out


def osm_masks(grid: Grid) -> dict[str, np.ndarray]:
    """OSM 보조 마스크(코어 격자): forest = landuse=forest/natural=wood 폴리곤(way + relation 멤버), road = highway 라인 ±3 m.

    canopyCover 대조(②)와 도로 위 CHM 오분류 점검(⑤)에 쓴다. 이 지역의 임상 relation 은 Overpass 가 멤버 지오메트리를 주지
    않아(504/빈 멤버) 실제로는 way 폴리곤만 잡힌다 — OSM 임상은 계곡 바닥까지 통째로 숲으로 그린 대형 multipolygon 이라
    50 m 버퍼 수준의 검증 자료로는 애초에 굵다.
    """
    path = C.DATA / "overpass_extra.json"
    out = {}
    if not path.exists():
        return out
    d = json.loads(path.read_text())
    to_utm = Transformer.from_crs("EPSG:4326", C.CRS_METRIC, always_xy=True).transform
    from shapely.geometry import LineString, Polygon

    roads = []
    for e in d["elements"]:
        t = e.get("tags", {})
        if e["type"] == "way" and "highway" in t and e.get("geometry") and t["highway"] not in ("path", "footway", "steps", "track"):
            g = shp_transform(to_utm, LineString([(p["lon"], p["lat"]) for p in e["geometry"]]))
            roads.append((mapping(g.buffer(3.0, cap_style=2)), 1))
    if roads:
        out["road"] = features.rasterize(roads, out_shape=grid.core_shape, transform=grid.core_transform, fill=0, dtype="uint8").astype(bool)
    polys = []
    for e in d["elements"]:
        t = e.get("tags", {})
        if not (t.get("landuse") == "forest" or t.get("natural") == "wood"):
            continue
        rings = []
        if e["type"] == "way" and e.get("geometry"):
            rings.append([(p["lon"], p["lat"]) for p in e["geometry"]])
        elif e["type"] == "relation":
            for m in e.get("members", []):
                if m.get("role") in ("outer", "") and m.get("geometry"):
                    rings.append([(p["lon"], p["lat"]) for p in m["geometry"]])
        for r in rings:
            if len(r) >= 4 and r[0] == r[-1]:
                g = shp_transform(to_utm, Polygon(r))
                if g.is_valid and not g.is_empty:
                    polys.append((mapping(g), 1))
    if polys:
        out["forest"] = features.rasterize(polys, out_shape=grid.core_shape, transform=grid.core_transform, fill=0, dtype="uint8").astype(bool)
    return out


# --------------------------------------------------------------------------- 폴리곤화
def clean_mask(m: np.ndarray) -> np.ndarray:
    """3×3 닫힘(closing) 후 열림(opening) — 1셀 구멍·1셀 점 제거."""

    def dil(a):
        p = np.pad(a, 1)
        return (p[:-2, :-2] | p[:-2, 1:-1] | p[:-2, 2:] | p[1:-1, :-2] | p[1:-1, 1:-1] | p[1:-1, 2:] | p[2:, :-2] | p[2:, 1:-1] | p[2:, 2:])

    def ero(a):
        p = np.pad(a, 1, constant_values=True)
        return (p[:-2, :-2] & p[:-2, 1:-1] & p[:-2, 2:] & p[1:-1, :-2] & p[1:-1, 1:-1] & p[1:-1, 2:] & p[2:, :-2] & p[2:, 1:-1] & p[2:, 2:])

    return dil(ero(ero(dil(m))))


def polygonize(mask: np.ndarray, transform, tol_m: float, min_area_m2: float, props: dict) -> tuple[dict, dict]:
    to_wgs = Transformer.from_crs(C.CRS_METRIC, "EPSG:4326", always_xy=True).transform
    geoms = []
    for geom, _ in features.shapes(mask.astype(np.uint8), mask=mask, transform=transform, connectivity=4):
        g = shape(geom)
        if g.area < min_area_m2:
            continue
        if tol_m > 0:
            g = g.simplify(tol_m, preserve_topology=True)
        if g.is_empty:
            continue
        geoms.append(g)
    feats = []
    nvert = 0
    for g in geoms:
        gw = shp_transform(to_wgs, g)
        gj = mapping(gw)
        gj["coordinates"] = _round(gj["coordinates"], S.POLY_COORD_DECIMALS)
        nvert += sum(len(r) for r in gj["coordinates"]) if gj["type"] == "Polygon" else sum(len(r) for p in gj["coordinates"] for r in p)
        feats.append({"type": "Feature", "properties": dict(props), "geometry": gj})
    fc = {"type": "FeatureCollection", "features": feats}
    return fc, {"polygons": len(feats), "vertices": nvert}


def _round(o, nd):
    if isinstance(o, float):
        return round(o, nd)
    if isinstance(o, (list, tuple)):
        return [_round(x, nd) for x in o]
    return o


# --------------------------------------------------------------------------- 메인
def main() -> None:
    args = sys.argv[1:]
    res = int(args[args.index("--res") + 1]) if "--res" in args else 1
    do_poly = "--no-polygons" not in args
    do_sens = "--sens" in args
    S.OUT.mkdir(parents=True, exist_ok=True)
    timing = {}
    t_all = time.time()

    t = time.time()
    grid = Grid(res)
    dem30 = Dem()
    lon, lat = dem30.center_lonlat
    segs = load_segments_utm()
    bufs = buffer_masks(segs, grid)
    osm = osm_masks(grid)
    forest = osm.get("forest")
    chm_core = grid.crop(grid.chm)
    under = chm_core > S.CANOPY_THRESHOLD_M
    timing["load"] = round(time.time() - t, 1)
    print(f"격자 {res}m: 전체 {grid.chm.shape} 코어 {grid.core_shape} ({grid.core_shape[0]*grid.core_shape[1]/1e6:.1f}M 셀)  load {timing['load']}s  RSS {rss_mb():.0f} MB")

    # canopyCover (시각 무관)
    canopy = {}
    for p, _ in segs:
        sid = p["id"]
        canopy[sid] = {}
        for bname, bm in bufs[sid].items():
            n = int(bm.sum())
            canopy[sid][bname] = {"cells": n, "areaM2": n * res * res, "canopyCover": round(float(under[bm].mean()), 4), "meanChmM": round(float(chm_core[bm].mean()), 2), "coverByThreshold": {f"{th:g}m": round(float((chm_core[bm] > th).mean()), 4) for th in S.CANOPY_THRESHOLDS_SENS}, "chmZeroFrac": round(float((chm_core[bm] == 0).mean()), 4)}
            if forest is not None:
                canopy[sid][bname]["osmForestFrac"] = round(float(forest[bm].mean()), 4)
    bbox_stats = {"canopyCover": round(float(under.mean()), 4), "chmZeroFrac": round(float((chm_core == 0).mean()), 4), "chmMax": int(chm_core.max())}
    if forest is not None and forest.any():
        bbox_stats["osmForestFrac"] = round(float(forest.mean()), 4)
        bbox_stats["canopyCoverInsideOsmForest"] = round(float(under[forest].mean()), 4)
        bbox_stats["canopyCoverOutsideOsmForest"] = round(float(under[~forest].mean()), 4)
    if "road" in osm:
        rd = osm["road"]
        bbox_stats["road"] = {"cells": int(rd.sum()), "areaM2": int(rd.sum()) * res * res, "chmAbove2mFrac": round(float(under[rd].mean()), 4), "chmAbove5mFrac": round(float((chm_core[rd] > 5).mean()), 4), "meanChmM": round(float(chm_core[rd].mean()), 2), "note": "OSM highway(path/footway/track 제외) 중심선 ±3 m — 도로 위 CHM>2 m 는 가로수·수관 돌출 또는 오분류"}

    surfaces = {"corrected": grid.ground + grid.chm, "naive": grid.dsm + grid.chm}
    dates = [S.DATE] + (list(S.SENS_DATES) if do_sens else [])
    by_hour = {}  # (date, hour) → dict
    masks = {}
    sun = []
    for date in dates:
        for hh in S.HOURS:
            when = local(date, hh)
            az, el = sun_position(lon, lat, when)
            t = time.time()
            terrain = terrain_mask_fine(dem30, az, el, grid)
            t_terrain = time.time() - t
            comp = {}
            for sname, surf in surfaces.items():
                t = time.time()
                H = cast_shadow_height(surf, res, az, el)
                cast = grid.crop(H > surf + S.SHADOW_TOL_M)
                comp[sname] = {"cast": cast, "seconds": round(time.time() - t, 2)}
            cast = comp["corrected"]["cast"]
            shade = under | cast | terrain
            shade_naive = under | comp["naive"]["cast"] | terrain
            key = (date, hh)
            entry = {"date": date, "timeLocal": hh, "sunAzimuth": round(az, 2), "sunElevation": round(el, 2), "seconds": {"terrain30m": round(t_terrain, 2), "castCorrected": comp["corrected"]["seconds"], "castNaive": comp["naive"]["seconds"]},
                     "bbox": {"shade": round(float(shade.mean()), 4), "underCanopy": round(float(under.mean()), 4), "castOnly": round(float((cast & ~under).mean()), 4), "terrainOnly": round(float((terrain & ~under & ~cast).mean()), 4), "shadeNaive": round(float(shade_naive.mean()), 4), "openCellsShaded": round(float(shade[~under].mean()), 4)},
                     "segments": {}}
            for p, _ in segs:
                sid = p["id"]
                entry["segments"][sid] = {}
                for bname, bm in bufs[sid].items():
                    open_cells = bm & ~under
                    entry["segments"][sid][bname] = {"shade": round(float(shade[bm].mean()), 4), "shadeNaive": round(float(shade_naive[bm].mean()), 4), "castOnly": round(float((cast & ~under)[bm].mean()), 4), "terrainOnly": round(float((terrain & ~under & ~cast)[bm].mean()), 4), "openShaded": round(float(shade[open_cells].mean()), 4) if open_cells.any() else None}
            by_hour[key] = entry
            sun.append({k: entry[k] for k in ("date", "timeLocal", "sunAzimuth", "sunElevation")})
            if date == S.DATE:
                masks[hh] = shade
            segtxt = "  ".join(f"{sid.split('-')[1][:3]} {entry['segments'][sid]['buffer50']['shade']:.2f}/{entry['segments'][sid]['water10']['shade']:.2f}" for sid in entry["segments"])
            print(f"{date} {hh}  az {az:5.1f} el {el:4.1f}  bbox shade {entry['bbox']['shade']:.3f} (under {entry['bbox']['underCanopy']:.3f} cast {entry['bbox']['castOnly']:.3f} terr {entry['bbox']['terrainOnly']:.3f})  seg50/w10: {segtxt}  [{comp['corrected']['seconds']:.1f}s]")
    timing["computeAllHours"] = round(time.time() - t_all - timing["load"], 1)
    print(f"계산 완료 {timing['computeAllHours']}s  RSS {rss_mb():.0f} MB")

    # 결과 표: segments × hours
    result = {
        "valley": "포천 백운계곡 (OSM way 531287119)", "gridResM": res, "date": S.DATE, "hours": S.HOURS, "sensDates": list(S.SENS_DATES) if do_sens else [],
        "canopyThresholdM": S.CANOPY_THRESHOLD_M, "buffersM": S.BUFFERS_M, "bbox": bbox_stats, "sun": sun,
        "segments": [], "byHour": [by_hour[k] for k in by_hour],
    }
    for p, _ in segs:
        sid = p["id"]
        e = {"id": sid, "label": p["label"], "order": p["order"], "lengthM": p["lengthM"], "canopy": canopy[sid], "shadeByHour": {}, "openShadedByHour": {}, "shadeByHourNaive": {}}
        for date in dates:
            e["shadeByHour"][date] = {b: [by_hour[(date, h)]["segments"][sid][b]["shade"] for h in S.HOURS] for b in S.BUFFERS_M}
            e["openShadedByHour"][date] = {b: [by_hour[(date, h)]["segments"][sid][b]["openShaded"] for h in S.HOURS] for b in S.BUFFERS_M}
            e["shadeByHourNaive"][date] = {b: [by_hour[(date, h)]["segments"][sid][b]["shadeNaive"] for h in S.HOURS] for b in S.BUFFERS_M}
        result["segments"].append(e)

    # 폴리곤
    if do_poly:
        t = time.time()
        corridor = features.rasterize([(mapping(line.buffer(S.CORRIDOR_HALF_M, cap_style=1)), 1) for _, line in segs], out_shape=grid.core_shape, transform=grid.core_transform, fill=0, dtype="uint8").astype(bool)
        sizes = {"gridResM": res, "minAreaM2": S.POLY_MIN_AREA_M2, "corridorHalfM": S.CORRIDOR_HALF_M, "corridorCellFrac": round(float(corridor.mean()), 4), "byTol": {}}
        for tol in S.POLY_SIMPLIFY_TOL_M:
            tot_bytes = tot_v = tot_p = 0
            t_tol = time.time()
            per_hour = {}
            for hh, m in masks.items():
                mc = clean_mask(m)
                props = {"valleyId": "baegun", "date": S.DATE, "timeLocal": hh, "source": "GLO-30 terrain + Meta/WRI CHM 1m; canopy>2m OR cast shadow OR terrain horizon"}
                fc, st = polygonize(mc, grid.core_transform, tol, S.POLY_MIN_AREA_M2, props)
                txt = json.dumps(fc, separators=(",", ":"))
                if tol == S.POLY_TOL_DEFAULT_M:
                    (S.OUT / f"shade-0801-{hh[:2]}.geojson").write_text(txt)
                st["bytes"] = len(txt.encode())
                st["gzipBytes"] = len(gzip.compress(txt.encode(), 6))
                per_hour[hh] = st
                tot_bytes += st["bytes"]; tot_v += st["vertices"]; tot_p += st["polygons"]
            # 대안: 정적 수관 폴리곤 1장 + 시각별 "개방지 그림자" 증분 9장
            split = {}
            for scope, clip in (("bbox", None), ("corridor", corridor)):
                def cut(m):
                    return m if clip is None else (m & clip)
                fc_c, st_c = polygonize(clean_mask(cut(under)), grid.core_transform, tol, S.POLY_MIN_AREA_M2, {"valleyId": "baegun", "layer": "canopy", "thresholdM": S.CANOPY_THRESHOLD_M})
                txt_c = json.dumps(fc_c, separators=(",", ":"))
                st_c["bytes"] = len(txt_c.encode()); st_c["gzipBytes"] = len(gzip.compress(txt_c.encode(), 6))
                delta = {}
                d_bytes = d_gz = d_v = 0
                for hh, m in masks.items():
                    fc_d, st_d = polygonize(clean_mask(cut(m & ~under)), grid.core_transform, tol, S.POLY_MIN_AREA_M2, {"valleyId": "baegun", "layer": "cast", "date": S.DATE, "timeLocal": hh})
                    txt_d = json.dumps(fc_d, separators=(",", ":"))
                    st_d["bytes"] = len(txt_d.encode()); st_d["gzipBytes"] = len(gzip.compress(txt_d.encode(), 6))
                    delta[hh] = st_d
                    d_bytes += st_d["bytes"]; d_gz += st_d["gzipBytes"]; d_v += st_d["vertices"]
                    if tol == S.POLY_TOL_DEFAULT_M and scope == "bbox":
                        (S.OUT / f"cast-0801-{hh[:2]}.geojson").write_text(txt_d)
                if tol == S.POLY_TOL_DEFAULT_M and scope == "bbox":
                    (S.OUT / "canopy-gt2m.geojson").write_text(txt_c)
                split[scope] = {"canopy": st_c, "castByHour": delta, "castTotalBytes": d_bytes, "castTotalGzipBytes": d_gz, "castTotalVertices": d_v, "totalBytes": st_c["bytes"] + d_bytes, "totalGzipBytes": st_c["gzipBytes"] + d_gz, "totalVertices": st_c["vertices"] + d_v}
            tot_gz = sum(v["gzipBytes"] for v in per_hour.values())
            sizes["byTol"][f"{tol:g}m"] = {"totalBytes": tot_bytes, "totalGzipBytes": tot_gz, "totalVertices": tot_v, "totalPolygons": tot_p, "seconds": round(time.time() - t_tol, 1), "byHour": per_hour, "split": split}
            sb, sc = split["bbox"], split["corridor"]
            print(f"폴리곤 tol {tol:g}m: 합성 9장 {tot_bytes/1024:.0f} KB(gz {tot_gz/1024:.0f}) {tot_v:,}v | 분리형 bbox: 수관 {sb['canopy']['bytes']/1024:.0f} KB + 그림자 {sb['castTotalBytes']/1024:.0f} KB = {sb['totalBytes']/1024:.0f} KB(gz {sb['totalGzipBytes']/1024:.0f}) {sb['totalVertices']:,}v | 분리형 회랑: {sc['totalBytes']/1024:.0f} KB(gz {sc['totalGzipBytes']/1024:.0f}) {sc['totalVertices']:,}v  ({time.time()-t_tol:.1f}s)")
        timing["polygons"] = round(time.time() - t, 1)
        (S.OUT / f"polygon-sizes-{res}m.json").write_text(json.dumps(sizes, ensure_ascii=False, indent=1))
        result["polygonSizes"] = {k: {kk: vv for kk, vv in v.items() if kk != "byHour"} for k, v in sizes["byTol"].items()}
        np.savez_compressed(S.OUT / f"masks-{res}m.npz", **{hh.replace(":", ""): m for hh, m in masks.items()}, under=under)

    timing["total"] = round(time.time() - t_all, 1)
    result["timing"] = timing
    result["maxRssMB"] = round(rss_mb())
    (S.OUT / f"result-{res}m.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(f"→ {S.OUT / f'result-{res}m.json'}  total {timing['total']}s  RSS {rss_mb():.0f} MB")
    for e in result["segments"]:
        print(f"{e['id']:14s} canopyCover50 {e['canopy'][e and 'buffer50']['canopyCover']:.3f} w10 {e['canopy']['water10']['canopyCover']:.3f}  shadeByHour50 {e['shadeByHour'][S.DATE]['buffer50']}")


if __name__ == "__main__":
    main()
