CREATE TABLE discovery_stories (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE discovery_interest (
  day TEXT NOT NULL,
  valley_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY(day, valley_id, visitor_hash)
);
CREATE TABLE discovery_secret (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL
);
