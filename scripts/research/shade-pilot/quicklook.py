"""4단계: DEM 음영기복 + 그늘 마스크 + 구간 라인 PNG, 그리고 OSM 표준 타일 위 겹침 PNG.

실행:  .venv/bin/python quicklook.py [--no-osm]
전제:  out/dem_utm.tif, out/masks.npz, out/segments.geojson, out/peaks.geojson (shade.py 까지 실행)
산출:  out/quicklook-<date>-<HHMM>.png, out/quicklook-osm-<date>-<HHMM>.png
"""
from __future__ import annotations

import io
import json
import math
import sys
import urllib.request

import matplotlib
import numpy as np
import rasterio
from matplotlib import font_manager
from pyproj import Transformer
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject
from shapely.geometry import shape
from shapely.ops import transform as shp_transform

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

import config as C  # noqa: E402
from shade import Dem  # noqa: E402

QUICKLOOK_DATE = C.DATES[0]
QUICKLOOK_HOURS = ["12:00", "15:00", "17:00", "18:00"]
SEG_COLORS = {"baegun-upper": "#d62728", "baegun-middle": "#ff7f0e", "baegun-lower": "#9467bd"}


def korean_font() -> None:
    for name in ("Apple SD Gothic Neo", "AppleGothic", "NanumGothic", "Malgun Gothic", "Noto Sans CJK KR"):
        if any(f.name == name for f in font_manager.fontManager.ttflist):
            plt.rcParams["font.family"] = name
            return
    print("경고: 한글 폰트를 찾지 못했다 — 라벨이 깨질 수 있다", file=sys.stderr)


def hillshade(z: np.ndarray, res: float, az: float = 315.0, alt: float = 45.0) -> np.ndarray:
    gy, gx = np.gradient(z, res)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az_r, alt_r = np.deg2rad(az), np.deg2rad(alt)
    hs = np.sin(alt_r) * np.cos(slope) + np.cos(alt_r) * np.sin(slope) * np.cos(az_r - np.pi / 2 - aspect)
    return np.clip(hs, 0, 1)


def load_vectors(to_crs: str):
    tr = Transformer.from_crs("EPSG:4326", to_crs, always_xy=True).transform
    segs = [(f["properties"], shp_transform(tr, shape(f["geometry"]))) for f in json.loads(C.SEGMENTS_GEOJSON.read_text())["features"]]
    peaks = [(f["properties"], shp_transform(tr, shape(f["geometry"]))) for f in json.loads((C.OUT / "peaks.geojson").read_text())["features"]]
    return segs, peaks


def draw_vectors(ax, segs, peaks, extent):
    for p, line in segs:
        x, y = line.xy
        ax.plot(x, y, color=SEG_COLORS[p["id"]], lw=3, solid_capstyle="round", label=f"{p['label']} ({p['lengthM']} m)")
    for p, pt in peaks:
        if extent[0] <= pt.x <= extent[1] and extent[2] <= pt.y <= extent[3] and p.get("name"):
            ax.plot(pt.x, pt.y, marker="^", color="k", ms=6)
            ax.annotate(f"{p['name']} {p.get('ele') or ''}", (pt.x, pt.y), xytext=(4, 4), textcoords="offset points", fontsize=8)


def sun_info(date: str, hhmm: str) -> dict:
    return next(s for s in json.loads((C.OUT / "sun.json").read_text()) if s["date"] == date and s["timeLocal"] == hhmm)


def quicklook_utm(dem: Dem, masks, segs, peaks) -> None:
    z = dem.core_z()
    hs = hillshade(z, dem.res)
    t = dem.core_transform
    extent = (t.c, t.c + t.a * z.shape[1], t.f + t.e * z.shape[0], t.f)
    for hhmm in QUICKLOOK_HOURS:
        key = f"{QUICKLOOK_DATE}_{hhmm.replace(':', '')}"
        mask = masks[key]
        s = sun_info(QUICKLOOK_DATE, hhmm)
        fig, ax = plt.subplots(figsize=(9, 8.5), dpi=110)
        ax.imshow(hs, cmap="gray", extent=extent, vmin=0, vmax=1)
        ax.imshow(z, cmap="terrain", extent=extent, alpha=0.35)
        ax.contour(np.linspace(extent[0] + dem.res / 2, extent[1] - dem.res / 2, z.shape[1]), np.linspace(extent[3] - dem.res / 2, extent[2] + dem.res / 2, z.shape[0]), z, levels=np.arange(200, 1300, 100), colors="k", linewidths=0.3, alpha=0.5)
        overlay = np.zeros((*mask.shape, 4))
        overlay[mask] = (0.1, 0.2, 0.8, 0.55)
        ax.imshow(overlay, extent=extent, interpolation="nearest")
        draw_vectors(ax, segs, peaks, extent)
        ax.set_title(f"백운계곡 지형 산그늘 — {QUICKLOOK_DATE} {hhmm} KST\n태양 방위 {s['azimuth']:.0f}° 고도 {s['elevation']:.0f}° · 그늘 셀 {s['shadedCellFraction']:.1%} · GLO-30 30m · 파란색 = 그늘", fontsize=11)
        ax.set_xlabel("UTM 52N x (m)")
        ax.set_ylabel("UTM 52N y (m)")
        ax.legend(loc="lower left", fontsize=8)
        ax.set_aspect("equal")
        fig.tight_layout()
        out = C.OUT / f"quicklook-{QUICKLOOK_DATE}-{hhmm.replace(':', '')}.png"
        fig.savefig(out)
        plt.close(fig)
        print("→", out)


# --------------------------------------------------------------------------- OSM 타일
def tile_xy(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180) / 360 * n)
    lat_r = math.radians(lat)
    y = int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n)
    return x, y


def tile_bounds_3857(x: int, y: int, z: int) -> tuple[float, float, float, float]:
    n = 2**z
    size = 2 * math.pi * 6378137 / n
    x0 = -math.pi * 6378137 + x * size
    y1 = math.pi * 6378137 - y * size
    return x0, x0 + size, y1 - size, y1


def fetch_osm_mosaic(z: int = 14):
    w, s, e, n = C.BBOX
    x0, y0 = tile_xy(w, n, z)
    x1, y1 = tile_xy(e, s, z)
    tiles = {}
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            req = urllib.request.Request(f"https://tile.openstreetmap.org/{z}/{x}/{y}.png", headers={"User-Agent": "modu-valley-research/0.1 (shade pilot quicklook)"})
            with urllib.request.urlopen(req, timeout=30) as r:
                tiles[(x, y)] = plt.imread(io.BytesIO(r.read()), format="png")
    h = (y1 - y0 + 1) * 256
    wpx = (x1 - x0 + 1) * 256
    mosaic = np.zeros((h, wpx, 4))
    for (x, y), img in tiles.items():
        if img.shape[2] == 3:
            img = np.dstack([img, np.ones(img.shape[:2])])
        mosaic[(y - y0) * 256 : (y - y0 + 1) * 256, (x - x0) * 256 : (x - x0 + 1) * 256] = img
    left = tile_bounds_3857(x0, y0, z)[0]
    top = tile_bounds_3857(x0, y0, z)[3]
    right = tile_bounds_3857(x1, y1, z)[1]
    bottom = tile_bounds_3857(x1, y1, z)[2]
    return mosaic, (left, right, bottom, top)


def quicklook_osm(dem: Dem, masks, segs3857, peaks3857) -> None:
    mosaic, extent = fetch_osm_mosaic()
    res = (extent[1] - extent[0]) / mosaic.shape[1]
    dst_transform = from_origin(extent[0], extent[3], res, res)
    for hhmm in QUICKLOOK_HOURS:
        key = f"{QUICKLOOK_DATE}_{hhmm.replace(':', '')}"
        src = masks[key].astype(np.uint8)
        dst = np.zeros(mosaic.shape[:2], dtype=np.uint8)
        reproject(src, dst, src_transform=dem.core_transform, src_crs=C.CRS_METRIC, dst_transform=dst_transform, dst_crs="EPSG:3857", resampling=Resampling.nearest)
        s = sun_info(QUICKLOOK_DATE, hhmm)
        fig, ax = plt.subplots(figsize=(9, 8.5), dpi=110)
        ax.imshow(mosaic, extent=extent)
        overlay = np.zeros((*dst.shape, 4))
        overlay[dst == 1] = (0.1, 0.2, 0.8, 0.5)
        ax.imshow(overlay, extent=extent, interpolation="nearest")
        draw_vectors(ax, segs3857, peaks3857, extent)
        tr = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
        bx, by = tr.transform([C.BBOX[0], C.BBOX[2], C.BBOX[2], C.BBOX[0], C.BBOX[0]], [C.BBOX[1], C.BBOX[1], C.BBOX[3], C.BBOX[3], C.BBOX[1]])
        ax.plot(bx, by, color="k", lw=1, ls="--", label="계산 bbox")
        ax.set_title(f"백운계곡 지형 산그늘 (OSM 표준 타일 위) — {QUICKLOOK_DATE} {hhmm} KST\n태양 방위 {s['azimuth']:.0f}° 고도 {s['elevation']:.0f}° · 파란색 = 그늘 · © OpenStreetMap contributors", fontsize=11)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.legend(loc="lower left", fontsize=8)
        ax.set_aspect("equal")
        fig.tight_layout()
        out = C.OUT / f"quicklook-osm-{QUICKLOOK_DATE}-{hhmm.replace(':', '')}.png"
        fig.savefig(out)
        plt.close(fig)
        print("→", out)


def main() -> None:
    korean_font()
    dem = Dem()
    masks = np.load(C.OUT / "masks.npz")
    segs, peaks = load_vectors(C.CRS_METRIC)
    quicklook_utm(dem, masks, segs, peaks)
    if "--no-osm" not in sys.argv:
        try:
            quicklook_osm(dem, masks, *load_vectors("EPSG:3857"))
        except Exception as e:  # noqa: BLE001
            print(f"OSM 타일 겹침 생략: {e!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
