"""2단계: GLO-30 타일을 bbox(+지평선 버퍼)로 잘라 UTM 52N 30m 격자로 재투영한다.

실행:  .venv/bin/python prepare_dem.py
전제:  data/Copernicus_DSM_COG_10_N38_00_E127_00_DEM.tif (README 의 curl 명령으로 다운로드)
산출:  out/dem_utm.tif (float32, nodata -9999)
"""
from __future__ import annotations

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.warp import Resampling, reproject
from rasterio.transform import from_origin

import config as C


def main() -> None:
    if not C.DEM_TILE.exists():
        raise SystemExit(f"DEM 타일이 없다: {C.DEM_TILE}\n  curl -L -o {C.DEM_TILE} {C.DEM_TILE_URL}")
    w, s, e, n = C.BBOX
    if not (38.0 <= s and n <= 39.0):
        raise SystemExit("bbox 가 N38 타일(38~39N)을 벗어난다 — N37 타일도 필요")

    to_utm = Transformer.from_crs("EPSG:4326", C.CRS_METRIC, always_xy=True)
    xs, ys = to_utm.transform([w, e, w, e], [s, s, n, n])
    buf = C.HORIZON_BUFFER_M
    x0 = np.floor((min(xs) - buf) / C.CELL_M) * C.CELL_M
    y1 = np.ceil((max(ys) + buf) / C.CELL_M) * C.CELL_M
    x1 = np.ceil((max(xs) + buf) / C.CELL_M) * C.CELL_M
    y0 = np.floor((min(ys) - buf) / C.CELL_M) * C.CELL_M
    width = int((x1 - x0) / C.CELL_M)
    height = int((y1 - y0) / C.CELL_M)
    dst_transform = from_origin(x0, y1, C.CELL_M, C.CELL_M)

    with rasterio.open(C.DEM_TILE) as src:
        dst = np.full((height, width), -9999.0, dtype=np.float32)
        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            src_transform=src.transform,
            src_crs=src.crs,
            dst_transform=dst_transform,
            dst_crs=C.CRS_METRIC,
            dst_nodata=-9999.0,
            resampling=Resampling.bilinear,
        )
    C.OUT.mkdir(exist_ok=True)
    with rasterio.open(
        C.DEM_UTM, "w", driver="GTiff", height=height, width=width, count=1, dtype="float32",
        crs=C.CRS_METRIC, transform=dst_transform, nodata=-9999.0, compress="deflate",
    ) as out:
        out.write(dst, 1)
    valid = dst[dst > -9999]
    print(f"{C.DEM_UTM}: {width}x{height} @ {C.CELL_M}m, elev {valid.min():.0f}~{valid.max():.0f} m, nodata cells {(dst<=-9999).sum()}")
    print(f"  bbox(UTM) x {min(xs):.0f}~{max(xs):.0f}  y {min(ys):.0f}~{max(ys):.0f}  (+{buf} m 버퍼)")


if __name__ == "__main__":
    main()
