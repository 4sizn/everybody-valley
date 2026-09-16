"""R3c 3단계: DEM 음영 + CHM(녹색) + 그늘(파란색) + 구간·50 m 버퍼 PNG 3장(12·15·17시) + OSM 타일 위 겹침 1장.

실행:  .venv/bin/python -m canopy.quicklook_canopy [--res 1|2] [--no-osm]
전제:  canopy.shade_canopy 실행(out/canopy/masks-<res>m.npz, result-<res>m.json)
산출:  out/canopy/quicklook-0801-<HH>.png, out/canopy/quicklook-osm-0801-15.png
"""
from __future__ import annotations

import sys

import matplotlib
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject
from pyproj import Transformer

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

import config as C  # noqa: E402
from canopy import settings as S  # noqa: E402
from canopy.shade_canopy import Grid  # noqa: E402
from shade import Dem  # noqa: E402
from quicklook import SEG_COLORS, draw_vectors, fetch_osm_mosaic, hillshade, korean_font, load_vectors  # noqa: E402

OSM_HOUR = "15:00"
GREENS = LinearSegmentedColormap.from_list("chm", [(0, 0, 0, 0), (0.2, 0.55, 0.2, 0.75), (0.0, 0.3, 0.0, 0.95)])


def extent_of(transform, shape):
    return (transform.c, transform.c + transform.a * shape[1], transform.f + transform.e * shape[0], transform.f)


def sun_of(result, hh):
    return next(s for s in result["sun"] if s["date"] == S.DATE and s["timeLocal"] == hh)


def draw_buffers(ax, segs, half=50.0):
    for p, line in segs:
        x, y = line.buffer(half, cap_style=2).exterior.xy
        ax.plot(x, y, color=SEG_COLORS[p["id"]], lw=0.8, ls=":", alpha=0.9)


def quicklook_utm(grid: Grid, masks, result, segs, peaks, res):
    chm = grid.crop(grid.chm)
    dem30 = Dem()  # 음영기복은 30 m 원본으로(1 m bilinear 표면은 기울기 불연속 때문에 격자 무늬가 생긴다)
    z30 = dem30.core_z()
    hs = hillshade(z30, dem30.res)
    ext30 = extent_of(dem30.core_transform, z30.shape)
    ext = extent_of(grid.core_transform, chm.shape)
    for hh in S.QUICKLOOK_HOURS:
        m = masks[hh.replace(":", "")]
        s = sun_of(result, hh)
        e = result["byHour"]
        bh = next(b for b in e if b["date"] == S.DATE and b["timeLocal"] == hh)
        fig, ax = plt.subplots(figsize=(9.5, 9), dpi=90)
        ax.imshow(hs, cmap="gray", extent=ext30, vmin=0, vmax=1)
        ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[2], ext[3])
        ax.imshow(np.ma.masked_less_equal(chm, S.CANOPY_THRESHOLD_M), cmap=GREENS, extent=ext, vmin=0, vmax=25, interpolation="nearest")
        overlay = np.zeros((*m.shape, 4), dtype=np.float32)
        cast_only = m & ~(chm > S.CANOPY_THRESHOLD_M)
        overlay[cast_only] = (0.1, 0.2, 0.9, 0.7)  # 개방지에 드리운 그림자(나무·지형)
        ax.imshow(overlay, extent=ext, interpolation="nearest")
        draw_vectors(ax, segs, peaks, ext)
        draw_buffers(ax, segs)
        seg_txt = "  ".join(f"{sid.split('-')[1][:3]} {bh['segments'][sid]['buffer50']['shade']:.2f}" for sid in bh["segments"])
        ax.set_title(f"백운계곡 그늘(지형 30 m + 수관 1 m) — {S.DATE} {hh} KST · 격자 {res} m\n태양 방위 {s['sunAzimuth']:.0f}° 고도 {s['sunElevation']:.0f}° · bbox 그늘 {bh['bbox']['shade']:.1%} (수관 아래 {bh['bbox']['underCanopy']:.1%} + 개방지 그림자 {bh['bbox']['castOnly']+bh['bbox']['terrainOnly']:.1%}) · 구간 50 m 버퍼 그늘: {seg_txt}", fontsize=10)
        handles, labels = ax.get_legend_handles_labels()
        handles += [Patch(color=(0.2, 0.55, 0.2, 0.8), label=f"수관 CHM > {S.CANOPY_THRESHOLD_M:g} m (나무 아래)"), Patch(color=(0.1, 0.2, 0.9, 0.7), label="개방지에 드리운 그림자")]
        ax.legend(handles=handles, loc="lower left", fontsize=8)
        ax.set_xlabel("UTM 52N x (m)")
        ax.set_ylabel("UTM 52N y (m)")
        ax.set_aspect("equal")
        fig.tight_layout()
        out = S.OUT / f"quicklook-0801-{hh[:2]}.png"
        fig.savefig(out)
        plt.close(fig)
        print("→", out)


def quicklook_osm(grid: Grid, masks, result, res):
    mosaic, ext = fetch_osm_mosaic(z=15)
    pres = (ext[1] - ext[0]) / mosaic.shape[1]
    dst_transform = from_origin(ext[0], ext[3], pres, pres)
    m = masks[OSM_HOUR.replace(":", "")]
    chm = grid.crop(grid.chm)
    under = (chm > S.CANOPY_THRESHOLD_M).astype(np.uint8)
    cast = (m & ~(chm > S.CANOPY_THRESHOLD_M)).astype(np.uint8)
    layers = []
    for src in (under, cast):
        dst = np.zeros(mosaic.shape[:2], dtype=np.uint8)
        reproject(src, dst, src_transform=grid.core_transform, src_crs=C.CRS_METRIC, dst_transform=dst_transform, dst_crs="EPSG:3857", resampling=Resampling.nearest)
        layers.append(dst)
    s = sun_of(result, OSM_HOUR)
    segs, peaks = load_vectors("EPSG:3857")
    fig, ax = plt.subplots(figsize=(9.5, 9), dpi=90)
    ax.imshow(mosaic, extent=ext)
    ov = np.zeros((*layers[0].shape, 4), dtype=np.float32)
    ov[layers[0] == 1] = (0.2, 0.55, 0.2, 0.45)
    ov[layers[1] == 1] = (0.1, 0.2, 0.9, 0.6)
    ax.imshow(ov, extent=ext, interpolation="nearest")
    draw_vectors(ax, segs, peaks, ext)
    tr = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    bx, by = tr.transform([C.BBOX[0], C.BBOX[2], C.BBOX[2], C.BBOX[0], C.BBOX[0]], [C.BBOX[1], C.BBOX[1], C.BBOX[3], C.BBOX[3], C.BBOX[1]])
    ax.plot(bx, by, color="k", lw=1, ls="--", label="계산 bbox")
    handles, labels = ax.get_legend_handles_labels()
    handles += [Patch(color=(0.2, 0.55, 0.2, 0.6), label="수관 > 2 m"), Patch(color=(0.1, 0.2, 0.9, 0.6), label="개방지 그림자")]
    ax.legend(handles=handles, loc="lower left", fontsize=8)
    ax.set_title(f"백운계곡 그늘 (OSM 표준 타일 z15 위) — {S.DATE} {OSM_HOUR} KST · 격자 {res} m\n태양 방위 {s['sunAzimuth']:.0f}° 고도 {s['sunElevation']:.0f}° · 녹색 = 수관, 파란색 = 개방지 그림자 · © OpenStreetMap contributors", fontsize=10)
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_aspect("equal")
    fig.tight_layout()
    out = S.OUT / f"quicklook-osm-0801-{OSM_HOUR[:2]}.png"
    fig.savefig(out)
    plt.close(fig)
    print("→", out)


def main() -> None:
    import json

    args = sys.argv[1:]
    res = int(args[args.index("--res") + 1]) if "--res" in args else 1
    korean_font()
    grid = Grid(res)
    masks = np.load(S.OUT / f"masks-{res}m.npz")
    result = json.loads((S.OUT / f"result-{res}m.json").read_text())
    segs, peaks = load_vectors(C.CRS_METRIC)
    quicklook_utm(grid, masks, result, segs, peaks, res)
    if "--no-osm" not in args:
        try:
            quicklook_osm(grid, masks, result, res)
        except Exception as e:  # noqa: BLE001
            print(f"OSM 타일 겹침 생략: {e!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
