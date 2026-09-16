"""외부 래스터 자산 취득 + 캐시 — GLO-30 타일, Meta CHM z9 quadkey 창 읽기, CHM 촬영일.

R3c `canopy/fetch_chm.py` 방식: CHM 타일(680 MB 스트립 TIFF)은 GDAL vsicurl 로 bbox 행 범위만 범위 요청한다(계곡 4 × 4 km 에 ~55 MB).
GLO-30 은 1° 타일(46 MB)을 통째로 받아 캐시한다 — 계곡 여럿이 한 타일을 공유한다.
캐시 디렉터리(`scripts/shade/.cache/`)는 gitignore.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from rasterio.errors import WindowError
from pyproj import Transformer
from rasterio.merge import merge
from rasterio.windows import Window, from_bounds

from shade import settings as S

Bbox = tuple[float, float, float, float]  # WGS84 (west, south, east, north)

GDAL_ENV = dict(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.msk",
    GDAL_HTTP_MULTIRANGE="YES",
    GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
    CPL_VSIL_CURL_CHUNK_SIZE=str(4 * 1024 * 1024),
    GDAL_INGESTED_BYTES_AT_OPEN=str(2 * 1024 * 1024),
)

_TO_3857 = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def expand_bbox_m(bbox: Bbox, margin_m: float) -> Bbox:
    """WGS84 bbox 를 m 단위로 넓힌다(위도 111.32 km/°, 경도는 cos(lat) 보정)."""
    w, s, e, n = bbox
    dlat = margin_m / 111_320.0
    dlon = margin_m / (111_320.0 * math.cos(math.radians((s + n) / 2)))
    return (w - dlon, s - dlat, e + dlon, n + dlat)


def bbox_to_3857(bbox: Bbox, margin_m: float = 0.0) -> Bbox:
    w, s, e, n = bbox
    xs, ys = _TO_3857.transform([w, e], [s, n])
    return xs[0] - margin_m, ys[0] - margin_m, xs[1] + margin_m, ys[1] + margin_m


# --------------------------------------------------------------------------- GLO-30
def glo30_tile_name(lat_floor: int, lon_floor: int) -> str:
    ns = "N" if lat_floor >= 0 else "S"
    ew = "E" if lon_floor >= 0 else "W"
    return f"Copernicus_DSM_COG_10_{ns}{abs(lat_floor):02d}_00_{ew}{abs(lon_floor):03d}_00_DEM"


def glo30_tiles_for(bbox: Bbox, buffer_m: float = S.HORIZON_BUFFER_M) -> list[str]:
    """bbox + 지평선 버퍼가 걸치는 1° 타일 이름들(위도·경도 경계에 걸치면 둘 이상)."""
    w, s, e, n = expand_bbox_m(bbox, buffer_m)
    names = []
    for lat in range(math.floor(s), math.floor(n) + 1):
        for lon in range(math.floor(w), math.floor(e) + 1):
            names.append(glo30_tile_name(lat, lon))
    return names


def _download(url: str, dest: Path) -> int:
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        with urllib.request.urlopen(url, timeout=120) as resp, tmp.open("wb") as f:
            n = 0
            while True:
                chunk = resp.read(4 * 1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                n += len(chunk)
    except urllib.error.HTTPError as exc:
        tmp.unlink(missing_ok=True)
        if exc.code == 404:
            return -1
        raise
    tmp.replace(dest)
    return n


def fetch_glo30_tiles(bbox: Bbox, cache_dir: Path) -> list[Path]:
    """bbox(+6 km) 를 덮는 GLO-30 타일을 캐시에 내려받고 경로를 돌려준다. 바다 등 없는 타일(404)은 건너뛴다."""
    out_dir = cache_dir / "glo30"
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for name in glo30_tiles_for(bbox):
        dest = out_dir / f"{name}.tif"
        if not dest.exists():
            url = f"{S.GLO30_BASE}/{name}/{name}.tif"
            log(f"  GLO-30 다운로드 {name} …")
            n = _download(url, dest)
            if n < 0:
                log(f"  GLO-30 타일 없음(404) — 건너뜀: {name}")
                continue
            log(f"  GLO-30 {n / 1e6:.0f} MB → {dest}")
        paths.append(dest)
    if not paths:
        raise RuntimeError(f"bbox {bbox} 를 덮는 GLO-30 타일을 하나도 받지 못했다")
    return paths


# --------------------------------------------------------------------------- CHM quadkey
def _tile_xy(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 1 << z
    x = int(math.floor((lon + 180.0) / 360.0 * n))
    lat_r = math.radians(lat)
    y = int(math.floor((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n))
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def quadkey(x: int, y: int, z: int) -> str:
    digits = []
    for i in range(z, 0, -1):
        d = 0
        mask = 1 << (i - 1)
        if x & mask:
            d += 1
        if y & mask:
            d += 2
        digits.append(str(d))
    return "".join(digits)


def quadkeys_for(bbox: Bbox, margin_m: float = S.CHM_WINDOW_MARGIN_M, z: int = S.CHM_ZOOM) -> list[str]:
    """bbox + 여유를 덮는 z9 quadkey 들(모서리 4점 → 보통 1개, 타일 경계에 걸치면 2~4개)."""
    w, s, e, n = expand_bbox_m(bbox, margin_m)
    x0, y0 = _tile_xy(w, n, z)  # 북서
    x1, y1 = _tile_xy(e, s, z)  # 남동
    return [quadkey(x, y, z) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def _bbox_key(b: Bbox) -> str:
    return hashlib.sha1(",".join(f"{v:.0f}" for v in b).encode()).hexdigest()[:10]


def fetch_chm_window(bbox: Bbox, margin_m: float = S.CHM_WINDOW_MARGIN_M, cache_dir: Path = Path(".cache")) -> tuple[Path, dict]:
    """bbox(WGS84) + 여유를 덮는 quadkey 들의 CHM 을 창 읽기해 EPSG:3857 GeoTIFF 로 저장, 여럿이면 병합.

    반환: (병합된 로컬 tif, 메타 {quadkeys, windowBounds3857, bytes})."""
    out_dir = cache_dir / "chm"
    out_dir.mkdir(parents=True, exist_ok=True)
    b3857 = bbox_to_3857(bbox, margin_m)
    key = _bbox_key(b3857)
    qks = quadkeys_for(bbox, margin_m)
    parts = []
    for qk in qks:
        dest = out_dir / f"{qk}-{key}.tif"
        if not dest.exists():
            url = f"{S.CHM_BASE}/chm/{qk}.tif"
            log(f"  CHM 창 읽기 {qk} …")
            with rasterio.Env(**GDAL_ENV), rasterio.open(url) as src:
                try:
                    win = from_bounds(*b3857, src.transform).intersection(Window(0, 0, src.width, src.height))
                except WindowError:
                    # 타일 경계 바로 바깥의 이웃 quadkey(모서리 점이 경계에 걸려 뽑힘) — 덮는 창이 없으면 건너뛴다.
                    log(f"  CHM {qk} 는 창과 겹치지 않아 건너뜀")
                    continue
                win = win.round_offsets().round_lengths()
                if win.width <= 0 or win.height <= 0:
                    continue
                a = src.read(1, window=win)
                prof = src.profile
                prof.update(driver="GTiff", width=a.shape[1], height=a.shape[0], transform=rasterio.windows.transform(win, src.transform), compress="deflate", tiled=True, blockxsize=256, blockysize=256, count=1)
            tmp = dest.with_suffix(".part.tif")
            with rasterio.open(tmp, "w", **prof) as dst:
                dst.write(a, 1)
            tmp.replace(dest)
            log(f"  CHM {qk} 창 {a.shape[1]}×{a.shape[0]} → {dest}")
        parts.append(dest)
    if not parts:
        raise RuntimeError(f"bbox {bbox} 를 덮는 CHM 창을 읽지 못했다 (quadkeys {qks})")
    if len(parts) == 1:
        merged = parts[0]
    else:
        merged = out_dir / f"merged-{key}.tif"
        if not merged.exists():
            srcs = [rasterio.open(p) for p in parts]
            try:
                arr, tr = merge(srcs, nodata=0)
                prof = srcs[0].profile
            finally:
                for s_ in srcs:
                    s_.close()
            prof.update(driver="GTiff", width=arr.shape[2], height=arr.shape[1], transform=tr, compress="deflate", tiled=True, blockxsize=256, blockysize=256, count=1)
            with rasterio.open(merged, "w", **prof) as dst:
                dst.write(arr[0], 1)
    meta = {"quadkeys": qks, "windowBounds3857": [round(v, 1) for v in b3857], "bytes": sum(p.stat().st_size for p in parts)}
    return merged, meta


def fetch_chm_acquisition(bbox: Bbox, cache_dir: Path) -> list[str]:
    """`CHM_acquisition_date.tif`(0.01°, 값 = 연도 − 2000 소수) 의 bbox 창 → 'YYYY-MM' 목록(오름차순, 중복 제거)."""
    out_dir = cache_dir / "chm"
    out_dir.mkdir(parents=True, exist_ok=True)
    w, s, e, n = bbox
    dest = out_dir / f"acq-{_bbox_key((w * 1000, s * 1000, e * 1000, n * 1000))}.json"
    if dest.exists():
        return json.loads(dest.read_text())["decoded"]
    log("  CHM 촬영일 창 읽기 …")
    with rasterio.Env(**GDAL_ENV), rasterio.open(f"{S.CHM_BASE}/CHM_acquisition_date.tif") as src:
        win = from_bounds(w - 0.01, s - 0.01, e + 0.01, n + 0.01, src.transform).intersection(Window(0, 0, src.width, src.height)).round_offsets().round_lengths()
        acq = src.read(1, window=win)
    vals = sorted({float(v) for v in np.unique(acq[acq > 0])})
    decoded = sorted({f"{int(2000 + v)}-{int(round((v % 1) * 12)) + 1:02d}" for v in vals})
    dest.write_text(json.dumps({"values": vals, "decoded": decoded}))
    return decoded
