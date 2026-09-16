"""빌드 오케스트레이션 — 계곡마다 자산 → 격자 → 9시각 그늘 → 구간 속성 → 폴리곤 레이어, 그리고 역기입·index.json.

산출 시각(`builtAt`)은 "산출물이 마지막으로 바뀐 시각"이다: 이전 index.json 의 builtAt 으로 먼저 렌더해 디스크와 같으면
그대로 두고, 하나라도 다르면 지금 시각으로 다시 렌더한다 — 입력·자산이 같으면 재실행이 diff 를 만들지 않는다.
"""
from __future__ import annotations

import json
import time
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point

from shade import __version__
from shade import settings as S
from shade.assets import fetch_chm_acquisition, fetch_chm_window, fetch_glo30_tiles, log
from shade.grid import build_dem30, build_grid, utm_crs_for
from shade.jsonfmt import dumps_file
from shade.polygons import write_shade_layers
from shade.segments import corridor_mask, group_by_valley, load_collection, segment_props, to_utm_geoms, valley_bbox
from shade.shadow import shade_mask
from shade.sun import local

INDEX_NAME = "index.json"


def _num(v: float):
    """정수값 float 는 int 로(JSON 에 50.0 대신 50)."""
    return int(v) if float(v).is_integer() else v


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _kst_date(built_at: str) -> str:
    """builtAt(UTC ISO) 의 KST 날짜 — 산출 파일 collectedAt·datasetVersion 에 쓴다."""
    from zoneinfo import ZoneInfo

    dt = datetime.fromisoformat(built_at.replace("Z", "+00:00")).astimezone(ZoneInfo(S.TZ))
    return dt.strftime("%Y-%m-%d")


def layer_metadata(valley_id: str, built_at: str, chm_acq: list[str], assets: dict) -> "OrderedDict":
    date = _kst_date(built_at)
    return OrderedDict(
        [
            ("description", f"계곡 '{valley_id}' 그늘 레이어 — scripts/shade 산출(P1). 분리형: canopy 1장 + shadow-<HH> 9장(KST {S.HOURS[0]}~{S.HOURS[-1]})"),
            ("source", S.source_sentence(chm_acq)),
            ("datasetVersion", f"{date}.0"),
            ("collectedAt", date),
            ("coordinateOrder", "[longitude, latitude]"),
            ("crs", "EPSG:4326"),
            ("representativeDate", S.REPRESENTATIVE_DATE),
            ("hours", list(S.HOURS)),
            ("chmAcquisition", chm_acq),
            ("assets", assets),
            ("method", OrderedDict([("gridResM", S.GRID_RES_M), ("canopyThresholdM", _num(S.CANOPY_THRESHOLD_M)), ("bufferHalfM", _num(S.BUFFER_HALF_M)), ("corridorHalfM", _num(S.CORRIDOR_HALF_M)), ("simplifyTolM", _num(S.POLY_TOL_M)), ("minAreaM2", _num(S.POLY_MIN_AREA_M2)), ("coordDecimals", S.COORD_DECIMALS)])),
            ("generator", f"scripts/shade {__version__}"),
            ("builtAt", built_at),
        ]
    )


def build_valley(valley_id: str, segments: list[dict], facilities: list[dict], cache_dir: Path) -> dict:
    """계산만 한다(파일 안 씀). 반환: {props, shades, under, corridor, grid, assets, chmAcquisition, sun, timing}."""
    t0 = time.time()
    bbox = valley_bbox(segments, facilities)
    crs = utm_crs_for(bbox)
    log(f"[{valley_id}] 구간 {len(segments)} 시설 {len(facilities)} bbox {tuple(round(v, 5) for v in bbox)} {crs}")
    tiles = fetch_glo30_tiles(bbox, cache_dir)
    chm_path, chm_meta = fetch_chm_window(bbox, S.CHM_WINDOW_MARGIN_M, cache_dir)
    chm_acq = fetch_chm_acquisition(bbox, cache_dir)
    t_assets = time.time() - t0

    dem30 = build_dem30(bbox, tiles, crs)
    grid = build_grid(bbox, chm_path, dem30)
    t_grid = time.time() - t0 - t_assets
    log(f"[{valley_id}] 격자 {grid.res} m 전체 {grid.chm.shape} 코어 {grid.core_shape}  DEM30 {dem30.z.shape}  자산 {t_assets:.1f}s 격자 {t_grid:.1f}s")

    shades: OrderedDict[str, np.ndarray] = OrderedDict()
    sun = []
    under = None
    for hh in S.HOURS:
        shade, under, (az, el) = shade_mask(grid, dem30, local(S.REPRESENTATIVE_DATE, hh))
        shades[hh] = shade
        sun.append(OrderedDict([("timeLocal", hh), ("azimuth", round(az, 2)), ("elevation", round(el, 2)), ("shadeFrac", round(float(shade.mean()), 4))]))
        log(f"[{valley_id}] {hh} az {az:5.1f} el {el:4.1f} 코어 그늘 {shade.mean():.3f} (수관 {under.mean():.3f})")
    t_shade = time.time() - t0 - t_assets - t_grid

    seg_utm = to_utm_geoms(segments, crs)
    fac_utm = to_utm_geoms(facilities, crs)
    props = segment_props(grid, seg_utm, shades, under)
    corridor = corridor_mask([g for _, g in seg_utm if isinstance(g, LineString)], [g for _, g in fac_utm if isinstance(g, Point)], grid)
    assets = OrderedDict(
        [
            ("glo30", OrderedDict([("dataset", S.GLO30_DATASET), ("tiles", [p.stem for p in tiles])])),
            ("chm", OrderedDict([("dataset", S.CHM_DATASET), ("quadkeys", chm_meta["quadkeys"]), ("acquisition", chm_acq)])),
        ]
    )
    return {
        "bbox": bbox,
        "crs": crs,
        "props": props,
        "shades": shades,
        "under": under,
        "corridor": corridor,
        "grid": grid,
        "assets": assets,
        "chmAcquisition": chm_acq,
        "sun": sun,
        "timing": OrderedDict([("assetsS", round(t_assets, 1)), ("gridS", round(t_grid, 1)), ("shadeS", round(t_shade, 1))]),
    }


def render_layers(valley_id: str, result: dict, out_dir: Path, built_at: str) -> "OrderedDict[str, str]":
    meta = layer_metadata(valley_id, built_at, result["chmAcquisition"], result["assets"])
    return write_shade_layers(result["grid"], result["shades"], result["under"], result["corridor"], valley_id, out_dir, meta)


def _same_on_disk(dir_: Path, files: "OrderedDict[str, str]") -> bool:
    for name, body in files.items():
        p = dir_ / name
        if not p.exists() or p.read_text(encoding="utf-8") != body:
            return False
    return True


def write_valley_outputs(valley_id: str, result: dict, out_root: Path, previous_built_at: str | None) -> tuple[str, "OrderedDict[str, int]"]:
    """레이어 파일을 쓴다(변경 없으면 그대로). 반환: (builtAt, {파일명: 바이트})."""
    vdir = out_root / valley_id
    vdir.mkdir(parents=True, exist_ok=True)
    built_at = previous_built_at
    files = None
    if built_at is not None:
        files = render_layers(valley_id, result, vdir, built_at)
        if not _same_on_disk(vdir, files):
            files = None
    if files is None:
        built_at = _now_iso()
        files = render_layers(valley_id, result, vdir, built_at)
        for name, body in files.items():
            (vdir / name).write_text(body, encoding="utf-8")
        log(f"[{valley_id}] 레이어 {len(files)}장 갱신 → {vdir}")
    else:
        log(f"[{valley_id}] 레이어 변경 없음 (builtAt {built_at} 유지)")
    sizes = OrderedDict((name, len(body.encode("utf-8"))) for name, body in files.items())
    return built_at, sizes


def backfill_segments(fc: dict, props_by_id: dict[str, dict]) -> int:
    """구간 properties 에 shadeByHour·canopyCover·shadeRatio(= 정오 값) 를 쓴다. 기존 shadeRatio 자리에 끼우고, 없으면 끝에 붙인다."""
    n = 0
    for f in fc["features"]:
        p = f["properties"]
        sid = p.get("id")
        if sid not in props_by_id:
            continue
        r = props_by_id[sid]
        new_vals = OrderedDict([("shadeByHour", r["shadeByHour"]), ("canopyCover", r["canopyCover"]), ("shadeRatio", r["shadeByHour"][S.NOON_INDEX])])
        if "shadeRatio" in p or "shadeByHour" in p or "canopyCover" in p:
            rebuilt = OrderedDict()
            inserted = False
            for k, v in p.items():
                if k in new_vals:
                    if not inserted:
                        rebuilt.update(new_vals)
                        inserted = True
                    continue
                rebuilt[k] = v
            p.clear()
            p.update(rebuilt)
        else:
            p.update(new_vals)
        n += 1
    return n


def load_index(out_root: Path) -> dict:
    p = out_root / INDEX_NAME
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"), object_pairs_hook=OrderedDict)
    return OrderedDict([("generator", f"scripts/shade {__version__}"), ("valleys", OrderedDict())])


def run_build(segments_path: Path, facilities_path: Path | None, out_root: Path, cache_dir: Path, only_valleys: list[str] | None = None, backfill: bool = True) -> dict:
    seg_fc = load_collection(segments_path)
    fac_fc = load_collection(facilities_path) if facilities_path else {"features": []}
    seg_by_valley = group_by_valley(seg_fc)
    fac_by_valley = group_by_valley(fac_fc) if fac_fc.get("features") else OrderedDict()
    out_root.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)
    index = load_index(out_root)
    index["generator"] = f"scripts/shade {__version__}"
    index.setdefault("valleys", OrderedDict())
    all_props: dict[str, dict] = {}
    for valley_id, segments in seg_by_valley.items():
        if only_valleys and valley_id not in only_valleys:
            continue
        result = build_valley(valley_id, segments, fac_by_valley.get(valley_id, []), cache_dir)
        prev = index["valleys"].get(valley_id, {}).get("builtAt")
        built_at, sizes = write_valley_outputs(valley_id, result, out_root, prev)
        all_props.update(result["props"])
        index["valleys"][valley_id] = OrderedDict(
            [
                ("builtAt", built_at),
                ("representativeDate", S.REPRESENTATIVE_DATE),
                ("hours", list(S.HOURS)),
                ("bbox", [round(v, 5) for v in result["bbox"]]),
                ("crs", result["crs"]),
                ("gridResM", S.GRID_RES_M),
                ("bufferHalfM", _num(S.BUFFER_HALF_M)),
                ("corridorHalfM", _num(S.CORRIDOR_HALF_M)),
                ("assets", result["assets"]),
                ("sun", result["sun"]),
                ("segments", OrderedDict((sid, OrderedDict([("canopyCover", r["canopyCover"]), ("shadeByHour", r["shadeByHour"])])) for sid, r in result["props"].items())),
                ("files", sizes),
                ("totalBytes", sum(sizes.values())),
            ]
        )
        for sid, r in result["props"].items():
            log(f"[{valley_id}] {sid:14s} canopyCover {r['canopyCover']:.3f}  shadeByHour {r['shadeByHour']}")
    # 계곡 순서 = 입력 순서(이미 있던 다른 계곡은 뒤에)
    ordered = OrderedDict()
    for vid in seg_by_valley:
        if vid in index["valleys"]:
            ordered[vid] = index["valleys"][vid]
    for vid, v in index["valleys"].items():
        ordered.setdefault(vid, v)
    index["valleys"] = ordered
    (out_root / INDEX_NAME).write_text(dumps_file(index), encoding="utf-8")
    log(f"index → {out_root / INDEX_NAME}")

    if backfill and all_props:
        original = segments_path.read_text(encoding="utf-8")
        if dumps_file(load_collection(segments_path)) != original:
            log(f"경고: {segments_path} 의 원본 포맷을 그대로 재현하지 못한다 — 역기입 후 포맷이 달라질 수 있음")
        n = backfill_segments(seg_fc, all_props)
        segments_path.write_text(dumps_file(seg_fc), encoding="utf-8")
        log(f"역기입 {n} 구간 → {segments_path}")
    return index
