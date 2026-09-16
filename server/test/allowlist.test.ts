import { describe, expect, it } from 'vitest';
import { resolveVworldUpstream } from '../src/vworld/allowlist';

const creds = { key: 'SERVER-KEY-0123456789', domain: 'localhost' };

describe('resolveVworldUpstream', () => {
  it('허용목록 서비스 네 개를 /req/<service> 로 보낸다', () => {
    for (const [sub, service] of [
      ['wfs', 'wfs'],
      ['wms', 'wms'],
      ['search', 'search'],
      ['address', 'address'],
      ['geocoder', 'address'],
      ['req/wfs', 'wfs'],
      ['WFS/', 'wfs'],
    ] as const) {
      const r = resolveVworldUpstream(sub, '?a=1', 'GET', creds);
      expect(r.ok, sub).toBe(true);
      if (r.ok) {
        expect(r.service).toBe(service);
        expect(r.url.origin).toBe('https://api.vworld.kr');
        expect(r.url.pathname).toBe(`/req/${service}`);
      }
    }
  });

  it('허용목록 밖 경로는 거절한다(data·image·중첩 경로·빈 경로)', () => {
    for (const sub of ['data', 'image', 'wfs/extra', '', 'req', '../wfs']) {
      const r = resolveVworldUpstream(sub, '', 'GET', creds);
      expect(r.ok, sub).toBe(false);
      if (!r.ok) expect(r.reason).toBe('not-allowed');
    }
  });

  it('GET·HEAD·POST 만 허용한다', () => {
    expect(resolveVworldUpstream('wfs', '', 'post', creds).ok).toBe(true);
    const r = resolveVworldUpstream('wfs', '', 'DELETE', creds);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('method-not-allowed');
  });

  it('클라이언트 쿼리를 보존하고 key·domain 은 서버 값으로 덮는다', () => {
    const r = resolveVworldUpstream(
      'wfs',
      '?SERVICE=WFS&TYPENAME=lt_c_wkmsbsn&key=CLIENT&domain=evil.example&apiKey=x&BBOX=37,127,38,128,EPSG:4326',
      'GET',
      creds,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.url.searchParams;
    expect(p.get('SERVICE')).toBe('WFS');
    expect(p.get('TYPENAME')).toBe('lt_c_wkmsbsn');
    expect(p.get('BBOX')).toBe('37,127,38,128,EPSG:4326');
    expect(p.get('key')).toBe(creds.key);
    expect(p.get('domain')).toBe('localhost');
    expect(p.has('apiKey')).toBe(false);
    expect(r.url.toString()).not.toContain('CLIENT');
    expect(r.url.toString()).not.toContain('evil.example');
  });

  it('반복 파라미터도 순서대로 넘긴다', () => {
    const r = resolveVworldUpstream('search', 'query=a&query=b', 'GET', creds);
    expect(r.ok && r.url.searchParams.getAll('query')).toEqual(['a', 'b']);
  });
});
