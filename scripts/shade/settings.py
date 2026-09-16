"""P1 상수 — R3c `canopy/settings.py` 권고값을 그대로 옮겼다. 여기 값을 바꾸면 산출물 규약이 바뀐다."""
from __future__ import annotations

# --- 시각 ---
TZ = "Asia/Seoul"
REPRESENTATIVE_DATE = "2026-08-01"  # 대표일(성수기 8/1). 정오 값은 날짜에 거의 무관(R3c 민감도 ≤ 0.001)
HOURS = [f"{h:02d}:00" for h in range(10, 19)]  # KST 10~18 정시 9개 — shadeByHour 인덱스·shadow-<HH> 파일과 같은 순서
NOON_INDEX = HOURS.index("12:00")  # shadeRatio(호환) = shadeByHour[NOON_INDEX]

# --- 격자 ---
GRID_RES_M = 2  # 계산 격자 (UTM, m)
GRID_MARGIN_M = 200.0  # 코어(bbox) 바깥 caster 여유. 원거리 지형은 30 m 지평선 마스크가 담당
DEM_CELL_M = 30.0  # GLO-30 재투영 격자
HORIZON_BUFFER_M = 6000.0  # 30 m DEM 범위 = bbox + 이 값
HORIZON_MAX_DIST_M = 6000.0  # 지평선 추적 최대 거리
HORIZON_STEP_M = DEM_CELL_M / 2

# --- 그늘 판정 ---
CANOPY_THRESHOLD_M = 2.0  # CHM > 2 m = 나무 아래
SHADOW_TOL_M = 0.1  # 그림자 높이 > 표면 + tol 이면 그늘

# --- 구간 집계 ---
BUFFER_HALF_M = 25.0  # shadeByHour · canopyCover 버퍼 반폭 — R3c 권고 25 m(사용자 확정 2026-09-03, PR #10 리뷰). 50 m 는 사면 나무를 세어 물가 그늘과 어긋난다
CORRIDOR_HALF_M = 200.0  # 폴리곤 절단 회랑 (라인 ±200 m)
BBOX_PAD_M = 50.0  # 코어 bbox = 구간·시설 경계 + 회랑 + 이 여유
PROP_DECIMALS = 3  # 역기입 속성 소수 자리

# --- 폴리곤 ---
POLY_TOL_M = 2.0  # simplify(preserve_topology)
POLY_MIN_AREA_M2 = 25.0
COORD_DECIMALS = 5  # [lng, lat] 소수 5자리 (~1 m)

# --- 자산 ---
GLO30_BASE = "https://copernicus-dem-30m.s3.amazonaws.com"
GLO30_DATASET = "Copernicus DEM GLO-30 (COG, s3://copernicus-dem-30m)"
CHM_BASE = "https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float"
CHM_DATASET = "Meta/WRI Global Canopy Height Map v1 (alsgedi_global_v6_float, 1 m, CC-BY 4.0)"
CHM_ZOOM = 9  # quadkey 줌
CHM_WINDOW_MARGIN_M = 250.0  # CHM 창 여유(EPSG:3857) — 격자 여유 200 m 를 덮는다

def source_sentence(chm_acquisition: list[str]) -> str:
    """산출 파일 metadata.source — 계곡마다 CHM 촬영 연도 범위를 넣는다(화면 고지 문구의 재료)."""
    years = sorted({a[:4] for a in chm_acquisition})
    span = years[0] if len(years) == 1 else f"{years[0]}~{years[-1]}" if years else "연도 미상"
    return (
        f"위성 기반 추정 — Copernicus GLO-30 지형(30 m) + Meta/WRI 수관 높이(1 m CHM, {span} 촬영). "
        "그늘 = 수관(CHM > 2 m) ∪ 나무·지형 그림자 ∪ 원거리 지형 마스크. 현장과 다를 수 있음."
    )
