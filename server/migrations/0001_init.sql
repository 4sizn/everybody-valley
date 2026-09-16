-- 0001 — 관측소 제원 + 수집 로그 (S1a). 스키마는 Postgres 로 옮길 수 있게 SQL 표준 안에서 쓴다(결정 (b)).

-- 관측소 제원. kind 는 'hrfco-waterlevel' | 'hrfco-rainfall' | 'aws'.
-- 좌표는 십진도(HRFCO 의 "127-15-30" 도분초는 적재 시 변환). attrs 는 원 속성 JSON(수위 4단계 attwl/wrnwl/almwl/srswl 등).
CREATE TABLE stations (
  kind         TEXT    NOT NULL,
  code         TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  agency       TEXT,
  lng          REAL,
  lat          REAL,
  elevation_m  REAL,
  attrs        TEXT,
  suspicious   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT    NOT NULL,
  PRIMARY KEY (kind, code)
);

-- 외부 API 호출 기록. job 은 'hrfco' | 'aws' | 'stations' | 'basins'. error 는 키가 마스킹된 메시지만.
CREATE TABLE fetch_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job          TEXT    NOT NULL,
  started_at   TEXT    NOT NULL,
  finished_at  TEXT    NOT NULL,
  ok           INTEGER NOT NULL,
  status       INTEGER,
  rows         INTEGER,
  duration_ms  INTEGER NOT NULL,
  error        TEXT
);

CREATE INDEX fetch_log_job_finished ON fetch_log (job, finished_at DESC);
