"""격자 — 30 m 지형(Dem, R3b `shade.py`) 과 2 m 계산 격자(Grid, R3c `canopy/shade_canopy.py`).

Dem : GLO-30 타일을 bbox + 6 km 범위의 UTM 30 m 격자로 bilinear 재투영. 지평선 각도(15 m 스텝, 6 km) → 원거리 지형 그늘 마스크.
Grid: bbox + 200 m 를 UTM 2 m 격자로 — CHM(nearest), DSM(30 m Dem 을 bilinear), 보정 지반 = DSM − CHM 30 m 블록 평균.
      GLO-30 은 DSM(수관 포함 표면)이라 CHM 을 그대로 얹으면 수관이 두 번 들어가기 때문이다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.merge import merge
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject

from shade import settings as S
from shade.assets import Bbox

NODATA = -9999.0


def utm_crs_for(bbox: Bbox) -> str:
    """bbox 중심 경도로 UTM 존(북반구) 선택. 한국: 126°E 서쪽 51N(EPSG:32651), 동쪽 52N(EPSG:32652)."""
    w, s, e, n = bbox
    lon = (w + e) / 2
    zone = int(math.floor((lon + 180.0) / 6.0)) + 1
    hemisphere = 32600 if (s + n) / 2 >= 0 else 32700
    return f"EPSG:{hemisphere + zone}"


def _bbox_utm(bbox: Bbox, crs: str) -> tuple[float, float, float, float]:
    to_utm = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    w, s, e, n = bbox
    xs, ys = to_utm.transform([w, e, w, e], [s, s, n, n])
    return min(xs), min(ys), max(xs), max(ys)


def _snapped_grid(xmin: float, ymin: float, xmax: float, ymax: float, margin: float, res: float):
    """(xmin−margin, …) 을 res 배수에 맞춘 transform/width/height. 같은 CRS·res 면 어떤 bbox 든 같은 격자에 놓인다(재현성)."""
    x0 = math.floor((xmin - margin) / res) * res
    x1 = math.ceil((xmax + margin) / res) * res
    y0 = math.floor((ymin - margin) / res) * res
    y1 = math.ceil((ymax + margin) / res) * res
    return from_origin(x0, y1, res, res), int(round((x1 - x0) / res)), int(round((y1 - y0) / res))


# --------------------------------------------------------------------------- 30 m 지형
@dataclass
class Dem:
    z: np.ndarray  # float64, NaN = nodata
    transform: rasterio.Affine
    crs: str
    core: tuple[slice, slice]  # bbox 창 (행, 열)
    core_transform: rasterio.Affine
    center_lonlat: tuple[float, float]

    @property
    def res(self) -> float:
        return self.transform.a

    @property
    def core_shape(self) -> tuple[int, int]:
        return (self.core[0].stop - self.core[0].start, self.core[1].stop - self.core[1].start)

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

    def horizon_angle(self, az_deg: float, max_dist_m: float = S.HORIZON_MAX_DIST_M) -> np.ndarray:
        """코어 창 각 셀에서 방위각 az 방향의 지평선 각도(도)."""
        rs, cs = self.core
        rr, cc = np.mgrid[rs.start : rs.stop, cs.start : cs.stop]
        rr = rr.astype(np.float64)
        cc = cc.astype(np.float64)
        z0 = self.z[rr.astype(int), cc.astype(int)]
        az = math.radians(az_deg)
        de, dn = math.sin(az), math.cos(az)
        best = np.full(z0.shape, -np.inf)
        n_steps = int(max_dist_m / S.HORIZON_STEP_M)
        for k in range(1, n_steps + 1):
            d = k * S.HORIZON_STEP_M
            zs = self.bilinear(rr - d * dn / self.res, cc + d * de / self.res)
            best = np.fmax(best, np.arctan2(zs - z0, d))
        return np.rad2deg(best)

    def shade_mask(self, az_deg: float, el_deg: float) -> np.ndarray:
        """원거리 지형 그늘(코어 창, bool)."""
        if el_deg <= 0:
            return np.ones(self.core_shape, dtype=bool)
        return self.horizon_angle(az_deg) > el_deg


def build_dem30(bbox: Bbox, tiles: list[Path], crs: str) -> Dem:
    """GLO-30 타일(들)을 bbox + 6 km 의 UTM 30 m 격자로 bilinear 재투영(R3b `prepare_dem.py`)."""
    xmin, ymin, xmax, ymax = _bbox_utm(bbox, crs)
    tr, width, height = _snapped_grid(xmin, ymin, xmax, ymax, S.HORIZON_BUFFER_M, S.DEM_CELL_M)
    dst = np.full((height, width), NODATA, dtype=np.float32)
    srcs = [rasterio.open(p) for p in tiles]
    try:
        if len(srcs) == 1:
            src_arr, src_tr, src_crs, src_nodata = rasterio.band(srcs[0], 1), None, None, srcs[0].nodata
            reproject(src_arr, dst, dst_transform=tr, dst_crs=crs, dst_nodata=NODATA, resampling=Resampling.bilinear)
        else:
            arr, mtr = merge(srcs)
            reproject(arr[0], dst, src_transform=mtr, src_crs=srcs[0].crs, src_nodata=srcs[0].nodata, dst_transform=tr, dst_crs=crs, dst_nodata=NODATA, resampling=Resampling.bilinear)
    finally:
        for s_ in srcs:
            s_.close()
    z = dst.astype(np.float64)
    z[z <= NODATA] = np.nan
    inv = ~tr
    c0, r0 = inv * (xmin, ymax)
    c1, r1 = inv * (xmax, ymin)
    core = (slice(int(round(r0)), int(round(r1))), slice(int(round(c0)), int(round(c1))))
    core_tr = tr * rasterio.Affine.translation(core[1].start, core[0].start)
    w, s, e, n = bbox
    return Dem(z=z, transform=tr, crs=crs, core=core, core_transform=core_tr, center_lonlat=((w + e) / 2, (s + n) / 2))


# --------------------------------------------------------------------------- 2 m 계산 격자
@dataclass
class Grid:
    res: int
    crs: str
    chm: np.ndarray  # float32 (m), 전체 격자
    dsm: np.ndarray  # float32, GLO-30 bilinear
    ground: np.ndarray  # float32, 보정 지반
    transform: rasterio.Affine
    core: tuple[slice, slice]
    core_transform: rasterio.Affine

    @property
    def core_shape(self) -> tuple[int, int]:
        return (self.core[0].stop - self.core[0].start, self.core[1].stop - self.core[1].start)

    def crop(self, a: np.ndarray) -> np.ndarray:
        return a[self.core]

    @property
    def surface(self) -> np.ndarray:
        return self.ground + self.chm


def corrected_ground(chm: np.ndarray, dsm: np.ndarray, transform: rasterio.Affine, crs: str, dem30: Dem) -> np.ndarray:
    """DSM − CHM 의 30 m 블록 평균(30 m Dem 격자로 average → bilinear 로 다시 올림) ≈ 지반."""
    chm30 = np.zeros(dem30.z.shape, dtype=np.float32)
    reproject(chm, chm30, src_transform=transform, src_crs=crs, dst_transform=dem30.transform, dst_crs=crs, resampling=Resampling.average, dst_nodata=0)
    chm30_fine = np.zeros_like(dsm)
    reproject(chm30, chm30_fine, src_transform=dem30.transform, src_crs=crs, dst_transform=transform, dst_crs=crs, resampling=Resampling.bilinear, dst_nodata=0)
    return dsm - chm30_fine


def build_grid(bbox: Bbox, chm_3857: Path, dem30: Dem, res_m: int = S.GRID_RES_M, margin_m: float = S.GRID_MARGIN_M) -> Grid:
    """bbox + margin 을 UTM res_m 격자로: CHM(nearest)·DSM(30 m Dem bilinear)·보정 지반. core = bbox 창."""
    crs = dem30.crs
    xmin, ymin, xmax, ymax = _bbox_utm(bbox, crs)
    tr, width, height = _snapped_grid(xmin, ymin, xmax, ymax, margin_m, float(res_m))
    with rasterio.open(chm_3857) as src:
        chm_u8 = np.zeros((height, width), dtype=np.uint8)
        reproject(rasterio.band(src, 1), chm_u8, dst_transform=tr, dst_crs=crs, dst_nodata=0, resampling=Resampling.nearest)
    chm = chm_u8.astype(np.float32)
    dem_src = np.where(np.isnan(dem30.z), NODATA, dem30.z).astype(np.float32)
    dsm = np.full((height, width), np.nan, dtype=np.float32)
    reproject(dem_src, dsm, src_transform=dem30.transform, src_crs=crs, src_nodata=NODATA, dst_transform=tr, dst_crs=crs, dst_nodata=np.nan, resampling=Resampling.bilinear)
    dsm = np.where(np.isnan(dsm), np.nanmin(dsm), dsm).astype(np.float32)
    inv = ~tr
    c0, r0 = inv * (xmin, ymax)
    c1, r1 = inv * (xmax, ymin)
    core = (slice(int(math.floor(r0)), int(math.ceil(r1))), slice(int(math.floor(c0)), int(math.ceil(c1))))
    core_tr = tr * rasterio.Affine.translation(core[1].start, core[0].start)
    ground = corrected_ground(chm, dsm, tr, crs, dem30)
    return Grid(res=res_m, crs=crs, chm=chm, dsm=dsm, ground=ground, transform=tr, core=core, core_transform=core_tr)
