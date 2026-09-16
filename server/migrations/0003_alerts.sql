-- 0003 — 경보 상태 (F3b). 계곡별 최신 판정 1행 — core `evaluateAlert` 의 결과를 그대로 담는다.
-- `cleared_at` 이 NULL 이면 활성. 해제돼도 행은 지우지 않는다(다음 판정의 `previous` 재료).
CREATE TABLE alerts (
  valley_id            TEXT PRIMARY KEY,
  level                TEXT NOT NULL,
  source               TEXT NOT NULL,
  confidence           TEXT NOT NULL,
  observed_at          TEXT NOT NULL,
  issued_at            TEXT NOT NULL,
  station_code         TEXT,
  rainfall_10m_mm      REAL,
  rainfall_1h_mm       REAL,
  rainfall_3h_mm       REAL,
  basin_rain_mm_per_h  REAL,
  water_level_stage    TEXT,
  water_level_delta_m  REAL,
  lead_time_min        REAL,
  cleared_at           TEXT,
  verified             INTEGER,
  updated_at           TEXT NOT NULL
);
