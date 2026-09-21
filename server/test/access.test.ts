/**
 * `/api/access` 배선 — `data/access/*.json` 을 모아 계곡별로 오늘 날짜 판정. 판정 규칙은 core
 * `access.test.ts` 가 고정한다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { accessRoutes, loadAccessControls } from '../src/http/routes/access';

let dir: string;
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const control = (valleyId: string, kind: string, from: string, to: string) => ({
  valleyId,
  kind,
  from,
  to,
  basis: 'parcel',
  agency: '북부지방산림청',
  sourceUrl: 'https://example.go.kr/notice',
  note: 'test',
});

describe('GET /api/access', () => {
  it('파일 여럿의 기록을 모아 계곡마다 판정하고, 기록 없는 계곡은 unknown', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'access-'));
    fs.writeFileSync(
      path.join(dir, 'a.json'),
      JSON.stringify({ controls: [control('yongchu', 'closed-area', '2026-11-01', '2026-12-15')] }),
    );
    fs.writeFileSync(
      path.join(dir, 'b.json'),
      JSON.stringify({ controls: [control('yongchu', 'trail-open', '2026-11-01', '2026-12-15')] }),
    );
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ not json');
    expect(loadAccessControls(dir)).toHaveLength(2);

    const app = accessRoutes({
      accessDir: dir,
      valleyIds: new Set(['yongchu', 'myeongji']),
      now: () => Date.parse('2026-11-10T03:00:00.000Z'),
    });
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      today: string;
      sources: number;
      access: { valleyId: string; status: string; control: { kind: string } | null }[];
    };
    expect(body.today).toBe('2026-11-10');
    expect(body.sources).toBe(2);
    expect(body.access).toEqual([
      { valleyId: 'myeongji', status: 'unknown', control: null, upcoming: null },
      expect.objectContaining({ valleyId: 'yongchu', status: 'trail-open' }),
    ]);
    expect(body.access[1]?.control?.kind).toBe('trail-open');
  });

  it('디렉터리가 없으면 전부 unknown', async () => {
    const app = accessRoutes({ accessDir: '/nonexistent/access', valleyIds: new Set(['v']) });
    const body = (await (await app.request('/')).json()) as { access: { status: string }[] };
    expect(body.access[0]?.status).toBe('unknown');
  });
});
