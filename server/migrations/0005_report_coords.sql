-- 0005 — 제보 좌표 (F5d). 둘 다 nullable — 선택 사항(해석 1). 함께 있거나 함께 없다 —
-- 그 짝 여부·한국 범위·계곡 반경 3km 검증은 라우트가 core `ReportCoordinate` 로 한다.
ALTER TABLE reports ADD COLUMN lat REAL;
ALTER TABLE reports ADD COLUMN lng REAL;
