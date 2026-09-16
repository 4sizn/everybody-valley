"""R3b 그늘 시험 계산 — 공통 설정 (포천 백운계곡)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT / "out"

# --- 대상 계곡: 포천 백운계곡 (경기 포천시 이동면 도평리, 영평천 상류) ---
# OSM waterway=stream way/531287119 — 광덕고개 쪽(38.091N 127.433E)에서
# 도평리 합류점(38.059N 127.387E)까지 흐른다. 백운계곡 버스정류장(node 12159030988,
# 38.0709N 127.4061E)이 이 선 위에 있다.
OSM_WAY_ID = 531287119
# 상류→하류 3구간: way 의 노드 인덱스 범위 [시작, 끝] (끝 포함). 수기 절단.
SEGMENT_NODE_RANGES = {
    "baegun-upper": (10, 35),
    "baegun-middle": (35, 55),
    "baegun-lower": (55, 78),
}
SEGMENT_LABELS = {
    "baegun-upper": "상류(광덕고개 쪽)",
    "baegun-middle": "중류(흥룡사 입구)",
    "baegun-lower": "하류(도평리)",
}

# 관심 bbox (WGS84, [west, south, east, north]) — 약 4km × 4km
BBOX = (127.393, 38.060, 127.440, 38.095)
# 지평선 계산용 버퍼(m): 이 거리 안의 능선까지만 그림자 후보로 본다.
HORIZON_BUFFER_M = 6000
HORIZON_MAX_DIST_M = 6000

# 격자: UTM 52N, 30m
CRS_METRIC = "EPSG:32652"
CELL_M = 30.0

# 태양 위치 시각 (KST)
TZ = "Asia/Seoul"
DATES = ["2026-07-25", "2026-08-15"]
HOURS = ["10:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"]
# 시작 시각 정밀 판정용 10분 스윕 범위
FINE_START = "10:00"
FINE_END = "19:00"
FINE_STEP_MIN = 10

# 구간 샘플 간격(m), 그늘 판정 임계(샘플 비율)
SAMPLE_STEP_M = 30.0
ONSET_THRESHOLD = 0.5

DEM_TILE_URL = (
    "https://copernicus-dem-30m.s3.amazonaws.com/"
    "Copernicus_DSM_COG_10_N38_00_E127_00_DEM/"
    "Copernicus_DSM_COG_10_N38_00_E127_00_DEM.tif"
)
DEM_TILE = DATA / "Copernicus_DSM_COG_10_N38_00_E127_00_DEM.tif"
DEM_UTM = OUT / "dem_utm.tif"          # bbox+버퍼, 30m UTM
OVERPASS_JSON = DATA / "overpass.json"
SEGMENTS_GEOJSON = OUT / "segments.geojson"
ONSET_JSON = OUT / "onset.json"
