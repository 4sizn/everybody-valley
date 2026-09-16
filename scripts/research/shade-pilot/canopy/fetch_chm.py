"""R3c 1단계: Meta/WRI 1m CHM 을 S3 에서 bbox 창만 HTTP 범위 요청으로 읽고 UTM 52N 1m/2m 격자로 재투영한다.

실행:  .venv/bin/python -m canopy.fetch_chm [--offline]
  --offline 이면 data/chm_3857_bbox.tif 를 재사용한다.
산출:  data/chm_3857_bbox.tif, data/chm_utm_{1,2}m.tif, data/dem_utm_{1,2}m.tif (커밋 안 함),
       out/canopy/chm-meta.json (다운로드 바이트·시간·촬영일·통계)

메모: chm/<quadkey>.tif 는 COG 가 아니라 **스트립 TIFF**(1행 × 65536, uint8, deflate, 오버뷰 없음) 다.
      GDAL 은 창의 행 범위를 연속 범위로 합쳐 받으므로 680 MB 중 bbox 4.5k 행 ≈ 50 MB 만 내려온다.
"""
from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import time

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject
from rasterio.windows import Window, from_bounds

import config as C
from canopy import settings as S

GDAL_ENV = dict(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.msk",
    GDAL_HTTP_MULTIRANGE="YES",
    GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
    CPL_VSIL_CURL_CHUNK_SIZE=str(4 * 1024 * 1024),
    GDAL_INGESTED_BYTES_AT_OPEN=str(2 * 1024 * 1024),
    CPL_CURL_VERBOSE="YES",  # stderr 로 요청/응답 헤더 → 바이트 집계
)


class CurlLog:
    """CPL_CURL_VERBOSE 출력을 fd 2 에서 가로채 Content-Range 바이트를 합산한다."""

    def __enter__(self):
        self.tmp = tempfile.TemporaryFile(mode="w+b")
        self.saved = os.dup(2)
        sys.stderr.flush()
        os.dup2(self.tmp.fileno(), 2)
        return self

    def __exit__(self, *exc):
        sys.stderr.flush()
        os.dup2(self.saved, 2)
        os.close(self.saved)
        self.tmp.seek(0)
        txt = self.tmp.read().decode(errors="replace")
        self.tmp.close()
        self.requests = len(re.findall(r"^> (GET|HEAD) ", txt, re.M))
        self.bytes = sum(int(b) - int(a) + 1 for a, b in re.findall(r"^< Content-Range: bytes (\d+)-(\d+)/", txt, re.M | re.I))
        self.total_file_bytes = max((int(x) for x in re.findall(r"^< Content-Range: bytes \d+-\d+/(\d+)", txt, re.M | re.I)), default=0)
        return False


def bbox_3857(margin_m: float):
    w, s, e, n = C.BBOX
    tr = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    xs, ys = tr.transform([w, e], [s, n])
    return xs[0] - margin_m, ys[0] - margin_m, xs[1] + margin_m, ys[1] + margin_m


def fetch_window(meta: dict) -> None:
    url = f"{S.CHM_BASE}/chm/{S.CHM_QUADKEY}.tif"
    t0 = time.time()
    with CurlLog() as log, rasterio.Env(**GDAL_ENV), rasterio.open(url) as src:
        win = from_bounds(*bbox_3857(S.CHM_WINDOW_MARGIN_M), src.transform).round_offsets().round_lengths()
        a = src.read(1, window=win)
        wt = rasterio.windows.transform(win, src.transform)
        prof = src.profile
        info = dict(crs=str(src.crs), size=[src.width, src.height], dtype=src.dtypes[0], blockShape=list(src.block_shapes[0]), overviews=src.overviews(1), compression=str(src.compression), tiled=src.is_tiled, tags=src.tags())
        window = dict(colOff=int(win.col_off), rowOff=int(win.row_off), width=int(win.width), height=int(win.height))
    dt = time.time() - t0
    prof.update(driver="GTiff", width=a.shape[1], height=a.shape[0], transform=wt, compress="deflate", tiled=True, blockxsize=256, blockysize=256, count=1)
    with rasterio.open(S.CHM_3857, "w", **prof) as dst:
        dst.write(a, 1)
    meta["chm"] = dict(url=url, quadkey=S.CHM_QUADKEY, file=info, window=window, readSeconds=round(dt, 1), httpRequests=log.requests, downloadedBytes=log.bytes, fileBytes=log.total_file_bytes)
    print(f"CHM 창 {a.shape} {dt:.1f}s, HTTP {log.requests}회 {log.bytes/1e6:.1f} MB / 파일 {log.total_file_bytes/1e6:.0f} MB")

    # 촬영일 (연도 소수, 2000 기준으로 보임: 16.92 → 2016-11) — 0.01° 전 지구 래스터의 bbox 창
    t0 = time.time()
    with CurlLog() as log, rasterio.Env(**GDAL_ENV), rasterio.open(f"{S.CHM_BASE}/CHM_acquisition_date.tif") as src:
        w, s, e, n = C.BBOX
        win = from_bounds(w - 0.01, s - 0.01, e + 0.01, n + 0.01, src.transform).round_offsets().round_lengths()
        acq = src.read(1, window=win)
    np.save(S.CHM_ACQ_NPY, acq)
    u, cnt = np.unique(acq[acq > 0], return_counts=True)
    meta["acquisition"] = dict(source="CHM_acquisition_date.tif (0.01°, float32, 값 = 연도-2000 로 해석)", values={f"{v:.4f}": int(c) for v, c in zip(u, cnt)}, decoded=[f"{int(2000 + v)}-{int(round((v % 1) * 12)) + 1:02d}" for v in u], downloadedBytes=log.bytes, seconds=round(time.time() - t0, 1))
    print("촬영일:", meta["acquisition"]["decoded"], meta["acquisition"]["values"])

    # 마스크 (.msk, 같은 픽셀 격자)
    try:
        with CurlLog() as log, rasterio.Env(**GDAL_ENV), rasterio.open(f"{S.CHM_BASE}/msk/{S.CHM_QUADKEY}.tif.msk") as src:
            m = src.read(1, window=Window(**{k: window[v] for k, v in dict(col_off="colOff", row_off="rowOff", width="width", height="height").items()}))
            flags = src.tags().get("INTERNAL_MASK_FLAGS_1")
        np.save(S.CHM_MSK_NPY, m)
        u, cnt = np.unique(m, return_counts=True)
        meta["mask"] = dict(values={int(v): int(c) for v, c in zip(u, cnt)}, downloadedBytes=log.bytes, flags=flags)
        print("msk 값 분포:", meta["mask"]["values"])
    except Exception as e:  # noqa: BLE001
        meta["mask"] = dict(error=repr(e))


def utm_grid(res_m: int):
    """bbox(UTM) + GRID_MARGIN_M 을 res_m 격자에 맞춘 transform/width/height."""
    to_utm = Transformer.from_crs("EPSG:4326", C.CRS_METRIC, always_xy=True)
    w, s, e, n = C.BBOX
    xs, ys = to_utm.transform([w, e, w, e], [s, s, n, n])
    m = S.GRID_MARGIN_M
    x0 = np.floor((min(xs) - m) / res_m) * res_m
    x1 = np.ceil((max(xs) + m) / res_m) * res_m
    y0 = np.floor((min(ys) - m) / res_m) * res_m
    y1 = np.ceil((max(ys) + m) / res_m) * res_m
    return from_origin(x0, y1, res_m, res_m), int((x1 - x0) / res_m), int((y1 - y0) / res_m)


def reproject_to_utm(meta: dict) -> None:
    for res in S.GRID_RES_CHOICES:
        tr, width, height = utm_grid(res)
        t0 = time.time()
        with rasterio.open(S.CHM_3857) as src:
            chm = np.zeros((height, width), dtype=np.uint8)
            reproject(rasterio.band(src, 1), chm, dst_transform=tr, dst_crs=C.CRS_METRIC, dst_nodata=0, resampling=Resampling.nearest)
        with rasterio.open(S.chm_utm(res), "w", driver="GTiff", width=width, height=height, count=1, dtype="uint8", crs=C.CRS_METRIC, transform=tr, compress="deflate", tiled=True) as dst:
            dst.write(chm, 1)
        with rasterio.open(C.DEM_UTM) as src:
            dem = np.full((height, width), np.nan, dtype=np.float32)
            reproject(rasterio.band(src, 1), dem, dst_transform=tr, dst_crs=C.CRS_METRIC, dst_nodata=np.nan, src_nodata=src.nodata, resampling=Resampling.bilinear)
        with rasterio.open(S.dem_utm_fine(res), "w", driver="GTiff", width=width, height=height, count=1, dtype="float32", crs=C.CRS_METRIC, transform=tr, compress="deflate", tiled=True, nodata=np.nan) as dst:
            dst.write(dem, 1)
        dt = time.time() - t0
        meta[f"utm{res}m"] = dict(width=width, height=height, cells=width * height, seconds=round(dt, 1), chmMean=round(float(chm.mean()), 2), chmMax=int(chm.max()), fracAbove2m=round(float((chm > 2).mean()), 4), fracZero=round(float((chm == 0).mean()), 4), demMin=round(float(np.nanmin(dem)), 1), demMax=round(float(np.nanmax(dem)), 1))
        print(f"UTM {res}m: {width}x{height} ({width*height/1e6:.1f}M 셀) {dt:.1f}s  CHM mean {chm.mean():.2f} max {chm.max()}  >2m {(chm>2).mean():.3f}  ==0 {(chm==0).mean():.3f}")


def main() -> None:
    C.DATA.mkdir(exist_ok=True)
    S.OUT.mkdir(parents=True, exist_ok=True)
    meta = json.loads(S.CHM_META_JSON.read_text()) if S.CHM_META_JSON.exists() else {}
    if "--offline" in sys.argv and S.CHM_3857.exists():
        print("offline: 기존", S.CHM_3857)
    else:
        fetch_window(meta)
    reproject_to_utm(meta)
    S.CHM_META_JSON.write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print("→", S.CHM_META_JSON)


if __name__ == "__main__":
    main()
