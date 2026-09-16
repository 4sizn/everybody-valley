/**
 * SQLite 연결(better-sqlite3). 단일 파일, 단일 인스턴스(결정 (b)·(f)).
 *
 * WAL + NORMAL 동기화 — 폴러가 쓰는 동안 읽기 요청이 막히지 않는다. `busy_timeout` 은 같은 프로세스 안
 * 잡·요청이 겹칠 때의 보험이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

export interface OpenDatabaseOptions {
  /** `':memory:'` 는 테스트용. */
  readonly path: string;
}

export function openDatabase({ path: file }: OpenDatabaseOptions): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

/** 헬스체크용 — 연결이 살아 있고 쿼리가 도는지. */
export function pingDatabase(db: Db): boolean {
  try {
    const row = db.prepare('SELECT 1 AS one').get() as { one: number } | undefined;
    return row?.one === 1;
  } catch {
    return false;
  }
}
