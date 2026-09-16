#!/usr/bin/env bash
# R3c 전체 재실행. 사전: R3b 의 run_all.sh 가 한 번 돌아 out/dem_utm.tif · out/segments.geojson 이 있어야 한다.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data out/canopy
RES="${RES:-1}"
.venv/bin/python -m canopy.fetch_chm "$@"            # --offline 이면 data/chm_3857_bbox.tif 재사용 (S3 재요청 없음)
.venv/bin/python -m canopy.shade_canopy --res "$RES" --sens
.venv/bin/python -m canopy.quicklook_canopy --res "$RES"   # --no-osm 이면 OSM 타일 겹침 생략
