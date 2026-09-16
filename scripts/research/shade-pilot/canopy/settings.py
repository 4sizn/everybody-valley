"""R3c 수관(CHM) 그늘 시험 — 설정. 부모 패키지 config(R3b) 를 그대로 물려받고 CHM 관련만 더한다.

실행은 shade-pilot 디렉터리에서 `.venv/bin/python -m canopy.<module>` 로 한다(부모 config/shade/quicklook import).
"""
from __future__ import annotations

import config as C  # R3b 공통 설정 (bbox, 구간, DEM 경로, 시간대)

OUT = C.OUT / "canopy"

# --- Meta/WRI 1m CHM (CC-BY 4.0) ---
CHM_BASE = "https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float"
CHM_QUADKEY = "132110303"  # z9 Bing quadkey — 백운계곡 bbox 전체를 덮는다(모서리 4점 모두 이 타일)
CHM_WINDOW_MARGIN_M = 250  # EPSG:3857 창 여유(그림자 투사 caster 용)
CHM_3857 = C.DATA / "chm_3857_bbox.tif"  # 윈도 읽기 결과(원본 격자 그대로, 커밋 안 함)
CHM_ACQ_NPY = C.DATA / "chm_acq_bbox.npy"  # CHM_acquisition_date.tif 의 bbox 창(0.01° 격자)
CHM_MSK_NPY = C.DATA / "chm_msk_bbox.npy"
CHM_META_JSON = OUT / "chm-meta.json"


def chm_utm(res_m: int):
    return C.DATA / f"chm_utm_{res_m}m.tif"


def dem_utm_fine(res_m: int):
    return C.DATA / f"dem_utm_{res_m}m.tif"


# --- 계산 격자 ---
GRID_RES_CHOICES = (1, 2)
GRID_MARGIN_M = 200  # bbox 바깥 caster 여유(1m 격자). 지형 원거리 그림자는 30m 마스크가 담당
CANOPY_THRESHOLD_M = 2.0  # "나무 아래" 판정 CHM 임계
CANOPY_THRESHOLDS_SENS = (1.0, 2.0, 3.0, 5.0)
SHADOW_TOL_M = 0.1  # 그림자 높이 > 표면 + tol 이면 그늘

# 구간 버퍼(반폭, m). water10 은 OSM 물 폴리곤이 없어 라인 ±10 m 로 물가를 근사
BUFFERS_M = {"buffer50": 50.0, "buffer25": 25.0, "water10": 10.0}

# 시각
DATE = "2026-08-01"
SENS_DATES = ("2026-07-25", "2026-08-15")
HOURS = [f"{h:02d}:00" for h in range(10, 19)]  # KST 10~18 정시 9개
QUICKLOOK_HOURS = ("12:00", "15:00", "17:00")

# 폴리곤화
POLY_SIMPLIFY_TOL_M = (0.0, 1.0, 2.0, 4.0)  # 비교용
POLY_TOL_DEFAULT_M = 2.0  # out/canopy/shade-0801-<HH>.geojson 에 쓰는 값
POLY_MIN_AREA_M2 = 25.0
POLY_COORD_DECIMALS = 5  # ~1 m
CORRIDOR_HALF_M = 200.0  # 폴리곤을 구간 회랑(라인 ±200 m)으로 잘랐을 때의 크기 비교용
