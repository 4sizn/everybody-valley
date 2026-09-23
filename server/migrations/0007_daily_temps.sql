-- 0007 — 관측소별 일 최저·최고기온. **미사용(2026-09-23)**: 단풍 판정이 기상청 계절관측 API(0008)로 바뀌어 이 표를 채우는 코드가 없다.
-- 마이그레이션은 되돌리지 않으므로 표는 남긴다. 원래 뜻: AWS 매분 폴러가 매 틱 접는다(running min/max).
-- day_kst 는 KST 날짜 'YYYY-MM-DD'. observations(7일 보존)와 달리 한 시즌(120일) 남긴다.
CREATE TABLE daily_temps (
  kind        TEXT NOT NULL,
  code        TEXT NOT NULL,
  day_kst     TEXT NOT NULL,
  tmin_c      REAL NOT NULL,
  tmax_c      REAL NOT NULL,
  samples     INTEGER NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (kind, code, day_kst)
);

CREATE INDEX daily_temps_day ON daily_temps (day_kst);
