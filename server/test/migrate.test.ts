import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, pingDatabase } from '../src/db/Database';
import { currentSchemaVersion, listMigrations, runMigrations } from '../src/db/migrate';

const REAL_MIGRATIONS = path.resolve(import.meta.dirname, '../migrations');

const tmpDirs: string[] = [];
function tmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-migrate-'));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('runMigrations', () => {
  it('저장소의 실제 마이그레이션을 빈 DB 에 적용하고 두 번째 실행은 아무것도 하지 않는다', () => {
    const db = openDatabase({ path: ':memory:' });
    expect(pingDatabase(db)).toBe(true);
    expect(currentSchemaVersion(db)).toBe(0);
    const first = runMigrations(db, REAL_MIGRATIONS);
    expect(first.applied.length).toBeGreaterThanOrEqual(1);
    expect(first.version).toBe(listMigrations(REAL_MIGRATIONS).at(-1)?.version);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['stations', 'fetch_log', 'schema_migrations']));
    const second = runMigrations(db, REAL_MIGRATIONS);
    expect(second.applied).toEqual([]);
    expect(second.version).toBe(first.version);
    db.close();
  });

  it('번호 순으로, 현재 버전보다 큰 것만 적용한다', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '0002_two.sql'), 'CREATE TABLE two (x INTEGER);');
    fs.writeFileSync(path.join(dir, '0001_one.sql'), 'CREATE TABLE one (x INTEGER);');
    const db = openDatabase({ path: ':memory:' });
    expect(runMigrations(db, dir).applied.map((m) => m.name)).toEqual(['one', 'two']);
    fs.writeFileSync(path.join(dir, '0003_three.sql'), 'ALTER TABLE one ADD COLUMN y TEXT;');
    expect(runMigrations(db, dir).applied.map((m) => m.version)).toEqual([3]);
    expect(currentSchemaVersion(db)).toBe(3);
    db.close();
  });

  it('실패한 마이그레이션은 기록되지 않고 다음 실행에서 다시 시도된다', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '0001_ok.sql'), 'CREATE TABLE ok (x INTEGER);');
    fs.writeFileSync(
      path.join(dir, '0002_bad.sql'),
      'CREATE TABLE ok2 (x INTEGER); SELECT * FROM nope;',
    );
    const db = openDatabase({ path: ':memory:' });
    expect(() => runMigrations(db, dir)).toThrow();
    expect(currentSchemaVersion(db)).toBe(1);
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(tables).not.toContain('ok2');
    db.close();
  });

  it('파일 이름 형식이 틀리거나 번호가 겹치면 던진다', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'init.sql'), '');
    expect(() => listMigrations(dir)).toThrow(/NNNN_name/);
    const dir2 = tmpDir();
    fs.writeFileSync(path.join(dir2, '0001_a.sql'), '');
    fs.writeFileSync(path.join(dir2, '0001_b.sql'), '');
    expect(() => listMigrations(dir2)).toThrow(/겹친다/);
  });

  it('파일 DB 를 만들면 디렉터리도 만든다', () => {
    const file = path.join(tmpDir(), 'nested', 'dir', 'valley.db');
    const db = openDatabase({ path: file });
    runMigrations(db, REAL_MIGRATIONS);
    db.close();
    expect(fs.existsSync(file)).toBe(true);
  });
});
