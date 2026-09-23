-- 0008 — 기상청 계절관측(단풍) 자료. API허브 `sfc_ssn.php`(관측)와 `sfc_ssn_norm.php`(평년)를 그대로 담는다.
-- 단풍 단계는 이 표만으로 판정한다(자체 기온 모델 없음 — 국내 오픈 API 기준). ssn_id 302 단풍나무 · 501 유명산 단풍,
-- ssn_md 301/501 시작 · 302/503 절정 · 303 끝 · 304 낙엽 시작 · 305 낙엽 끝. tm 은 KST 'YYYY-MM-DD'.
CREATE TABLE season_obs (
  stn         TEXT    NOT NULL,
  tm          TEXT    NOT NULL,
  ssn_id      INTEGER NOT NULL,
  ssn_md      INTEGER NOT NULL,
  fetched_at  TEXT    NOT NULL,
  PRIMARY KEY (stn, tm, ssn_id, ssn_md)
);

CREATE INDEX season_obs_year ON season_obs (ssn_id, tm);

-- 평년값(1991~2020 등 기준기간). mmdd 는 'MM-DD'.
CREATE TABLE season_norm (
  stn         TEXT    NOT NULL,
  ssn_id      INTEGER NOT NULL,
  ssn_md      INTEGER NOT NULL,
  mmdd        TEXT    NOT NULL,
  fetched_at  TEXT    NOT NULL,
  PRIMARY KEY (stn, ssn_id, ssn_md)
);
