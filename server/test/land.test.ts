import { LngLat } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { landRoutes } from '../src/http/routes/land';

const lines = new Map([['gingorang', [LngLat.of(127.096, 37.563), LngLat.of(127.096, 37.571)]]]);
describe('토지소유 API', () => {
  it('미등록 계곡과 키 누락을 구분한다', async () => {
    const app = landRoutes(undefined, lines);
    expect((await app.request('/missing')).status).toBe(404);
    expect((await app.request('/gingorang')).status).toBe(503);
  });
  it('실시간 조회 응답에는 소유구분·경계만 포함하고 저장을 금지한다', async () => {
    const app = landRoutes({ key: 'test', domain: 'localhost' }, lines, async () =>
      Response.json({
        features: [
          {
            properties: { posesn_se_code: '01', pnu: 'not-exported' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [127, 37],
                  [127.01, 37],
                  [127, 37.01],
                  [127, 37],
                ],
              ],
            },
          },
        ],
      }),
    );
    const response = await app.request('/gingorang');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as { parcels: { ownership: string }[]; partial: boolean };
    expect(body.parcels).toHaveLength(1);
    expect(body.parcels[0]?.ownership).toBe('individual');
    expect(JSON.stringify(body)).not.toContain('not-exported');
    expect(body.partial).toBe(false);
  });
  it('상류 실패를 빈 사유지 목록으로 숨기지 않는다', async () => {
    const app = landRoutes(
      { key: 'test', domain: 'localhost' },
      lines,
      async () => new Response('unavailable', { status: 503 }),
    );
    expect((await app.request('/gingorang')).status).toBe(502);
  });
});
