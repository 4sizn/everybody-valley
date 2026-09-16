/**
 * `/api/admin/*` — OPS1. 인증(토큰 없음/틀림/미설정)·숨김·복구·신고 목록·레이트리밋·감사 로그를 고정한다.
 */
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { createRepos, type Repos } from '../src/db/repos';
import { EventHub } from '../src/events/EventHub';
import { FixedWindowRateLimiter } from '../src/http/rateLimit';
import { identityRedactor } from '../src/logging/redact';
import { ServerLogger } from '../src/logging/ServerLogger';

const SERVER_DIR = path.resolve(import.meta.dirname, '..');
const KNOWN_VALLEYS = new Set(['baegun']);
const ADMIN_TOKEN = 'test-admin-token-000111';

let db: Db;
let repos: Repos;
let hub: EventHub;
let app: ReturnType<typeof createApp>;
let lines: string[];
let t: number;

function build(
  env: Record<string, string> = {},
  extra: Partial<Parameters<typeof createApp>[0]> = {},
): void {
  const config = loadConfig({
    serverDir: SERVER_DIR,
    env: { DB_PATH: ':memory:', ADMIN_TOKEN, ...env },
  });
  db = openDatabase({ path: ':memory:' });
  runMigrations(db, config.migrationsDir);
  repos = createRepos(db);
  hub = new EventHub({ heartbeatMs: 60_000 });
  lines = [];
  t = Date.parse('2026-09-08T00:00:00.000Z');
  app = createApp({
    config,
    db,
    logger: new ServerLogger('t', { sink: (_level, line) => lines.push(line) }),
    redact: identityRedactor,
    startedAt: 0,
    repos,
    hub,
    now: () => t,
    knownValleyIds: KNOWN_VALLEYS,
    valleyCenterlines: new Map(),
    ...extra,
  });
}

function rebuild(
  env: Record<string, string> = {},
  extra: Partial<Parameters<typeof createApp>[0]> = {},
): void {
  hub.closeAll();
  db.close();
  build(env, extra);
}

beforeEach(() => build());
afterEach(() => {
  hub.closeAll();
  db.close();
});

async function createReport(overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
  const res = await app.request('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      valleyId: 'baegun',
      type: 'trash',
      body: '민감할 수 있는 본문 내용',
      nickname: '아무개',
      password: '1234',
      ...overrides,
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
}

function adminHeaders(token = ADMIN_TOKEN): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

describe('관리자 인증', () => {
  it('토큰 없이 부르면 401', async () => {
    const res = await app.request('/api/admin/reports');
    expect(res.status).toBe(401);
  });

  it('틀린 토큰이면 401', async () => {
    const res = await app.request('/api/admin/reports', {
      headers: adminHeaders('wrong-token'),
    });
    expect(res.status).toBe(401);
  });

  it('길이가 다른 토큰도 401(상수시간 비교 경로를 그대로 탄다)', async () => {
    const res = await app.request('/api/admin/reports', { headers: adminHeaders('short') });
    expect(res.status).toBe(401);
  });

  it('ADMIN_TOKEN 이 설정되지 않은 서버는 관리자 API 가 404(존재하지 않는 것처럼)', async () => {
    build({ ADMIN_TOKEN: '' });
    const noAuth = await app.request('/api/admin/reports');
    expect(noAuth.status).toBe(404);
    const withAuth = await app.request('/api/admin/reports', { headers: adminHeaders() });
    expect(withAuth.status).toBe(404);
    const patch = await app.request('/api/admin/reports/nope/hidden', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ hidden: true }),
    });
    expect(patch.status).toBe(404);
    const flags = await app.request('/api/admin/flags', { headers: adminHeaders() });
    expect(flags.status).toBe(404);
  });

  it('올바른 토큰이면 200', async () => {
    const res = await app.request('/api/admin/reports', { headers: adminHeaders() });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/admin/reports/:id/hidden', () => {
  it('숨기면 일반 목록·상세에서 빠지고, 복구하면 다시 보인다', async () => {
    const { id } = await createReport();

    // 숨기기 전 — 일반 조회에 있다.
    expect((await app.request(`/api/reports/${id}`)).status).toBe(200);

    const hideRes = await app.request(`/api/admin/reports/${id}/hidden`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ hidden: true }),
    });
    expect(hideRes.status).toBe(200);
    const hidden = (await hideRes.json()) as { hidden: boolean };
    expect(hidden.hidden).toBe(true);

    // 일반 상세 — 404.
    expect((await app.request(`/api/reports/${id}`)).status).toBe(404);
    // 일반 목록 — 없다.
    const list = (await (await app.request('/api/reports?valleyId=baegun')).json()) as {
      reports: { id: string }[];
    };
    expect(list.reports.some((r) => r.id === id)).toBe(false);
    // 관리자 목록(includeHidden) — 있고 hidden=true.
    const adminList = (await (
      await app.request('/api/admin/reports?includeHidden=1', { headers: adminHeaders() })
    ).json()) as { reports: { id: string; hidden: boolean }[] };
    const found = adminList.reports.find((r) => r.id === id);
    expect(found?.hidden).toBe(true);

    // 관리자 목록(includeHidden 없음) — 일반과 같이 제외.
    const adminListDefault = (await (
      await app.request('/api/admin/reports', { headers: adminHeaders() })
    ).json()) as { reports: { id: string }[] };
    expect(adminListDefault.reports.some((r) => r.id === id)).toBe(false);

    // 복구.
    const restoreRes = await app.request(`/api/admin/reports/${id}/hidden`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ hidden: false }),
    });
    expect(restoreRes.status).toBe(200);
    expect((await app.request(`/api/reports/${id}`)).status).toBe(200);
  });

  it('없는 id 는 404', async () => {
    const res = await app.request('/api/admin/reports/nope/hidden', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ hidden: true }),
    });
    expect(res.status).toBe(404);
  });

  it('hidden 이 불리언이 아니면 400', async () => {
    const { id } = await createReport();
    const res = await app.request(`/api/admin/reports/${id}/hidden`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ hidden: 'yes' }),
    });
    expect(res.status).toBe(400);
  });

  it('감사 로그(관리자 동작 전용 줄)에 제보 id·hidden 값만 남고 토큰·본문·닉네임·IP 는 없다', async () => {
    const { id } = await createReport({
      body: '이 문장은 로그에 나오면 안 된다',
      nickname: '비밀닉',
    });
    lines = [];
    await app.request(`/api/admin/reports/${id}/hidden`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ hidden: true }),
    });
    // 요청 접근 로그(`http.requestLog`, 모든 라우트 공통)는 IP 를 남기는 기존 인프라라 대상이
    // 아니다 — OPS1 이 새로 남기는 "관리자: 제보 숨김" 감사 로그 줄만 검사한다.
    const auditLine = lines.find((l) => l.includes('관리자: 제보 숨김'));
    expect(auditLine).toBeDefined();
    expect(auditLine).toContain(id);
    expect(auditLine).not.toContain(ADMIN_TOKEN);
    expect(auditLine).not.toContain('이 문장은 로그에 나오면 안 된다');
    expect(auditLine).not.toContain('비밀닉');
    expect(auditLine).not.toContain('203.0.113.9');
  });
});

describe('GET /api/admin/flags', () => {
  it('신고 접수를 제보별로 묶어 개수·최근 시각을 준다', async () => {
    const a = await createReport({ body: '광고성 제보' });
    const b = await createReport({ body: '다른 제보' });

    await app.request(`/api/reports/${a.id}/flag`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: '광고' }),
    });
    t += 1000;
    await app.request(`/api/reports/${a.id}/flag`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: '욕설' }),
    });
    t += 1000;
    await app.request(`/api/reports/${b.id}/flag`, { method: 'POST' });

    const res = await app.request('/api/admin/flags', { headers: adminHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      flags: { reportId: string; count: number; hidden: boolean }[];
    };
    expect(body.flags).toHaveLength(2);
    const aFlag = body.flags.find((f) => f.reportId === a.id);
    const bFlag = body.flags.find((f) => f.reportId === b.id);
    expect(aFlag?.count).toBe(2);
    expect(bFlag?.count).toBe(1);
    expect(aFlag?.hidden).toBe(false);
    // 최근 신고 순 — b(가장 최근 1건)가 a 보다 먼저는 아니다(a 의 마지막 신고가 더 최근).
    expect(body.flags[0]?.reportId).toBe(b.id);
  });

  it('신고가 없으면 빈 배열', async () => {
    const res = await app.request('/api/admin/flags', { headers: adminHeaders() });
    expect(await res.json()).toEqual({ flags: [] });
  });
});

describe('레이트리밋(토큰 추측 방어)', () => {
  it('관리자 전용 한도를 넘으면 429', async () => {
    rebuild({}, { adminRateLimiter: new FixedWindowRateLimiter({ limit: 2, now: () => t }) });
    const hit = () => app.request('/api/admin/reports', { headers: adminHeaders() });
    expect((await hit()).status).toBe(200);
    expect((await hit()).status).toBe(200);
    const blocked = await hit();
    expect(blocked.status).toBe(429);
  });

  it('틀린 토큰 반복 시도도 같은 한도에 걸린다(추측 방어)', async () => {
    rebuild({}, { adminRateLimiter: new FixedWindowRateLimiter({ limit: 2, now: () => t }) });
    const guess = () => app.request('/api/admin/reports', { headers: adminHeaders('guess') });
    expect((await guess()).status).toBe(401);
    expect((await guess()).status).toBe(401);
    expect((await guess()).status).toBe(429);
  });
});
