import { describe, expect, it } from 'vitest';
import {
  type ApiEvent,
  type ApiReportDraft,
  type EventSourceLike,
  FetchApiClient,
  type FetchLike,
  type FetchRequestInit,
  LngLat,
  parseSseEvent,
  toStationCode,
} from '../src/index';

function fakeFetch(routes: Record<string, { status?: number; body: string }>): {
  fetch: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([needle]) => url.includes(needle));
    const status = hit?.[1].status ?? 404;
    return { ok: status >= 200 && status < 300, status, text: async () => hit?.[1].body ?? '' };
  };
  return { fetch, calls };
}

/** `#request` 에 실제로 실린 `init`(method·headers·body)까지 잡아 두는 fetch — 제보 전송 페이로드 검사용. */
type CapturedRequest = { readonly url: string; readonly init: FetchRequestInit };

function capturingFetch(
  status: number,
  body = '{}',
): {
  fetch: FetchLike;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  const fetch: FetchLike = async (url, init) => {
    requests.push({ url, init: init ?? {} });
    return { ok: status >= 200 && status < 300, status, text: async () => body };
  };
  return { fetch, requests };
}

/**
 * multipart/form-data 본문을 필드 이름 → 원본 바이트로 되돌린다 — 테스트 전용 파서.
 * `latin1` 은 바이트 하나당 문자 하나(전단사)라 경계 문자열 분리에 안전하고, 되돌릴 때
 * 같은 인코딩으로 다시 버퍼화하면 원본 바이트가 손실 없이 복원된다(텍스트 필드는
 * 호출부가 `.toString('utf8')` 로 마저 읽는다).
 */
function parseMultipart(contentType: string, body: Uint8Array): Record<string, Buffer> {
  const boundaryMatch = /boundary=(.+)$/.exec(contentType);
  if (!boundaryMatch?.[1]) throw new Error('boundary 없음');
  const boundary = boundaryMatch[1];
  const text = Buffer.from(body).toString('latin1');
  const marker = `--${boundary}`;
  const fields: Record<string, Buffer> = {};
  for (const rawPart of text.split(marker).slice(1, -1)) {
    const part = rawPart.startsWith('\r\n') ? rawPart.slice(2) : rawPart;
    const headerEnd = part.indexOf('\r\n\r\n');
    const header = part.slice(0, headerEnd);
    const rest = part.slice(headerEnd + 4, part.length - 2); // 끝의 \r\n 제거
    const nameMatch = /name="([^"]+)"/.exec(header);
    const name = nameMatch?.[1] ?? '';
    fields[name] = Buffer.from(rest, 'latin1');
  }
  return fields;
}

describe('FetchApiClient', () => {
  it('REST 네 개를 서버 경로·쿼리로 옮기고 JSON 을 Result 로 돌려준다', async () => {
    const { fetch, calls } = fakeFetch({
      '/healthz': {
        status: 200,
        body: '{"ok":true,"now":"t","lastPoll":{"hydro":null,"aws":"a"}}',
      },
      '/api/hydro/stations': { status: 200, body: '{"count":1,"stations":[{"code":"1"}]}' },
      '/api/hydro/latest': { status: 200, body: '{"observedAt":"o","observations":[]}' },
      '/api/aws/latest': {
        status: 200,
        body: '{"observedAt":null,"observations":[{"code":"454"}]}',
      },
    });
    const api = new FetchApiClient({ baseUrl: 'http://localhost:8787/', fetch });
    expect(api.baseUrl).toBe('http://localhost:8787');

    const health = await api.health();
    expect(health.ok && health.value.lastPoll.aws).toBe('a');

    const stations = await api.hydroStations({
      kinds: ['waterlevel'],
      bbox: { minLng: 127, minLat: 37, maxLng: 128, maxLat: 38 },
    });
    expect(stations.ok && stations.value).toEqual([{ code: '1' }]);
    expect(calls[1]).toBe(
      'http://localhost:8787/api/hydro/stations?kind=waterlevel&bbox=127,37,128,38',
    );

    const latest = await api.hydroLatest([toStationCode('1022670'), toStationCode('10224050')]);
    expect(latest.ok && latest.value.observedAt).toBe('o');
    expect(calls[2]).toBe('http://localhost:8787/api/hydro/latest?stations=1022670%2C10224050');

    const aws = await api.awsLatest([]);
    expect(aws.ok && aws.value.observations).toEqual([{ code: '454' }]);
    expect(calls[3]).toBe('http://localhost:8787/api/aws/latest');
  });

  it('alerts: GET /api/alerts 를 Result 로', async () => {
    const { fetch, calls } = fakeFetch({
      '/api/alerts': {
        status: 200,
        body: '{"count":1,"now":"t","alerts":[{"valleyId":"eobi","level":"watch","stale":false,"lastObservedAt":"o"}]}',
      },
    });
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const r = await api.alerts();
    expect(r.ok && r.value).toEqual([
      { valleyId: 'eobi', level: 'watch', stale: false, lastObservedAt: 'o' },
    ]);
    expect(calls[0]).toBe('http://s/api/alerts');
  });

  it('basinAt: 404 는 null, 그 밖의 실패는 repository/load-failed', async () => {
    const { fetch } = fakeFetch({
      'lng=127.25': {
        status: 200,
        body: '{"source":"db","stored":true,"basin":{"sbsncd":"101802"}}',
      },
      'lng=1&': { status: 404, body: '{"error":"basin_not_found"}' },
      'lng=2&': { status: 502, body: '{"error":"upstream_unavailable"}' },
      'lng=3&': { status: 200, body: 'not json' },
    });
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const hit = await api.basinAt(LngLat.of(127.25, 37.85));
    expect(hit.ok && hit.value?.basin.sbsncd).toBe('101802');
    const none = await api.basinAt(LngLat.of(1, 1));
    expect(none.ok && none.value).toBeNull();
    const bad = await api.basinAt(LngLat.of(2, 1));
    expect(!bad.ok && bad.error.code).toBe('repository/load-failed');
    expect(!bad.ok && bad.error.context['status']).toBe(502);
    const notJson = await api.basinAt(LngLat.of(3, 1));
    expect(!notJson.ok && notJson.error.message).toContain('JSON');
  });

  it('네트워크 예외는 던지지 않고 Result 로', async () => {
    const api = new FetchApiClient({
      baseUrl: 'http://s',
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    const r = await api.health();
    expect(!r.ok && r.error.code).toBe('repository/load-failed');
    expect(!r.ok && r.error.context['status']).toBe(0);
  });

  it('SSE: EventSource 가 있으면 여섯 이벤트를 구독하고 dispose 로 닫는다, 없으면 빈 Disposable', () => {
    const listeners = new Map<string, (e: { data: string }) => void>();
    let closed = 0;
    let openedUrl = '';
    const source: EventSourceLike = {
      addEventListener: (type, l) => listeners.set(type, l),
      close: () => {
        closed += 1;
      },
    };
    const api = new FetchApiClient({
      baseUrl: 'http://s',
      fetch: async () => ({ ok: true, status: 200, text: async () => '{}' }),
      eventSource: (url) => {
        openedUrl = url;
        return source;
      },
    });
    const events: ApiEvent[] = [];
    const sub = api.subscribeEvents(['hydro', 'aws'], (e) => events.push(e));
    expect(openedUrl).toBe('http://s/api/events?channel=hydro%2Caws');
    expect([...listeners.keys()].sort()).toEqual([
      'alert',
      'aws',
      'heartbeat',
      'hello',
      'hydro',
      'report',
    ]);
    listeners.get('hello')?.({
      data: '{"channels":["hydro","aws","x"],"heartbeatMs":15000,"at":"t"}',
    });
    listeners.get('hydro')?.({
      data: '{"channel":"hydro","at":"t1","observedAt":"o1","waterlevel":1203}',
    });
    listeners.get('heartbeat')?.({ data: '{"at":"t2"}' });
    listeners.get('aws')?.({ data: 'garbage' });
    listeners.get('alert')?.({ data: '{"channel":"alert","at":"t3","changed":1,"active":1}' });
    listeners.get('report')?.({
      data: '{"channel":"report","at":"t4","report":{"id":"r1","valleyId":"baegun","type":"trash","nickname":"산꾼","createdAt":"t4"}}',
    });
    listeners.get('report')?.({ data: '{"channel":"report","at":"t5","report":{"id":"bad"}}' });
    expect(events).toEqual([
      { type: 'hello', channels: ['hydro', 'aws'] },
      { type: 'hydro', at: 't1', observedAt: 'o1' },
      { type: 'heartbeat', at: 't2' },
      { type: 'alert', at: 't3', observedAt: null },
      {
        type: 'report',
        at: 't4',
        report: { id: 'r1', valleyId: 'baegun', type: 'trash', nickname: '산꾼', createdAt: 't4' },
      },
    ]);
    sub.dispose();
    sub.dispose();
    expect(closed).toBe(1);

    const noSse = new FetchApiClient({
      baseUrl: 'http://s',
      fetch: api['health'] as unknown as FetchLike,
    });
    expect(() => noSse.subscribeEvents(['aws'], () => {}).dispose()).not.toThrow();
  });

  it('parseSseEvent: at 없는 채널 이벤트는 null', () => {
    expect(parseSseEvent('aws', '{"observedAt":"x"}')).toBeNull();
    expect(parseSseEvent('unknown', '{"at":"t"}')).toBeNull();
    expect(parseSseEvent('aws', '{"at":"t"}')).toEqual({ type: 'aws', at: 't', observedAt: null });
  });

  it('parseSseEvent: report — 온전한 요약만 통과하고, 필드가 빠지거나 유형이 6종 밖이면 null(F5c)', () => {
    const valid =
      '{"at":"t","report":{"id":"r1","valleyId":"baegun","type":"emergency","nickname":"산꾼","createdAt":"c"}}';
    expect(parseSseEvent('report', valid)).toEqual({
      type: 'report',
      at: 't',
      report: {
        id: 'r1',
        valleyId: 'baegun',
        type: 'emergency',
        nickname: '산꾼',
        createdAt: 'c',
      },
    });
    expect(parseSseEvent('report', '{"at":"t","report":{"id":"r1"}}')).toBeNull();
    expect(
      parseSseEvent(
        'report',
        '{"at":"t","report":{"id":"r1","valleyId":"baegun","type":"nope","nickname":"산꾼","createdAt":"c"}}',
      ),
    ).toBeNull();
    expect(parseSseEvent('report', '{"at":"t"}')).toBeNull();
  });
});

describe('FetchApiClient — 제보(F5b)', () => {
  const draft: ApiReportDraft = {
    valleyId: 'baegun',
    type: 'trash',
    body: '쓰레기가 많아요',
    nickname: '산꾼',
    password: '1234',
  };

  it('reports: valleyId·limit·cursor 를 쿼리로 옮기고 커서 페이지를 돌려준다', async () => {
    const { fetch, calls } = fakeFetch({
      '/api/reports': {
        status: 200,
        body: '{"count":1,"reports":[{"id":"r1"}],"nextCursor":"c2"}',
      },
    });
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const r = await api.reports({ valleyId: 'baegun', limit: 10, cursor: 'c1' });
    expect(r.ok && r.value).toEqual({ reports: [{ id: 'r1' }], nextCursor: 'c2' });
    expect(calls[0]).toBe('http://s/api/reports?valleyId=baegun&limit=10&cursor=c1');
  });

  it('report: 200 은 값, 404 는 null', async () => {
    const ok200 = new FetchApiClient({
      baseUrl: 'http://s',
      fetch: async () => ({ ok: true, status: 200, text: async () => '{"id":"r1"}' }),
    });
    const found = await ok200.report('r1');
    expect(found.ok && found.value).toEqual({ id: 'r1' });

    const notFound = new FetchApiClient({
      baseUrl: 'http://s',
      fetch: async () => ({ ok: false, status: 404, text: async () => '{"error":"not_found"}' }),
    });
    const missing = await notFound.report('nope');
    expect(missing.ok && missing.value).toBeNull();
  });

  it('createReport: 사진이 없으면 JSON POST 로 보낸다(segmentId 없으면 필드도 뺀다)', async () => {
    const { fetch, requests } = capturingFetch(201, '{"id":"r1"}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const r = await api.createReport(draft);
    expect(r.ok && r.value).toEqual({ id: 'r1' });
    expect(requests).toHaveLength(1);
    const [{ url, init }] = requests;
    expect(url).toBe('http://s/api/reports');
    expect(init.method).toBe('POST');
    expect(init.headers?.['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      valleyId: 'baegun',
      type: 'trash',
      body: '쓰레기가 많아요',
      nickname: '산꾼',
      password: '1234',
    });
  });

  it('createReport: segmentId 가 있으면 JSON 본문에 함께 실린다', async () => {
    const { fetch, requests } = capturingFetch(201, '{"id":"r1"}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    await api.createReport({ ...draft, segmentId: 's1' });
    const parsed = JSON.parse(requests[0]?.init.body as string) as Record<string, unknown>;
    expect(parsed['segmentId']).toBe('s1');
  });

  it('createReport: 좌표(F5d)가 있으면 JSON 본문에 함께 실리고, 없으면 필드 자체가 없다', async () => {
    const { fetch, requests } = capturingFetch(201, '{"id":"r1"}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    await api.createReport({ ...draft, lat: 37.983412, lng: 127.460591 });
    const withCoord = JSON.parse(requests[0]?.init.body as string) as Record<string, unknown>;
    expect(withCoord['lat']).toBe(37.983412);
    expect(withCoord['lng']).toBe(127.460591);

    await api.createReport(draft);
    const withoutCoord = JSON.parse(requests[1]?.init.body as string) as Record<string, unknown>;
    expect(withoutCoord).not.toHaveProperty('lat');
    expect(withoutCoord).not.toHaveProperty('lng');
  });

  it('createReport: 사진이 있으면 multipart/form-data 로 보내고, 필드·바이트가 그대로 실린다', async () => {
    const { fetch, requests } = capturingFetch(201, '{"id":"r1"}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0, 1, 254, 255]); // JPEG 헤더 흉내 + 임의 바이트
    const r = await api.createReport({
      ...draft,
      segmentId: 's1',
      photos: [{ data: photoBytes, filename: 'photo-0.jpg', contentType: 'image/jpeg' }],
    });
    expect(r.ok && r.value).toEqual({ id: 'r1' });
    const [{ init }] = requests;
    expect(init.method).toBe('POST');
    const contentType = init.headers?.['content-type'] ?? '';
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    const fields = parseMultipart(contentType, init.body as Uint8Array);
    expect(fields['valleyId']?.toString('utf8')).toBe('baegun');
    expect(fields['segmentId']?.toString('utf8')).toBe('s1');
    expect(fields['type']?.toString('utf8')).toBe('trash');
    expect(fields['body']?.toString('utf8')).toBe('쓰레기가 많아요');
    expect(fields['nickname']?.toString('utf8')).toBe('산꾼');
    expect(fields['password']?.toString('utf8')).toBe('1234');
    expect(fields['photos']).toEqual(Buffer.from(photoBytes));
  });

  it('createReport: 사진 + 좌표(F5d)가 함께 있으면 multipart 필드에도 lat/lng 가 실린다', async () => {
    const { fetch, requests } = capturingFetch(201, '{"id":"r1"}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const photoBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    await api.createReport({
      ...draft,
      lat: 37.983412,
      lng: 127.460591,
      photos: [{ data: photoBytes, filename: 'a.jpg', contentType: 'image/jpeg' }],
    });
    const [{ init }] = requests;
    const fields = parseMultipart(init.headers?.['content-type'] ?? '', init.body as Uint8Array);
    expect(fields['lat']?.toString('utf8')).toBe('37.983412');
    expect(fields['lng']?.toString('utf8')).toBe('127.460591');
  });

  it('updateReport: PATCH JSON', async () => {
    const { fetch, requests } = capturingFetch(200, '{"id":"r1","body":"고침"}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const r = await api.updateReport('r1', { password: '1234', body: '고침' });
    expect(r.ok && r.value).toEqual({ id: 'r1', body: '고침' });
    expect(requests[0]?.init.method).toBe('PATCH');
    expect(requests[0]?.url).toBe('http://s/api/reports/r1');
  });

  it('updateReport: 좌표(F5d)를 함께 보내거나 null 로 지울 수 있다', async () => {
    const { fetch, requests } = capturingFetch(200, '{"id":"r1"}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    await api.updateReport('r1', { password: '1234', lat: 37.98, lng: 127.46 });
    expect(JSON.parse(requests[0]?.init.body as string)).toEqual({
      password: '1234',
      lat: 37.98,
      lng: 127.46,
    });

    await api.updateReport('r1', { password: '1234', lat: null, lng: null });
    expect(JSON.parse(requests[1]?.init.body as string)).toEqual({
      password: '1234',
      lat: null,
      lng: null,
    });
  });

  it('deleteReport: DELETE + 비밀번호 JSON 본문, 성공은 ok(undefined)', async () => {
    const { fetch, requests } = capturingFetch(200, '{"ok":true}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const r = await api.deleteReport('r1', '1234');
    expect(r.ok && r.value).toBeUndefined();
    expect(requests[0]?.init.method).toBe('DELETE');
    expect(JSON.parse(requests[0]?.init.body as string)).toEqual({ password: '1234' });
  });

  it('flagReport: reason 이 없으면 빈 본문, 있으면 실어 보낸다', async () => {
    const { fetch, requests } = capturingFetch(201, '{"ok":true}');
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    await api.flagReport('r1');
    expect(requests[0]?.url).toBe('http://s/api/reports/r1/flag');
    expect(JSON.parse(requests[0]?.init.body as string)).toEqual({});

    await api.flagReport('r1', '광고');
    expect(JSON.parse(requests[1]?.init.body as string)).toEqual({ reason: '광고' });
  });

  it('adminReports: 쿼리·includeHidden 을 옮기고 Authorization: Bearer 를 싣는다', async () => {
    const { fetch, requests } = capturingFetch(
      200,
      '{"reports":[{"id":"r1","valleyId":"v1","segmentId":null,"type":"trash","body":"b","nickname":"n","createdAt":"2026-01-01T00:00:00Z","photos":[],"hidden":true}],"nextCursor":null}',
    );
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const r = await api.adminReports('secret-token', {
      valleyId: 'v1',
      limit: 5,
      includeHidden: true,
    });
    expect(r.ok && r.value.reports[0]?.hidden).toBe(true);
    expect(requests[0]?.url).toBe('http://s/api/admin/reports?valleyId=v1&limit=5&includeHidden=1');
    expect(new Headers(requests[0]?.init.headers).get('authorization')).toBe('Bearer secret-token');
  });

  it('setReportHidden: PATCH + hidden 본문 + Authorization', async () => {
    const { fetch, requests } = capturingFetch(
      200,
      '{"id":"r1","valleyId":"v1","segmentId":null,"type":"trash","body":"b","nickname":"n","createdAt":"2026-01-01T00:00:00Z","photos":[],"hidden":true}',
    );
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const r = await api.setReportHidden('secret-token', 'r1', true);
    expect(r.ok && r.value.hidden).toBe(true);
    expect(requests[0]?.url).toBe('http://s/api/admin/reports/r1/hidden');
    expect(requests[0]?.init.method).toBe('PATCH');
    expect(JSON.parse(requests[0]?.init.body as string)).toEqual({ hidden: true });
    expect(new Headers(requests[0]?.init.headers).get('authorization')).toBe('Bearer secret-token');
  });

  it('adminFlags: 응답의 flags 배열을 그대로 돌려주고 Authorization 을 싣는다', async () => {
    const { fetch, requests } = capturingFetch(
      200,
      '{"flags":[{"reportId":"r1","count":2,"lastCreatedAt":"2026-01-01T00:00:00Z","valleyId":"v1","type":"trash","body":"b","nickname":"n","hidden":false}]}',
    );
    const api = new FetchApiClient({ baseUrl: 'http://s', fetch });
    const r = await api.adminFlags('secret-token');
    expect(r.ok && r.value).toHaveLength(1);
    expect(r.ok && r.value[0]?.count).toBe(2);
    expect(requests[0]?.url).toBe('http://s/api/admin/flags');
    expect(new Headers(requests[0]?.init.headers).get('authorization')).toBe('Bearer secret-token');
  });

  it('401 은 관리자 API 도 repository/load-failed 로 온다(토큰 오류를 호출부가 구분)', async () => {
    const api = new FetchApiClient({
      baseUrl: 'http://s',
      fetch: async () => ({ ok: false, status: 401, text: async () => '{"error":"unauthorized"}' }),
    });
    const r = await api.adminFlags('wrong-token');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.context['status']).toBe(401);
  });

  it('429 는 repository/load-failed 이고, retryAfterSec 을 context 에 얹는다', async () => {
    const api = new FetchApiClient({
      baseUrl: 'http://s',
      fetch: async () => ({
        ok: false,
        status: 429,
        text: async () => '{"error":"rate_limited","retryAfterSec":37}',
      }),
    });
    const r = await api.createReport(draft);
    expect(!r.ok && r.error.code).toBe('repository/load-failed');
    expect(!r.ok && r.error.context['status']).toBe(429);
    expect(!r.ok && r.error.context['retryAfterSec']).toBe(37);
    expect(!r.ok && r.error.context['error']).toBe('rate_limited');
  });
});
