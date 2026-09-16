import path from 'node:path';
import type { DiscoveryFeed, DiscoveryStory } from '@modu-valley/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { identityRedactor } from '../src/logging/redact';
import { ServerLogger } from '../src/logging/ServerLogger';

let db: Db;
let app: ReturnType<typeof createApp>;
let now: number;
const headers = { authorization: 'Bearer test-content-admin', 'content-type': 'application/json' };
const sample: DiscoveryStory = {
  id: 'story-1',
  kind: 'blog',
  valleyId: 'wonhyo',
  title: '원효계곡 방문 이야기',
  description: '테스트 콘텐츠',
  imageUrl: 'https://images.example.com/valley.jpg',
  imageCredit: '테스트 작성자',
  url: 'https://blog.example.com/visit',
  author: '작성자',
  publishedOn: '2026-09-16',
  startsOn: '2026-09-17',
  endsOn: '2026-09-23',
  sponsored: false,
  enabled: true,
};
beforeEach(() => {
  now = Date.parse('2026-09-16T15:00:00Z');
  const config = loadConfig({
    serverDir: path.resolve(import.meta.dirname, '..'),
    env: {
      DB_PATH: ':memory:',
      ADMIN_TOKEN: 'test-content-admin',
      RATE_LIMIT_PER_MIN: '1000',
      ADMIN_RATE_LIMIT_PER_MIN: '1000',
      TRUST_PROXY: 'true',
    },
  });
  db = openDatabase({ path: ':memory:' });
  runMigrations(db, config.migrationsDir);
  app = createApp({
    config,
    db,
    now: () => now,
    startedAt: 0,
    knownValleyIds: new Set(['wonhyo', 'eobi']),
    valleyCenterlines: new Map(),
    logger: new ServerLogger('test', { sink: () => {} }),
    redact: identityRedactor,
  });
});
afterEach(() => db.close());
const save = (patch: Partial<DiscoveryStory> = {}) =>
  app.request('/api/admin/discovery', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...sample, ...patch }),
  });
const feed = async () => (await (await app.request('/api/discovery')).json()) as DiscoveryFeed;
const select = (v = 'wonhyo', ip = '203.0.113.1') =>
  app.request(`/api/discovery/interest/${v}`, {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
describe('운영 콘텐츠', () => {
  it('읽기/쓰기/삭제 모두 기존 관리자 인증을 요구한다', async () => {
    for (const method of ['GET', 'POST', 'DELETE'])
      expect(
        (
          await app.request(`/api/admin/discovery${method === 'DELETE' ? '/story-1' : ''}`, {
            method,
          })
        ).status,
      ).toBe(401);
    expect((await feed()).stories).toEqual([]);
  });
  it('한국 시간 게시 기간과 공개 상태를 적용하고 만료한 광고는 노출하지 않는다', async () => {
    expect((await save()).status).toBe(201);
    expect((await feed()).stories).toHaveLength(1);
    await save({ id: 'draft', enabled: false });
    await save({ id: 'scheduled', startsOn: '2026-09-18' });
    await save({ id: 'expired', startsOn: '2026-09-10', endsOn: '2026-09-16', sponsored: true });
    expect((await feed()).stories.map((s) => s.id)).toEqual(['story-1']);
    now = Date.parse('2026-09-23T15:00:00Z');
    expect((await feed()).stories).toEqual([]);
  });
  it('수정과 삭제가 공개 피드에 반영된다', async () => {
    await save();
    expect((await save({ title: '수정한 안내' })).status).toBe(200);
    expect((await feed()).stories[0]?.title).toBe('수정한 안내');
    expect(
      (await app.request('/api/admin/discovery/story-1', { method: 'DELETE', headers })).status,
    ).toBe(204);
    expect((await feed()).stories).toEqual([]);
  });
  it('스크립트·비공개 URL, 잘못된 계곡/날짜/광고 목적지를 거절한다', async () => {
    for (const patch of [
      { url: 'javascript:alert(1)' },
      { imageUrl: 'https://127.0.0.1/image.jpg' },
      { imageUrl: 'data:image/png;base64,abc' },
      { url: 'https://user:pass@example.com/x' },
      { valleyId: 'missing' },
      { startsOn: '2026-02-30' },
      { endsOn: '2026-09-01' },
      { kind: 'banner' as const, sponsored: true, url: '' },
      { imageCredit: '' },
    ])
      expect((await save(patch)).status).toBe(400);
  });
});
describe('최근7일 관심 집계', () => {
  it('같은 연결의 같은 계곡/날짜는 한 번만 세고 원문 IP는 저장하지 않는다', async () => {
    expect((await select()).status).toBe(204);
    await select();
    await select('wonhyo', '203.0.113.2');
    expect((await feed()).ranking).toEqual([{ valleyId: 'wonhyo', count: 2, rank: 1 }]);
    const rows = db.prepare('SELECT * FROM discovery_interest').all();
    expect(JSON.stringify(rows)).not.toContain('203.0.113');
  });
  it('한국 날짜 경계에서 갱신하고 7일 지난 식별 해시를 제거한다', async () => {
    await select();
    now += 86400_000;
    await select();
    expect((await feed()).ranking[0]?.count).toBe(2);
    now += 6 * 86400_000;
    expect((await feed()).ranking[0]?.count).toBe(1);
    expect(
      (db.prepare('SELECT COUNT(*) AS n FROM discovery_interest').get() as { n: number }).n,
    ).toBe(1);
  });
  it('동률은 공동 순위이며 유효하지 않은 계곡은 집계하지 않는다', async () => {
    await select('wonhyo');
    await select('eobi');
    expect((await feed()).ranking.map((r) => r.rank)).toEqual([1, 1]);
    expect((await select('missing')).status).toBe(400);
  });
});
