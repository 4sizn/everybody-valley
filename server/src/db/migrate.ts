/**
 * 번호 붙인 SQL 파일 마이그레이션. `migrations/NNNN_name.sql` 을 번호 순으로, 아직 적용되지 않은 것만
 * 각각 트랜잭션 안에서 실행하고 `schema_migrations` 에 기록한다. 되돌리기는 없다(앞으로만).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from '@modu-valley/core';
import type { Db } from './Database';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly file: string;
}

export interface MigrateResult {
  readonly applied: readonly Migration[];
  readonly version: number;
}

const FILE_PATTERN = /^(\d{4})_([a-z0-9_-]+)\.sql$/;

/** 디렉터리의 마이그레이션 목록. 번호가 겹치거나 형식이 틀리면 던진다 — 스키마는 추측으로 고치지 않는다. */
export function listMigrations(dir: string): readonly Migration[] {
  if (!fs.existsSync(dir)) throw new Error(`마이그레이션 디렉터리가 없다: ${dir}`);
  const out: Migration[] = [];
  for (const entry of fs.readdirSync(dir).sort()) {
    if (!entry.endsWith('.sql')) continue;
    const m = FILE_PATTERN.exec(entry);
    if (!m) throw new Error(`마이그레이션 파일 이름 형식이 아니다(NNNN_name.sql): ${entry}`);
    out.push({ version: Number(m[1]), name: m[2] ?? '', file: path.join(dir, entry) });
  }
  const versions = new Set(out.map((x) => x.version));
  if (versions.size !== out.length) throw new Error(`마이그레이션 번호가 겹친다: ${dir}`);
  return out;
}

export function currentSchemaVersion(db: Db): number {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
  );
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as
    | { v: number | null }
    | undefined;
  return row?.v ?? 0;
}

export function runMigrations(db: Db, dir: string, logger?: Logger): MigrateResult {
  const current = currentSchemaVersion(db);
  const pending = listMigrations(dir).filter((m) => m.version > current);
  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );
  for (const m of pending) {
    const sql = fs.readFileSync(m.file, 'utf8');
    db.transaction(() => {
      db.exec(sql);
      insert.run(m.version, m.name, new Date().toISOString());
    })();
    logger?.info('migration applied', { version: m.version, name: m.name });
  }
  return { applied: pending, version: pending.at(-1)?.version ?? current };
}
