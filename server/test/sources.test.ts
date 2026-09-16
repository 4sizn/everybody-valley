import { describe, expect, it } from 'vitest';
import { bboxOf, geometryContains } from '../src/geo/pointInPolygon';
import { nextDelayMs } from '../src/jobs/backoff';
import { basinsFromFeatureCollection } from '../src/jobs/basinsJob';
import { dmsToDecimal, parseHrfcoLatest, parseHrfcoStations } from '../src/sources/hrfco';
import { parseAwsMinutes, parseAwsStations } from '../src/sources/kmaAws';
import { isTenMinuteMark, kstYmdhmToIso, toKstYmdhm } from '../src/time';

describe('time', () => {
  it('KST YYYYMMDDHHmm ↔ ISO UTC', () => {
    expect(kstYmdhmToIso('202609061310')).toBe('2026-09-06T04:10:00.000Z');
    expect(kstYmdhmToIso('202601010030')).toBe('2025-12-31T15:30:00.000Z');
    expect(kstYmdhmToIso('bad')).toBeUndefined();
    expect(toKstYmdhm(Date.parse('2026-09-06T04:10:00Z'))).toBe('202609061310');
    expect(toKstYmdhm(Date.parse('2025-12-31T15:30:00Z'))).toBe('202601010030');
  });
  it('10분 격자 판정', () => {
    expect(isTenMinuteMark('2026-09-06T04:10:00.000Z')).toBe(true);
    expect(isTenMinuteMark('2026-09-06T04:11:00.000Z')).toBe(false);
  });
});

describe('nextDelayMs', () => {
  it('성공 뒤는 정규 주기, 실패는 30 s 부터 2배씩 10분까지', () => {
    expect(nextDelayMs(0, { intervalMs: 600_000 })).toBe(600_000);
    expect(nextDelayMs(1, { intervalMs: 600_000 })).toBe(30_000);
    expect(nextDelayMs(2, { intervalMs: 60_000 })).toBe(60_000);
    expect(nextDelayMs(3, { intervalMs: 60_000 })).toBe(120_000);
    expect(nextDelayMs(6, { intervalMs: 60_000 })).toBe(600_000);
    expect(nextDelayMs(20, { intervalMs: 60_000 })).toBe(600_000);
  });
});

describe('pointInPolygon', () => {
  const square = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [127, 37],
        [128, 37],
        [128, 38],
        [127, 38],
        [127, 37],
      ],
      // 구멍
      [
        [127.4, 37.4],
        [127.6, 37.4],
        [127.6, 37.6],
        [127.4, 37.6],
        [127.4, 37.4],
      ],
    ],
  };
  it('안·밖·구멍', () => {
    expect(geometryContains(square, 127.2, 37.2)).toBe(true);
    expect(geometryContains(square, 126.9, 37.2)).toBe(false);
    expect(geometryContains(square, 127.5, 37.5)).toBe(false);
  });
  it('MultiPolygon 과 bbox', () => {
    const multi = { type: 'MultiPolygon' as const, coordinates: [square.coordinates] };
    expect(geometryContains(multi, 127.9, 37.9)).toBe(true);
    expect(bboxOf(multi)).toEqual({ minLng: 127, minLat: 37, maxLng: 128, maxLat: 38 });
  });
});

describe('HRFCO 파서', () => {
  it('도분초 → 십진도', () => {
    expect(dmsToDecimal('128-33-04')).toBeCloseTo(128.5511, 4);
    expect(dmsToDecimal('37-37-27 ')).toBeCloseTo(37.6242, 4);
    expect(dmsToDecimal('- -  -')).toBeUndefined();
    expect(dmsToDecimal(undefined)).toBeUndefined();
  });
  it('제원: 수위 4단계 숫자화, 좌표 없는 행은 null 좌표로 남긴다', () => {
    const body = {
      content: [
        {
          wlobscd: '1001602',
          agcnm: '기후에너지환경부',
          obsnm: '평창군(송정교)',
          addr: '강원',
          lon: '128-33-04',
          lat: '37-37-27 ',
          gdt: '511.589',
          attwl: '3.1',
          wrnwl: '4.1',
          almwl: '5',
          srswl: '6',
          pfh: '6',
          fstnyn: 'N',
        },
        { wlobscd: '9', obsnm: '좌표없음', lon: '', lat: '', gdt: ' ' },
        { obsnm: '코드없음' },
      ],
    };
    const s = parseHrfcoStations('waterlevel', body);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({
      kind: 'hrfco-waterlevel',
      code: '1001602',
      name: '평창군(송정교)',
      elevationM: 511.589,
      suspicious: false,
      attrs: { attwl: 3.1, wrnwl: 4.1, almwl: 5, srswl: 6, pfh: 6, fstnyn: 'N', addr: '강원' },
    });
    expect(s[1]).toMatchObject({ code: '9', lng: null, lat: null, elevationM: null, attrs: null });
    expect(() => parseHrfcoStations('rainfall', {})).toThrow(/content/);
  });
  it('최신 10분: ymdhm KST → UTC, 빈 fw 는 extra 없음', () => {
    const wl = parseHrfcoLatest('waterlevel', {
      content: [
        { wlobscd: '1001602', ymdhm: '202609061310', wl: '1.68', fw: ' ' },
        { wlobscd: '1001603', ymdhm: '202609061310', wl: '2.1', fw: '12.5' },
        { wlobscd: 'x', ymdhm: 'bad', wl: '1' },
      ],
    });
    expect(wl).toEqual([
      {
        kind: 'hrfco-waterlevel',
        code: '1001602',
        observedAt: '2026-09-06T04:10:00.000Z',
        value: 1.68,
        extra: null,
      },
      {
        kind: 'hrfco-waterlevel',
        code: '1001603',
        observedAt: '2026-09-06T04:10:00.000Z',
        value: 2.1,
        extra: { fw: 12.5 },
      },
    ]);
    const rf = parseHrfcoLatest('rainfall', {
      content: [{ rfobscd: '10014010', ymdhm: '202609061310', rf: '0.0' }],
    });
    expect(rf[0]).toMatchObject({ kind: 'hrfco-rainfall', code: '10014010', value: 0 });
  });
});

describe('AWS 파서', () => {
  const text = [
    '#START7777',
    '# YYMMDDHHMI   STN    WD1    WS1    WDS    WSS   WD10   WS10     TA     RE RN-15m RN-60m RN-12H RN-DAY     HM     PA     PS     TD',
    '202609061311,42,63.6,5.8,32.0,9.4,49.7,6.7,28.7,-99.9,0.0,0.0,0.0,0.0,57.5,1009.3,1012.2,19.5,=',
    '202609061320,454,0,0,0,0,0,0,24.1,1,1.5,12.5,30.0,44.0,90,1000,1005,20,=',
    '',
  ];
  it('행 → 관측(value = RN-60m), 결측 -99 → null, 종료 표식 감지', () => {
    const p = parseAwsMinutes(`${text.join('\n')}\n#7777END\n`);
    expect(p.complete).toBe(true);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toEqual({
      kind: 'aws',
      code: '42',
      observedAt: '2026-09-06T04:11:00.000Z',
      value: 0,
      extra: { rn15: 0, rn12h: 0, rnDay: 0, ta: 28.7, re: null },
    });
    expect(p.rows[1]).toMatchObject({ code: '454', value: 12.5, extra: { rn15: 1.5, rnDay: 44 } });
    expect(parseAwsMinutes(text.join('\n')).complete).toBe(false);
  });
  it('지점정보: 9번째 토큰이 지점명, 표고 -99 는 null', () => {
    const s = parseAwsStations(
      '#  STN_ID LON LAT STN_SP HT HT_WD LAU_ID STN_AD STN_KO STN_EN ...\n' +
        ' 454 127.0611 37.9372 1 108.0 10 41 4180 하봉암 Habongam 0 4180 1018 주소\n' +
        ' 999 127.0 37.0 1 -99.0 10 41 0 표고없음 x\n' +
        'bad line\n',
    );
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({
      kind: 'aws',
      code: '454',
      name: '하봉암',
      lng: 127.0611,
      lat: 37.9372,
      elevationM: 108,
    });
    expect(s[1]).toMatchObject({ code: '999', elevationM: null });
  });
});

describe('basinsFromFeatureCollection', () => {
  it('속성 이름 대소문자 무관, geometry 없는 피처는 건너뛴다', () => {
    const geom = {
      type: 'Polygon',
      coordinates: [
        [
          [127, 37],
          [128, 37],
          [128, 38],
          [127, 37],
        ],
      ],
    };
    const out = basinsFromFeatureCollection(
      {
        features: [
          {
            properties: {
              SBSN_CD: '101802',
              SBSN_NM: '퇴계원수위표',
              MBSN_CD: '1018',
              BBSN_CD: '10',
            },
            geometry: geom,
          },
          { properties: { sbsncd: '101803' } },
        ],
      },
      '2026-09-06T00:00:00Z',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      sbsncd: '101802',
      sbsnnm: '퇴계원수위표',
      mbsncd: '1018',
      bbsncd: '10',
      geometry: geom,
    });
    expect(() => basinsFromFeatureCollection({}, '')).toThrow(/features/);
  });
});
