/**
 * `/api/reports` — F5a. 검증 경계·비밀번호 인증·레이트리밋·EXIF 제거·최신순 커서 페이징·SSE 를 고정한다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LngLat, REPORT_COORDINATE_MAX_DISTANCE_M } from '@modu-valley/core';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { type Db, openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { createRepos, type Repos } from '../src/db/repos';
import { EventHub } from '../src/events/EventHub';
import { identityRedactor } from '../src/logging/redact';
import { ServerLogger } from '../src/logging/ServerLogger';

const SERVER_DIR = path.resolve(import.meta.dirname, '..');
const KNOWN_VALLEYS = new Set(['baegun']);

/**
 * `baegun` 의 가상 중심선(F5d) — 남북으로 곧게 뻗은 변 하나. 위도 1도 ≈ 111.2km 이므로
 * 0.01도 ≈ 1.11km — `distanceToPolyline` 과 같은 등장방형 근사로 2.9km/3.1km 경계를 만든다.
 */
const CENTERLINE: readonly LngLat[] = [LngLat.of(127.0, 37.0), LngLat.of(127.0, 37.01)];
const KNOWN_CENTERLINES = new Map<string, readonly LngLat[]>([['baegun', CENTERLINE]]);

/** 중심선의 중간 위도에서 동쪽으로 `meters` 만큼 떨어진 점 — 반경 검증용. */
function eastOfCenterline(meters: number): { lat: number; lng: number } {
  const midLat = 37.005;
  const r = 6371000;
  const degToRad = Math.PI / 180;
  const lngOffset = meters / (r * degToRad * Math.cos(midLat * degToRad));
  return { lat: midLat, lng: 127.0 + lngOffset };
}

let db: Db;
let repos: Repos;
let hub: EventHub;
let uploadsDir: string;
let app: ReturnType<typeof createApp>;
let t: number;

function build(env: Record<string, string> = {}): void {
  const config = loadConfig({
    serverDir: SERVER_DIR,
    env: { DB_PATH: ':memory:', UPLOADS_DIR: uploadsDir, ...env },
  });
  db = openDatabase({ path: ':memory:' });
  runMigrations(db, config.migrationsDir);
  repos = createRepos(db);
  hub = new EventHub({ heartbeatMs: 60_000 });
  t = Date.parse('2026-09-07T00:00:00.000Z');
  app = createApp({
    config,
    db,
    logger: new ServerLogger('t', { sink: () => {} }),
    redact: identityRedactor,
    startedAt: 0,
    repos,
    hub,
    now: () => t,
    knownValleyIds: KNOWN_VALLEYS,
    valleyCenterlines: KNOWN_CENTERLINES,
  });
}

function rebuild(env: Record<string, string> = {}): void {
  hub.closeAll();
  db.close();
  build(env);
}

beforeEach(() => {
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f5a-uploads-'));
  build();
});

afterEach(() => {
  hub.closeAll();
  db.close();
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

async function makeJpeg(width = 2000, withGps = false): Promise<Buffer> {
  let image = sharp({
    create: {
      width,
      height: Math.round(width / 2),
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  }).jpeg({ quality: 80 });
  if (withGps) {
    // sharp 의 .d.ts 는 IFD0~IFD3 만 타입에 담고 있다(런타임은 GPS 도 받는다) — 타입만 우회.
    const exifWithGps = {
      GPS: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '37/1 30/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '127/1 0/1 0/1',
      },
    } as unknown as Parameters<typeof image.withExif>[0];
    image = image.withExif(exifWithGps);
  }
  return image.toBuffer();
}

async function createReport(overrides: Record<string, unknown> = {}): Promise<Response> {
  return app.request('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      valleyId: 'baegun',
      type: 'trash',
      body: '쓰레기가 많아요',
      nickname: '산꾼',
      password: '1234',
      ...overrides,
    }),
  });
}

function multipartForm(
  fields: Record<string, string>,
  photos: readonly { readonly data: Buffer; readonly filename: string }[],
): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (const photo of photos) {
    form.append(
      'photos',
      new Blob([new Uint8Array(photo.data)], { type: 'image/jpeg' }),
      photo.filename,
    );
  }
  return form;
}

describe('POST /api/reports — 검증', () => {
  it('유형이 6종 밖이면 400', async () => {
    const res = await createReport({ type: 'nope' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_field');
  });

  it('본문이 비었거나 500자를 넘으면 400', async () => {
    expect((await createReport({ body: '' })).status).toBe(400);
    expect((await createReport({ body: 'a'.repeat(501) })).status).toBe(400);
    expect((await createReport({ body: 'a'.repeat(500) })).status).toBe(201);
  });

  it('닉네임이 20자를 넘으면 400', async () => {
    expect((await createReport({ nickname: '가'.repeat(21) })).status).toBe(400);
    expect((await createReport({ nickname: '가'.repeat(20) })).status).toBe(201);
  });

  it('비밀번호가 4자 미만이면 400', async () => {
    expect((await createReport({ password: '123' })).status).toBe(400);
    expect((await createReport({ password: '1234' })).status).toBe(201);
  });

  it('계곡 id 가 data/valleys 에 없으면 400', async () => {
    const res = await createReport({ valleyId: 'nope-valley' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_valley');
  });

  it('사진이 4장이면 400', async () => {
    const jpeg = await makeJpeg();
    const form = multipartForm(
      { valleyId: 'baegun', type: 'trash', body: '쓰레기', nickname: '산꾼', password: '1234' },
      [0, 1, 2, 3].map((i) => ({ data: jpeg, filename: `p${i}.jpg` })),
    );
    const res = await app.request('/api/reports', { method: 'POST', body: form });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_photo_count');
  });

  it('사진이 5MB 를 넘으면 400', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    const form = multipartForm(
      { valleyId: 'baegun', type: 'trash', body: '쓰레기', nickname: '산꾼', password: '1234' },
      [{ data: big, filename: 'big.jpg' }],
    );
    const res = await app.request('/api/reports', { method: 'POST', body: form });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_photo_size');
  });
});

describe('POST /api/reports — 좌표(F5d)', () => {
  it('좌표 없는 제보는 지금처럼 올라간다(회귀) — 응답에 lat/lng 가 없다', async () => {
    const res = await createReport();
    expect(res.status).toBe(201);
    const created = (await res.json()) as Record<string, unknown>;
    expect(created).not.toHaveProperty('lat');
    expect(created).not.toHaveProperty('lng');
  });

  it('한쪽만 오면 400', async () => {
    const onlyLat = await createReport({ lat: 37.005 });
    expect(onlyLat.status).toBe(400);
    expect(((await onlyLat.json()) as { error: string }).error).toBe('invalid_coordinate_pair');

    const onlyLng = await createReport({ lng: 127.0 });
    expect(onlyLng.status).toBe(400);
    expect(((await onlyLng.json()) as { error: string }).error).toBe('invalid_coordinate_pair');
  });

  it('한국 범위 밖이면 400', async () => {
    const res = await createReport({ lat: 48.8, lng: 2.3 }); // 파리
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_coordinate_range');
  });

  it('계곡 반경 3km 경계 — 2.9km 는 통과, 3.1km 는 거부한다', async () => {
    const inside = eastOfCenterline(2900);
    const okRes = await createReport({ lat: inside.lat, lng: inside.lng });
    expect(okRes.status).toBe(201);
    const created = (await okRes.json()) as { lat: number; lng: number };
    expect(created.lat).toBeCloseTo(inside.lat, 6);
    expect(created.lng).toBeCloseTo(inside.lng, 6);

    const outside = eastOfCenterline(3100);
    const blocked = await createReport({ lat: outside.lat, lng: outside.lng });
    expect(blocked.status).toBe(400);
    const body = (await blocked.json()) as { error: string; maxDistanceM: number };
    expect(body.error).toBe('invalid_coordinate_radius');
    expect(body.maxDistanceM).toBe(REPORT_COORDINATE_MAX_DISTANCE_M);
  });

  it('상세·목록 응답 DTO 에 좌표가 그대로 왕복한다', async () => {
    const point = eastOfCenterline(1000);
    const created = (await (await createReport({ lat: point.lat, lng: point.lng })).json()) as {
      id: string;
      lat: number;
      lng: number;
    };

    const detail = (await (await app.request(`/api/reports/${created.id}`)).json()) as {
      lat: number;
      lng: number;
    };
    expect(detail.lat).toBeCloseTo(point.lat, 6);
    expect(detail.lng).toBeCloseTo(point.lng, 6);

    const list = (await (await app.request('/api/reports?valleyId=baegun')).json()) as {
      reports: { id: string; lat: number; lng: number }[];
    };
    const listed = list.reports.find((r) => r.id === created.id);
    expect(listed?.lat).toBeCloseTo(point.lat, 6);
    expect(listed?.lng).toBeCloseTo(point.lng, 6);
  });
});

describe('POST /api/reports — 생성', () => {
  it('사진을 리사이즈·EXIF 제거해 저장하고 SSE report 채널로 알린다', async () => {
    const events: string[] = [];
    hub.subscribe(['report'], (m) => {
      if (m.event === 'report') events.push(m.data);
    });

    const gpsJpeg = await makeJpeg(2000, true);
    const originalMeta = await sharp(gpsJpeg).metadata();
    expect(originalMeta.exif).toBeDefined(); // 시험이 무의미하지 않도록 — 원본엔 EXIF 가 있다.

    const form = multipartForm(
      {
        valleyId: 'baegun',
        type: 'valley-info',
        body: '물이 아주 맑아요',
        nickname: '산꾼',
        password: '1234',
      },
      [
        { data: gpsJpeg, filename: 'a.jpg' },
        { data: gpsJpeg, filename: 'b.jpg' },
      ],
    );
    const res = await app.request('/api/reports', { method: 'POST', body: form });
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      id: string;
      photos: { url: string; width: number; height: number }[];
    };
    expect(created).not.toHaveProperty('passwordHash');
    expect(created.photos).toHaveLength(2);
    expect(created.photos[0]?.url).toMatch(/^\/uploads\/[a-zA-Z0-9-]+\.jpg$/);
    expect(created.photos[0]?.width).toBeLessThanOrEqual(1600);

    const filename = path.basename(created.photos[0]?.url ?? '');
    const saved = fs.readFileSync(path.join(uploadsDir, filename));
    const savedMeta = await sharp(saved).metadata();
    expect(savedMeta.exif).toBeUndefined();
    expect(Math.max(savedMeta.width ?? 0, savedMeta.height ?? 0)).toBeLessThanOrEqual(1600);

    // 정적 서빙.
    const served = await app.request(created.photos[0]?.url ?? '');
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/jpeg');

    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0] ?? '{}')).toMatchObject({
      channel: 'report',
      report: { nickname: '산꾼', type: 'valley-info' },
    });
  });
});

describe('GET /api/reports', () => {
  it('최신순, valleyId 필터, 커서 페이징', async () => {
    for (const body of ['첫번째', '두번째', '세번째']) {
      const res = await createReport({ body });
      expect(res.status).toBe(201);
      t += 1000;
    }
    const page1 = (await (await app.request('/api/reports?valleyId=baegun&limit=2')).json()) as {
      reports: { body: string }[];
      nextCursor: string | null;
    };
    expect(page1.reports.map((r) => r.body)).toEqual(['세번째', '두번째']);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = (await (
      await app.request(
        `/api/reports?valleyId=baegun&limit=2&cursor=${encodeURIComponent(page1.nextCursor ?? '')}`,
      )
    ).json()) as { reports: { body: string }[]; nextCursor: string | null };
    expect(page2.reports.map((r) => r.body)).toEqual(['첫번째']);
    expect(page2.nextCursor).toBeNull();
  });

  it('다른 계곡으로 필터하면 빈 목록', async () => {
    await createReport();
    const res = (await (await app.request('/api/reports?valleyId=other')).json()) as {
      reports: unknown[];
    };
    expect(res.reports).toEqual([]);
  });
});

describe('GET /api/reports/:id', () => {
  it('상세 조회, 없으면 404', async () => {
    const created = (await (await createReport()).json()) as { id: string };
    const res = await app.request(`/api/reports/${created.id}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe(created.id);
    expect((await app.request('/api/reports/nope')).status).toBe(404);
  });
});

describe('PATCH /api/reports/:id', () => {
  it('비밀번호가 틀리면 403, 맞으면 본문·유형을 바꾼다', async () => {
    const created = (await (await createReport()).json()) as { id: string };
    const wrong = await app.request(`/api/reports/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong', body: '고친 본문' }),
    });
    expect(wrong.status).toBe(403);

    const ok = await app.request(`/api/reports/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: '1234', body: '고친 본문', type: 'valley-info' }),
    });
    expect(ok.status).toBe(200);
    const updated = (await ok.json()) as { body: string; type: string };
    expect(updated.body).toBe('고친 본문');
    expect(updated.type).toBe('valley-info');
  });

  it('좌표(F5d) 를 새로 넣거나 지울 수 있다 — 반경 밖이면 거부한다', async () => {
    const created = (await (await createReport()).json()) as { id: string };
    const inside = eastOfCenterline(1000);

    const setRes = await app.request(`/api/reports/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: '1234', lat: inside.lat, lng: inside.lng }),
    });
    expect(setRes.status).toBe(200);
    const withCoord = (await setRes.json()) as { lat: number; lng: number };
    expect(withCoord.lat).toBeCloseTo(inside.lat, 6);
    expect(withCoord.lng).toBeCloseTo(inside.lng, 6);

    const outside = eastOfCenterline(3100);
    const rejected = await app.request(`/api/reports/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: '1234', lat: outside.lat, lng: outside.lng }),
    });
    expect(rejected.status).toBe(400);
    expect(((await rejected.json()) as { error: string }).error).toBe('invalid_coordinate_radius');

    const cleared = await app.request(`/api/reports/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: '1234', lat: null, lng: null }),
    });
    expect(cleared.status).toBe(200);
    const clearedBody = (await cleared.json()) as Record<string, unknown>;
    expect(clearedBody).not.toHaveProperty('lat');
    expect(clearedBody).not.toHaveProperty('lng');
  });
});

describe('DELETE /api/reports/:id', () => {
  it('비밀번호가 틀리면 403 이고 지워지지 않는다', async () => {
    const created = (await (await createReport()).json()) as { id: string };
    const res = await app.request(`/api/reports/${created.id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    expect(res.status).toBe(403);
    expect((await app.request(`/api/reports/${created.id}`)).status).toBe(200);
  });

  it('비밀번호가 맞으면 지우고 사진 파일도 지운다', async () => {
    const jpeg = await makeJpeg();
    const form = multipartForm(
      { valleyId: 'baegun', type: 'trash', body: '지울 제보', nickname: '산꾼', password: '1234' },
      [{ data: jpeg, filename: 'a.jpg' }],
    );
    const created = (await (
      await app.request('/api/reports', { method: 'POST', body: form })
    ).json()) as { id: string; photos: { url: string }[] };
    const filename = path.basename(created.photos[0]?.url ?? '');
    expect(fs.existsSync(path.join(uploadsDir, filename))).toBe(true);

    const res = await app.request(`/api/reports/${created.id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: '1234' }),
    });
    expect(res.status).toBe(200);
    expect((await app.request(`/api/reports/${created.id}`)).status).toBe(404);
    expect(fs.existsSync(path.join(uploadsDir, filename))).toBe(false);
  });
});

describe('POST /api/reports/:id/flag', () => {
  it('접수만 기록하고 제보는 그대로 보인다(자동 숨김 없음, 결정 (h))', async () => {
    const created = (await (await createReport()).json()) as { id: string };
    const res = await app.request(`/api/reports/${created.id}/flag`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: '광고성' }),
    });
    expect(res.status).toBe(201);
    expect((await app.request(`/api/reports/${created.id}`)).status).toBe(200);
    const row = db.prepare('SELECT reason FROM report_flags WHERE report_id = ?').get(created.id);
    expect(row).toMatchObject({ reason: '광고성' });
  });

  it('본문 없이도 접수된다', async () => {
    const created = (await (await createReport()).json()) as { id: string };
    const res = await app.request(`/api/reports/${created.id}/flag`, { method: 'POST' });
    expect(res.status).toBe(201);
  });
});

describe('레이트리밋(F5a 결정 (h))', () => {
  it('IP 당 10분 한도를 넘으면 429', async () => {
    rebuild({ REPORTS_RATE_LIMIT_PER_10MIN: '2', REPORTS_RATE_LIMIT_PER_DAY: '100' });
    expect((await createReport()).status).toBe(201);
    expect((await createReport()).status).toBe(201);
    const blocked = await createReport();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toMatch(/^\d+$/);
  });

  it('IP 당 하루 한도를 넘으면 429(10분 창이 남아 있어도)', async () => {
    rebuild({ REPORTS_RATE_LIMIT_PER_10MIN: '100', REPORTS_RATE_LIMIT_PER_DAY: '2' });
    expect((await createReport()).status).toBe(201);
    expect((await createReport()).status).toBe(201);
    const blocked = await createReport();
    expect(blocked.status).toBe(429);
  });
});
