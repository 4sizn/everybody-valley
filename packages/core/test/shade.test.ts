/**
 * 그늘 도메인·로더 테스트 (F4).
 *
 * `data/examples/shade/sample` 이 로더의 첫 소비자다. 합본 모양·링 규칙·좌표 범위·시각 9개를
 * 어긴 입력이 `Result` 실패로 돌아오는지, 기본 시각 규칙(결정 (a))과 나무 밀도 3단계
 * (결정 (f))가 맞는지 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { loadShadeBundle, SHADE_BUNDLE_HOUR_KEYS } from '../src/data/valley/loadShadeBundle';
import { SHADE_HOUR_COUNT, SHADE_HOURS, SHADE_NOON_INDEX } from '../src/domain/valley/Segment';
import {
  canopyLevel,
  canopyLevelLabel,
  clampShadeHourIndex,
  defaultShadeHourIndex,
  isShadeHourIndex,
  SHADE_HOUR_VALUES,
  shadowAt,
} from '../src/domain/valley/Shade';
import type { AppError } from '../src/shared/errors';
import type { Result } from '../src/shared/result';
import { type LooseJson, shadeBundleFixture } from './doubles/shadeFixture';

function expectFailure(
  result: Result<unknown, AppError>,
  code: AppError['code'],
  pathIncludes?: string,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
  if (pathIncludes !== undefined) {
    expect(String(result.error.context['path'])).toContain(pathIncludes);
  }
}

/** KST 시각으로 `Date` 를 만든다 — KST 는 UTC+9. */
function kst(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 7, 1, hour - 9, minute));
}

describe('시각 축 상수', () => {
  it('정오 인덱스는 2, 합본 키는 "10"…"18"', () => {
    expect(SHADE_NOON_INDEX).toBe(2);
    expect(SHADE_HOURS[SHADE_NOON_INDEX]).toBe('12:00');
    expect(SHADE_HOUR_VALUES).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(SHADE_BUNDLE_HOUR_KEYS).toEqual(['10', '11', '12', '13', '14', '15', '16', '17', '18']);
    expect(SHADE_BUNDLE_HOUR_KEYS).toHaveLength(SHADE_HOUR_COUNT);
  });

  it('isShadeHourIndex / clampShadeHourIndex', () => {
    expect(isShadeHourIndex(0)).toBe(true);
    expect(isShadeHourIndex(8)).toBe(true);
    expect(isShadeHourIndex(9)).toBe(false);
    expect(isShadeHourIndex(-1)).toBe(false);
    expect(isShadeHourIndex(2.5)).toBe(false);
    expect(clampShadeHourIndex(-3)).toBe(0);
    expect(clampShadeHourIndex(11)).toBe(8);
    expect(clampShadeHourIndex(4)).toBe(4);
  });
});

describe('defaultShadeHourIndex — 결정 (a)', () => {
  it('10~18시 안에서는 가장 가까운 정시', () => {
    expect(defaultShadeHourIndex(kst(10, 0))).toBe(0);
    expect(defaultShadeHourIndex(kst(14, 20))).toBe(4); // 14:00
    expect(defaultShadeHourIndex(kst(14, 40))).toBe(5); // 15:00
    expect(defaultShadeHourIndex(kst(17, 30))).toBe(8); // 반올림 → 18:00
  });

  it('18시대는 19시로 반올림되어도 18시에 붙는다', () => {
    expect(defaultShadeHourIndex(kst(18, 50))).toBe(8);
  });

  it('10시 전·19시 후는 정오 — 그 시각의 그늘 데이터가 없다', () => {
    expect(defaultShadeHourIndex(kst(9, 59))).toBe(SHADE_NOON_INDEX);
    expect(defaultShadeHourIndex(kst(19, 0))).toBe(SHADE_NOON_INDEX);
    expect(defaultShadeHourIndex(kst(23, 30))).toBe(SHADE_NOON_INDEX);
    // KST 00:30 = 전날 UTC 15:30 — 날짜가 넘어가도 시각만 본다.
    expect(defaultShadeHourIndex(new Date(Date.UTC(2026, 7, 1, 15, 30)))).toBe(SHADE_NOON_INDEX);
  });
});

describe('canopyLevel — 결정 (f)', () => {
  it('≥0.7 많음 / ≥0.4 보통 / 그 외 적음', () => {
    expect(canopyLevel(1)).toBe('dense');
    expect(canopyLevel(0.7)).toBe('dense');
    expect(canopyLevel(0.69)).toBe('moderate');
    expect(canopyLevel(0.4)).toBe('moderate');
    expect(canopyLevel(0.39)).toBe('sparse');
    expect(canopyLevel(0)).toBe('sparse');
    expect(canopyLevelLabel('dense')).toBe('나무 많음');
    expect(canopyLevelLabel('moderate')).toBe('나무 보통');
    expect(canopyLevelLabel('sparse')).toBe('나무 적음');
  });
});

describe('loadShadeBundle — data/examples/shade/sample', () => {
  it('계곡 1개 · 수관 폴리곤 · 시각 9장 · 메타', () => {
    const bundle = loadShadeBundle(shadeBundleFixture());
    expect(bundle.ok).toBe(true);
    if (!bundle.ok) throw bundle.error;
    expect([...bundle.value.keys()]).toEqual(['sample']);
    const sample = bundle.value.get('sample' as never);
    if (sample === undefined) throw new Error('fixture');
    expect(sample.valleyId).toBe('sample');
    expect(sample.canopy.length).toBeGreaterThan(0);
    expect(sample.shadowByHour).toHaveLength(SHADE_HOUR_COUNT);
    // 정오 근처는 개방지 그림자가 없고(파일은 비어 있어도 존재), 늦은 오후가 가장 크다.
    expect(shadowAt(sample, SHADE_NOON_INDEX)).toEqual([]);
    expect(shadowAt(sample, 7).length).toBeGreaterThan(shadowAt(sample, 0).length);
    expect(sample.metadata.representativeDate).toBe('2026-08-01');
    expect(sample.metadata.chmAcquisition).toEqual(['2019-03', '2019-05']);
    expect(sample.metadata.source).toContain('위성 기반 추정');
  });

  it('링은 [lng, lat] 튜플이고 닫혀 있다 — LngLat 객체를 만들지 않는다', () => {
    const bundle = loadShadeBundle(shadeBundleFixture());
    if (!bundle.ok) throw bundle.error;
    const ring = bundle.value.get('sample' as never)?.canopy[0]?.[0];
    if (ring === undefined) throw new Error('fixture');
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(Array.isArray(ring[0])).toBe(true);
    expect(ring[0]?.[0]).toBeGreaterThan(127);
    expect(ring[0]?.[1]).toBeLessThan(38);
  });

  it('MultiPolygon 은 폴리곤 여럿으로 평평하게 펴진다', () => {
    const raw = shadeBundleFixture();
    const canopy = raw.valleys.sample.canopy;
    const [a, b] = canopy.features;
    canopy.features = [
      {
        type: 'Feature',
        properties: a.properties,
        geometry: {
          type: 'MultiPolygon',
          coordinates: [a.geometry.coordinates, b.geometry.coordinates],
        },
      },
    ];
    const bundle = loadShadeBundle(raw);
    if (!bundle.ok) throw bundle.error;
    expect(bundle.value.get('sample' as never)?.canopy).toHaveLength(2);
  });

  it('합본 모양 위반 — 객체 아님 · valleys 누락 · 계곡 항목이 객체 아님', () => {
    expectFailure(loadShadeBundle(null), 'valley-data/invalid-collection');
    expectFailure(loadShadeBundle({}), 'valley-data/missing-field', '$.valleys');
    expectFailure(loadShadeBundle({ valleys: [] }), 'valley-data/invalid-value', '$.valleys');
    expectFailure(
      loadShadeBundle({ valleys: { sample: 3 } }),
      'valley-data/invalid-value',
      'sample',
    );
  });

  it('시각 9장 중 하나가 빠지면 실패 — 인덱스가 시각 축과 어긋난다', () => {
    const raw = shadeBundleFixture();
    delete raw.valleys.sample.shadow['14'];
    expectFailure(loadShadeBundle(raw), 'valley-data/missing-field', 'shadow.14');
    const noShadow = shadeBundleFixture();
    delete noShadow.valleys.sample.shadow;
    expectFailure(loadShadeBundle(noShadow), 'valley-data/missing-field', 'shadow');
  });

  it('레이어 파일 모양 — type · features · Feature 객체', () => {
    const type = shadeBundleFixture();
    type.valleys.sample.canopy.type = 'Feature';
    expectFailure(loadShadeBundle(type), 'valley-data/invalid-value', 'canopy.type');
    const features = shadeBundleFixture();
    features.valleys.sample.shadow['17'].features = 'x';
    expectFailure(loadShadeBundle(features), 'valley-data/invalid-value', 'shadow.17.features');
    const item = shadeBundleFixture();
    item.valleys.sample.canopy.features = [1];
    expectFailure(loadShadeBundle(item), 'valley-data/invalid-collection', 'features[0]');
  });

  it('기하 규칙 — Polygon/MultiPolygon 만, 링 최소 4점, 닫힘, 좌표 범위', () => {
    const line = shadeBundleFixture();
    line.valleys.sample.canopy.features[0].geometry = {
      type: 'LineString',
      coordinates: [
        [127.26, 37.83],
        [127.27, 37.83],
      ],
    };
    expectFailure(loadShadeBundle(line), 'valley-data/invalid-geometry', 'geometry.type');

    const short: LooseJson = shadeBundleFixture();
    short.valleys.sample.canopy.features[0].geometry.coordinates = [
      [
        [127.26, 37.83],
        [127.27, 37.83],
        [127.26, 37.83],
      ],
    ];
    expectFailure(loadShadeBundle(short), 'valley-data/invalid-geometry', 'coordinates[0]');

    const open: LooseJson = shadeBundleFixture();
    open.valleys.sample.canopy.features[0].geometry.coordinates = [
      [
        [127.26, 37.83],
        [127.27, 37.83],
        [127.27, 37.84],
        [127.26, 37.84],
      ],
    ];
    expectFailure(loadShadeBundle(open), 'valley-data/invalid-geometry', 'coordinates[0]');

    const flipped: LooseJson = shadeBundleFixture();
    const ring = flipped.valleys.sample.canopy.features[0].geometry.coordinates[0];
    flipped.valleys.sample.canopy.features[0].geometry.coordinates[0] = ring.map(
      ([lng, lat]: [number, number]) => [lat, lng],
    );
    expectFailure(loadShadeBundle(flipped), 'valley-data/invalid-geometry', 'coordinates[0][0]');

    const text: LooseJson = shadeBundleFixture();
    text.valleys.sample.canopy.features[0].geometry.coordinates[0][0] = ['127.26', '37.83'];
    expectFailure(loadShadeBundle(text), 'valley-data/invalid-geometry', 'coordinates[0][0]');
  });

  it('메타 — representativeDate 형식, chmAcquisition 문자열 배열(없으면 빈 배열), crs 검사', () => {
    const date = shadeBundleFixture();
    date.valleys.sample.canopy.metadata.representativeDate = '8/1';
    expectFailure(loadShadeBundle(date), 'valley-data/invalid-value', 'representativeDate');

    const acquisition = shadeBundleFixture();
    acquisition.valleys.sample.canopy.metadata.chmAcquisition = '2019';
    expectFailure(loadShadeBundle(acquisition), 'valley-data/invalid-value', 'chmAcquisition');

    const absent = shadeBundleFixture();
    delete absent.valleys.sample.canopy.metadata.chmAcquisition;
    const loaded = loadShadeBundle(absent);
    expect(loaded.ok && loaded.value.get('sample' as never)?.metadata.chmAcquisition).toEqual([]);

    const crs = shadeBundleFixture();
    crs.valleys.sample.canopy.metadata.crs = 'EPSG:32652';
    expectFailure(loadShadeBundle(crs), 'valley-data/unsupported-crs', 'metadata.crs');

    const noMeta = shadeBundleFixture();
    delete noMeta.valleys.sample.canopy.metadata;
    expectFailure(loadShadeBundle(noMeta), 'valley-data/invalid-collection', 'canopy.metadata');
  });

  it('빈 합본은 빈 맵', () => {
    const bundle = loadShadeBundle({ valleys: {} });
    expect(bundle.ok && bundle.value.size).toBe(0);
  });
});
