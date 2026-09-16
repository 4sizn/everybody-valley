-- 0002 — 관측값·최신값·표준유역 (S1b).

-- 10분 격자 관측값, 최근 7일 보존(폴러가 지운다). observed_at 은 ISO 8601 UTC.
-- kind 별 value: hrfco-waterlevel = 수위 m · hrfco-rainfall = 10분 강우 mm · aws = RN-60m(1시간 누적 강우 mm).
-- extra 는 JSON — hrfco-waterlevel {fw: 유량} · aws {rn15, rn12h, rnDay, ta, re}.
CREATE TABLE observations (
  kind         TEXT NOT NULL,
  code         TEXT NOT NULL,
  observed_at  TEXT NOT NULL,
  value        REAL,
  extra        TEXT,
  fetched_at   TEXT NOT NULL,
  PRIMARY KEY (kind, code, observed_at)
);

CREATE INDEX observations_kind_observed ON observations (kind, observed_at DESC);

-- 관측소별 가장 최근 값(폴링마다 upsert). /api/hydro/latest · /api/aws/latest 가 읽는다.
CREATE TABLE latest (
  kind         TEXT NOT NULL,
  code         TEXT NOT NULL,
  observed_at  TEXT NOT NULL,
  value        REAL,
  extra        TEXT,
  fetched_at   TEXT NOT NULL,
  PRIMARY KEY (kind, code)
);

-- 표준유역 폴리곤(국토부 수자원관리도 WFS, 공공누리 1유형). 브이월드 데이터는 여기에 넣지 않는다(약관 §19).
-- geometry 는 GeoJSON Geometry(Polygon | MultiPolygon, 경도·위도). bbox 는 point-in-polygon 전 후보 걸러내기용.
CREATE TABLE basins (
  sbsncd       TEXT PRIMARY KEY,
  sbsnnm       TEXT,
  mbsncd       TEXT,
  bbsncd       TEXT,
  geometry     TEXT NOT NULL,
  min_lng      REAL NOT NULL,
  min_lat      REAL NOT NULL,
  max_lng      REAL NOT NULL,
  max_lat      REAL NOT NULL,
  source       TEXT NOT NULL,
  collected_at TEXT NOT NULL
);

CREATE INDEX basins_bbox ON basins (min_lng, max_lng, min_lat, max_lat);
