-- 0004 — 제보(F5a). 계정 없음(v2) — 닉네임 + 비밀번호 해시(argon2id 또는 bcrypt)로 그 제보만 인증한다.
-- 남용 방지는 레이트리밋만(IP 기준) — 자동 만료·신고 누적 자동 숨김은 만들지 않는다(결정 (h)).

CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  valley_id     TEXT NOT NULL,
  segment_id    TEXT,
  type          TEXT NOT NULL,
  body          TEXT NOT NULL,
  nickname      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  ip            TEXT NOT NULL,
  hidden        INTEGER NOT NULL DEFAULT 0
);

-- 최신순 목록(계곡별·전체), 커서 페이징은 (created_at, id) 튜플로.
CREATE INDEX reports_valley_created ON reports (valley_id, created_at DESC, id DESC);
CREATE INDEX reports_created ON reports (created_at DESC, id DESC);

-- 사진 최대 3장. 서버가 리사이즈(장변 1600)·EXIF 제거한 결과만 있다 — 원본은 보관하지 않는다.
-- filename 은 `server/data/uploads/` 안의 실제 파일(`<id>.jpg`). photo_order 는 표시 순서(0부터).
CREATE TABLE report_photos (
  id          TEXT PRIMARY KEY,
  report_id   TEXT NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  bytes       INTEGER NOT NULL,
  photo_order INTEGER NOT NULL
);

CREATE INDEX report_photos_report ON report_photos (report_id, photo_order);

-- `신고하기` 접수 기록만(자동 누적 처리 없음, 결정 (h)).
CREATE TABLE report_flags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  TEXT NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TEXT NOT NULL,
  ip         TEXT NOT NULL
);

CREATE INDEX report_flags_report ON report_flags (report_id);
