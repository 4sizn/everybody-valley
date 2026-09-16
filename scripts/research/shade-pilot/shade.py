"""3단계: 태양 위치 × 지형(DEM) 산그늘 계산.

각 셀에서 태양 방위각 방향으로 지형선을 따라가며(15m 스텝, 최대 6km) 지평선 각도를
구하고, 태양 고도 < 지평선 각도 이면 그늘로 판정한다. 나무 그늘은 포함하지 않는다.

실행:  .venv/bin/python shade.py
전제:  out/dem_utm.tif (prepare_dem.py), out/segments.geojson (fetch_osm.py)
산출:  out/shade-<date>-<HHMM>.geojson (7시각 × 2일), out/onset.json, out/sun.json,
       out/masks.npz (시각별 마스크 — 시각화용, 커밋 안 함)
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import rasterio
from astral import Observer
from astral.sun import azimuth as sun_azimuth
from astral.sun import elevation as sun_elevation
from pyproj import Transformer
from rasterio import features
from rasterio.windows import Window, from_bounds
from shapely.geometry import LineString, mapping, shape
from shapely.ops import transform as shp_transform

import config as C

TZ = ZoneInfo(C.TZ)
STEP_M = C.CELL_M / 2  # 지형선 샘플 간격


# --------------------------------------------------------------------------- DEM
class Dem:
    def __init__(self, path=C.DEM_UTM):
        with rasterio.open(path) as src:
            self.z = src.read(1).astype(np.float64)
            self.transform = src.transform
            self.crs = src.crs
            self.nodata = src.nodata
        self.z[self.z == self.nodata] = np.nan
        self.res = self.transform.a
        # 관심 bbox(코어) 창
        to_utm = Transformer.from_crs("EPSG:4326", C.CRS_METRIC, always_xy=True)
        w, s, e, n = C.BBOX
        xs, ys = to_utm.transform([w, e, w, e], [s, s, n, n])
        win = from_bounds(min(xs), min(ys), max(xs), max(ys), self.transform)
        self.core = Window(int(round(win.col_off)), int(round(win.row_off)), int(round(win.width)), int(round(win.height)))
        self.core_transform = rasterio.windows.transform(self.core, self.transform)
        self.center_lonlat = ((w + e) / 2, (s + n) / 2)

    def core_z(self) -> np.ndarray:
        c = self.core
        return self.z[c.row_off : c.row_off + c.height, c.col_off : c.col_off + c.width]

    def bilinear(self, rows: np.ndarray, cols: np.ndarray) -> np.ndarray:
        """실수 (row, col) 위치의 표고. 배열 밖은 NaN."""
        h, w = self.z.shape
        r0 = np.floor(rows).astype(int)
        c0 = np.floor(cols).astype(int)
        fr = rows - r0
        fc = cols - c0
        inside = (r0 >= 0) & (r0 < h - 1) & (c0 >= 0) & (c0 < w - 1)
        r0c = np.clip(r0, 0, h - 2)
        c0c = np.clip(c0, 0, w - 2)
        z = (
            self.z[r0c, c0c] * (1 - fr) * (1 - fc)
            + self.z[r0c, c0c + 1] * (1 - fr) * fc
            + self.z[r0c + 1, c0c] * fr * (1 - fc)
            + self.z[r0c + 1, c0c + 1] * fr * fc
        )
        return np.where(inside, z, np.nan)

    def horizon_angle(self, az_deg: float, max_dist_m: float = C.HORIZON_MAX_DIST_M) -> np.ndarray:
        """코어 창 각 셀에서 방위각 az 방향의 지평선 각도(도)."""
        c = self.core
        rr, cc = np.mgrid[c.row_off : c.row_off + c.height, c.col_off : c.col_off + c.width]
        rr = rr.astype(np.float64)
        cc = cc.astype(np.float64)
        z0 = self.z[rr.astype(int), cc.astype(int)]
        az = np.deg2rad(az_deg)
        de, dn = np.sin(az), np.cos(az)  # 동·북 성분 (지도 좌표)
        best = np.full(z0.shape, -np.inf)
        n_steps = int(max_dist_m / STEP_M)
        for k in range(1, n_steps + 1):
            d = k * STEP_M
            zs = self.bilinear(rr - d * dn / self.res, cc + d * de / self.res)
            ang = np.arctan2(zs - z0, d)
            best = np.fmax(best, ang)  # NaN 무시
        return np.rad2deg(best)

    def shade_mask(self, az_deg: float, el_deg: float) -> np.ndarray:
        if el_deg <= 0:
            return np.ones(self.core_z().shape, dtype=bool)
        return self.horizon_angle(az_deg) > el_deg


# --------------------------------------------------------------------------- 태양
def sun_position(lon: float, lat: float, when: datetime) -> tuple[float, float]:
    obs = Observer(latitude=lat, longitude=lon)
    return float(sun_azimuth(obs, when)), float(sun_elevation(obs, when))


def local(date: str, hhmm: str) -> datetime:
    return datetime.fromisoformat(f"{date}T{hhmm}:00").replace(tzinfo=TZ)


def fine_times(date: str) -> list[datetime]:
    t = local(date, C.FINE_START)
    end = local(date, C.FINE_END)
    out = []
    while t <= end:
        out.append(t)
        t += timedelta(minutes=C.FINE_STEP_MIN)
    return out


# --------------------------------------------------------------------------- 구간 샘플
def load_segments():
    fc = json.loads(C.SEGMENTS_GEOJSON.read_text())
    to_utm = Transformer.from_crs("EPSG:4326", C.CRS_METRIC, always_xy=True).transform
    segs = []
    for f in fc["features"]:
        line_utm = shp_transform(to_utm, shape(f["geometry"]))
        segs.append((f["properties"], line_utm))
    return segs


def sample_points(line: LineString, step: float = C.SAMPLE_STEP_M) -> np.ndarray:
    n = max(2, int(line.length // step) + 1)
    ds = np.linspace(0, line.length, n)
    pts = [line.interpolate(d) for d in ds]
    return np.array([[p.x, p.y] for p in pts])


def shaded_fraction(mask: np.ndarray, dem: Dem, pts_xy: np.ndarray) -> float:
    inv = ~dem.core_transform
    cols, rows = inv * (pts_xy[:, 0], pts_xy[:, 1])
    r = np.floor(rows).astype(int)
    c = np.floor(cols).astype(int)
    ok = (r >= 0) & (r < mask.shape[0]) & (c >= 0) & (c < mask.shape[1])
    if not ok.all():
        raise ValueError("구간 샘플이 bbox 밖에 있다")
    return float(mask[r, c].mean())


def onset_from_series(times: list[datetime], fracs: list[float], thr: float) -> str | None:
    for t, f in zip(times, fracs):
        if f >= thr:
            return t.strftime("%H:%M")
    return None


# --------------------------------------------------------------------------- 폴리곤화
def mask_to_geojson(mask: np.ndarray, dem: Dem, props: dict) -> dict:
    to_wgs = Transformer.from_crs(C.CRS_METRIC, "EPSG:4326", always_xy=True).transform
    feats = []
    for geom, val in features.shapes(mask.astype(np.uint8), mask=mask, transform=dem.core_transform):
        g = shp_transform(to_wgs, shape(geom))
        feats.append({"type": "Feature", "properties": dict(props), "geometry": mapping(g)})
    return {"type": "FeatureCollection", "features": feats}


def _round(o):
    if isinstance(o, float):
        return round(o, 6)
    if isinstance(o, list):
        return [_round(x) for x in o]
    if isinstance(o, dict):
        return {k: _round(v) for k, v in o.items()}
    return o


# --------------------------------------------------------------------------- 메인
def main() -> None:
    dem = Dem()
    lon, lat = dem.center_lonlat
    segs = load_segments()
    seg_pts = {p["id"]: sample_points(line) for p, line in segs}
    # 격자 아티팩트 민감도: 샘플점을 1셀(30m) 씩 동·서·남·북으로 옮긴 변형
    shifts = {"E+30": (C.CELL_M, 0), "W-30": (-C.CELL_M, 0), "N+30": (0, C.CELL_M), "S-30": (0, -C.CELL_M)}

    sun_table = []
    masks = {}
    coarse = {p["id"]: {} for p, _ in segs}
    fine = {p["id"]: {} for p, _ in segs}
    fine_shift = {p["id"]: {d: {k: {} for k in shifts} for d in C.DATES} for p, _ in segs}
    cell_frac = {}

    for date in C.DATES:
        coarse_set = {local(date, h) for h in C.HOURS}
        times = sorted(set(fine_times(date)) | coarse_set)
        for t in times:
            az, el = sun_position(lon, lat, t)
            mask = dem.shade_mask(az, el)
            key = t.strftime("%H:%M")
            frac_cells = float(mask.mean())
            sun_table.append({"date": date, "timeLocal": key, "azimuth": round(az, 2), "elevation": round(el, 2), "shadedCellFraction": round(frac_cells, 4)})
            if t in coarse_set:
                masks[(date, key)] = mask
                cell_frac[(date, key)] = frac_cells
                gj = mask_to_geojson(mask, dem, {"date": date, "timeLocal": key, "sunAzimuth": round(az, 2), "sunElevation": round(el, 2), "source": "Copernicus GLO-30, terrain-only horizon angle"})
                (C.OUT / f"shade-{date}-{key.replace(':', '')}.geojson").write_text(json.dumps(_round(gj)))
            for p, _ in segs:
                sid = p["id"]
                f = shaded_fraction(mask, dem, seg_pts[sid])
                fine[sid].setdefault(date, []).append((t, f))
                if t in coarse_set:
                    coarse[sid].setdefault(date, {})[key] = round(f, 3)
                for name, (dx, dy) in shifts.items():
                    fs = shaded_fraction(mask, dem, seg_pts[sid] + np.array([dx, dy]))
                    fine_shift[sid][date][name][t] = fs
            print(f"{date} {key}  az {az:6.1f}  el {el:5.1f}  cells {frac_cells:5.1%}  " + "  ".join(f"{p['id'].split('-')[1][:3]} {shaded_fraction(mask, dem, seg_pts[p['id']]):4.0%}" for p, _ in segs))

    # onset 표
    result = {
        "valley": "포천 백운계곡 (영평천 상류, OSM way 531287119)",
        "method": "GLO-30 30m DEM → UTM52N 30m; 셀별 태양 방위각 방향 지평선 각도(15m 스텝, 최대 6km) > 태양 고도 → 그늘. 나무 그늘 제외.",
        "onsetThreshold": C.ONSET_THRESHOLD,
        "sampleStepM": C.SAMPLE_STEP_M,
        "hours": C.HOURS,
        "dates": C.DATES,
        "segments": [],
        "bboxShadedCellFraction": {f"{d} {h}": round(v, 4) for (d, h), v in cell_frac.items()},
    }
    for p, line in segs:
        sid = p["id"]
        entry = {"id": sid, "label": p["label"], "order": p["order"], "lengthM": p["lengthM"], "sampleCount": len(seg_pts[sid]), "byDate": {}}
        for date in C.DATES:
            series = fine[sid][date]
            ts = [t for t, _ in series]
            fs = [f for _, f in series]
            onset_fine = onset_from_series(ts, fs, C.ONSET_THRESHOLD)
            full_fine = onset_from_series(ts, fs, 0.9)
            coarse_ts = [local(date, h) for h in C.HOURS]
            onset_coarse = onset_from_series(coarse_ts, [coarse[sid][date][h] for h in C.HOURS], C.ONSET_THRESHOLD)
            shifted = {}
            for name in shifts:
                ser = fine_shift[sid][date][name]
                sts = sorted(ser)
                shifted[name] = onset_from_series(sts, [ser[t] for t in sts], C.ONSET_THRESHOLD)
            entry["byDate"][date] = {
                "shadedFractionByHour": coarse[sid][date],
                "onsetCoarse": onset_coarse,
                "onsetFine10min": onset_fine,
                "fullShade90pctFine10min": full_fine,
                "onsetFineShifted1Cell": shifted,
                "fineSeries": {t.strftime("%H:%M"): round(f, 3) for t, f in series},
            }
        result["segments"].append(entry)

    C.ONSET_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    (C.OUT / "sun.json").write_text(json.dumps(sun_table, ensure_ascii=False, indent=1))
    np.savez_compressed(C.OUT / "masks.npz", **{f"{d}_{h.replace(':', '')}": m for (d, h), m in masks.items()})
    print(f"→ {C.ONSET_JSON}")
    for e in result["segments"]:
        for date, b in e["byDate"].items():
            print(f"{e['id']:14s} {date}  onset(7시각) {b['onsetCoarse']}  onset(10분) {b['onsetFine10min']}  90% {b['fullShade90pctFine10min']}  shift {b['onsetFineShifted1Cell']}")


if __name__ == "__main__":
    main()
