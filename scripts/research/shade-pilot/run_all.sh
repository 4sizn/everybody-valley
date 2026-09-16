#!/usr/bin/env bash
# R3b 전체 재실행. 사전: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data out
DEM=data/Copernicus_DSM_COG_10_N38_00_E127_00_DEM.tif
[ -f "$DEM" ] || curl -L -o "$DEM" "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N38_00_E127_00_DEM/Copernicus_DSM_COG_10_N38_00_E127_00_DEM.tif"
.venv/bin/python fetch_osm.py "$@"      # --offline 이면 data/overpass.json 재사용
.venv/bin/python prepare_dem.py
.venv/bin/python shade.py
.venv/bin/python quicklook.py           # --no-osm 이면 OSM 타일 겹침 생략
