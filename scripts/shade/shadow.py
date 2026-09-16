"""그림자 전파와 그늘 판정 — R3c `canopy/shade_canopy.py` 의 `cast_shadow_height`·`terrain_mask_fine` 그대로.

셀 x, 시각 t 가 그늘이면:
  (a) CHM(x) > 2 m — 나무 아래(시각 무관)
  (b) 그림자 전파 H(x) > 표면 z(x) + 0.1 m — 태양 반대 방향 스캔라인 O(N) 전파 H = max(z, H_prev − step·tan(el)),
      열 이동은 누적 오프셋의 정수 차분(Bresenham). 사거리 제한 없음(격자 안 지형 자기그림자 포함)
  (c) 30 m 지형 마스크(6 km 지평선) — 원거리 능선
"""
from __future__ import annotations

from datetime import datetime

import numpy as np
from rasterio.warp import Resampling, reproject

from shade import settings as S
from shade.grid import Dem, Grid
from shade.sun import sun_position


def _propagate_rows(z: np.ndarray, f: float, drop: float) -> np.ndarray:
    """행 0 → 끝 방향으로 그림자 높이 전파. 한 행 내려갈 때 열은 f 만큼 이동, 높이는 drop 만큼 감소."""
    h, w = z.shape
    H = np.empty_like(z)
    H[0] = z[0]
    neg = np.float32(-1e9)
    offs = np.round(np.arange(h) * f).astype(np.int64)
    for i in range(1, h):
        prev = H[i - 1]
        k = offs[i] - offs[i - 1]
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
    dcol, drow = -np.sin(az), np.cos(az)  # 그림자 진행 방향(태양 반대): 열(+동) = −sin(az), 행(+남) = +cos(az)
    if abs(drow) >= abs(dcol):
        zz = z if drow > 0 else z[::-1]
        f = dcol / abs(drow)
        step = res * np.sqrt(1 + f * f)
        H = _propagate_rows(zz, f, np.float32(step * tan_el))
        return H if drow > 0 else H[::-1]
    zt = z.T
    zz = zt if dcol > 0 else zt[::-1]
    f = drow / abs(dcol)
    step = res * np.sqrt(1 + f * f)
    H = _propagate_rows(zz, f, np.float32(step * tan_el))
    H = H if dcol > 0 else H[::-1]
    return H.T


def terrain_mask_fine(dem30: Dem, az: float, el: float, grid: Grid) -> np.ndarray:
    """30 m 지형 마스크(코어 창)를 세밀 격자 코어 창에 nearest 로 올린다."""
    m30 = dem30.shade_mask(az, el).astype(np.uint8)
    out = np.zeros(grid.core_shape, dtype=np.uint8)
    reproject(m30, out, src_transform=dem30.core_transform, src_crs=grid.crs, dst_transform=grid.core_transform, dst_crs=grid.crs, resampling=Resampling.nearest, dst_nodata=0)
    return out.astype(bool)


def under_canopy(grid: Grid, threshold_m: float = S.CANOPY_THRESHOLD_M) -> np.ndarray:
    """코어 창의 '나무 아래' 마스크 — 시각 무관."""
    return grid.crop(grid.chm) > threshold_m


def shade_mask(grid: Grid, dem30: Dem, when: datetime, canopy_threshold_m: float = S.CANOPY_THRESHOLD_M) -> tuple[np.ndarray, np.ndarray, tuple[float, float]]:
    """(shade, under, (az, el)) — 코어 창 bool 마스크. shade = under | cast(H > surface + tol) | terrain30."""
    lon, lat = dem30.center_lonlat
    az, el = sun_position(lon, lat, when)
    under = under_canopy(grid, canopy_threshold_m)
    if el <= 0:
        return np.ones_like(under), under, (az, el)
    surf = grid.surface
    H = cast_shadow_height(surf, float(grid.res), az, el)
    cast = grid.crop(H > surf + S.SHADOW_TOL_M)
    terrain = terrain_mask_fine(dem30, az, el, grid)
    return under | cast | terrain, under, (az, el)
