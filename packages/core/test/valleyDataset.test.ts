/**
 * GeoJSON → 계곡 도메인 로더 테스트.
 *
 * `data/example-valley.geojson` 이 로더의 첫 소비자다. 스키마의 required·enum·
 * const·기하 규칙을 어긴 입력이 `Result` 실패로 돌아오는지, 구간이 `valleyId` 로
 * 묶이고 `order` 로 정렬되는지 고정한다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  groupIntoValleys,
  loadValleyBundle,
  loadValleyDataset,
  parseFacilityCollection,
  parseSegmentCollection,
} from '../src/data/valley/loadValleyDataset';
import { SHADE_HOUR_COUNT, SHADE_NOON_INDEX } from '../src/domain/valley/Segment';
import type { AppError } from '../src/shared/errors';
import type { Result } from '../src/shared/result';
import { shadeBundleFixture } from './doubles/shadeFixture';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_PATH = resolve(HERE, '../../../data/examples/example-valley.geojson');

// biome-ignore lint/suspicious/noExplicitAny: 테스트가 임의로 망가뜨릴 JSON 원문
type Loose = any;

/** 매 테스트가 독립적으로 망가뜨릴 수 있게 새로 파싱한다. */
function example(): Loose {
  return JSON.parse(readFileSync(EXAMPLE_PATH, 'utf8'));
}

function facilitiesFixture(): Loose {
  return {
    type: 'FeatureCollection',
    metadata: example().metadata,
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [127.2701, 37.8262] },
        properties: {
          id: 'sample-parking-1',
          valleyId: 'sample',
          name: '하류 공영주차장',
          facilityType: 'parking',
          capacity: 80,
          feeNote: '무료',
          mapIconTier: 0,
          mapImportance: 5,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [127.2688, 37.8284, 210] },
        properties: {
          id: 'sample-store-1',
          valleyId: 'sample',
          name: '계곡 매점',
          facilityType: 'store',
          operatingHours: '09:00~19:00',
        },
      },
    ],
  };
}

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

describe('example-valley.geojson 로드', () => {
  it('계곡 1개 · 구간 3개 · 상류→하류 순', () => {
    const dataset = loadValleyDataset(example());
    expect(dataset.ok).toBe(true);
    if (!dataset.ok) throw dataset.error;
    expect(dataset.value.metadata.crs).toBe('EPSG:4326');
    expect(dataset.value.metadata.coordinateOrder).toBe('[longitude, latitude]');
    expect(dataset.value.metadata.datasetVersion).toBe('2026-09-01.0');
    expect(dataset.value.valleys).toHaveLength(1);
    const valley = dataset.value.valleys[0];
    if (valley === undefined) throw new Error('valley 없음');
    expect(valley.id).toBe('sample');
    expect(valley.name).toBe('샘플계곡');
    expect(valley.segments.map((s) => s.position)).toEqual(['upper', 'mid', 'lower']);
    expect(valley.segments.map((s) => s.id)).toEqual([
      'sample-upper',
      'sample-mid',
      'sample-lower',
    ]);
  });

  it('구간 속성이 타입 그대로 실린다', () => {
    const dataset = loadValleyDataset(example());
    if (!dataset.ok) throw dataset.error;
    const mid = dataset.value.valleys[0]?.segments[1];
    if (mid === undefined) throw new Error('mid 없음');
    expect(mid.depth).toBe('waist');
    expect(mid.bed).toBe('gravel');
    expect(mid.shadeByHour).toHaveLength(SHADE_HOUR_COUNT);
    expect(mid.canopyCover).toBeGreaterThanOrEqual(0);
    expect(mid.canopyCover).toBeLessThanOrEqual(1);
    // shadeRatio 는 정오 값(산출) — shadeByHour[12시] 와 같아야 한다.
    expect(mid.shadeRatio).toBe(mid.shadeByHour?.[SHADE_NOON_INDEX]);
    expect(mid.accessDistanceM).toBe(320);
    expect(mid.accessGradePct).toBe(5.1);
    expect(mid.accessDifficulty).toBe('easy');
    expect(mid.swimBanned).toBe(false);
    expect(mid.riskNote).toBe('');
    expect(mid.upstreamStationCode).toBe('SAMPLE-UP-01');
    expect(mid.basinCode).toBe('1012345');
    expect(mid.freeAccess).toBe(true);
    expect(mid.petAllowed).toBe(true);
    expect(mid.mapIconTier).toBe(0);
    expect(mid.mapLabelTier).toBe(0);
    expect(mid.mapImportance).toBe(10);
    expect(mid.path).toHaveLength(3);
    expect(mid.start.lng).toBe(127.2641);
    expect(mid.start.lat).toBe(37.8318);
    const lower = dataset.value.valleys[0]?.segments[2];
    expect(lower?.swimBanned).toBe(true);
    expect(lower?.riskNote).toContain('물놀이 금지');
  });

  it('인접 구간은 끝점을 공유한다 (데이터 모양 확인)', () => {
    const dataset = loadValleyDataset(example());
    if (!dataset.ok) throw dataset.error;
    const [upper, mid, lower] = dataset.value.valleys[0]?.segments ?? [];
    expect(upper?.end.equals(mid?.start as never)).toBe(true);
    expect(mid?.end.equals(lower?.start as never)).toBe(true);
  });
});

describe('정렬과 묶기', () => {
  it('피처 순서가 뒤섞여도 order 로 정렬된다', () => {
    const raw = example();
    raw.features.reverse();
    const dataset = loadValleyDataset(raw);
    if (!dataset.ok) throw dataset.error;
    expect(dataset.value.valleys[0]?.segments.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it('여러 계곡의 구간이 섞여 있어도 valleyId 로 묶인다', () => {
    const raw = example();
    const other = JSON.parse(JSON.stringify(raw.features[1]));
    other.properties.id = 'other-mid';
    other.properties.valleyId = 'other';
    other.properties.valleyName = '다른계곡';
    const otherUpper = JSON.parse(JSON.stringify(raw.features[0]));
    otherUpper.properties.id = 'other-upper';
    otherUpper.properties.valleyId = 'other';
    otherUpper.properties.valleyName = '다른계곡';
    raw.features = [raw.features[0], other, raw.features[1], otherUpper, raw.features[2]];

    const dataset = loadValleyDataset(raw);
    if (!dataset.ok) throw dataset.error;
    expect(dataset.value.valleys.map((v) => v.id)).toEqual(['sample', 'other']);
    expect(dataset.value.valleys[0]?.segments).toHaveLength(3);
    expect(dataset.value.valleys[1]?.segments.map((s) => s.id)).toEqual([
      'other-upper',
      'other-mid',
    ]);
    expect(dataset.value.valleys[1]?.name).toBe('다른계곡');
  });

  it('같은 계곡의 valleyName 이 어긋나면 실패', () => {
    const raw = example();
    raw.features[2].properties.valleyName = '오타계곡';
    expectFailure(loadValleyDataset(raw), 'valley-data/invalid-value', 'valleyName');
  });

  it('구간 id 중복은 실패', () => {
    const raw = example();
    raw.features[2].properties.id = 'sample-upper';
    expectFailure(loadValleyDataset(raw), 'valley-data/invalid-value', 'sample-upper');
  });

  it('groupIntoValleys 는 파싱된 구간 배열에도 직접 쓸 수 있다', () => {
    const parsed = parseSegmentCollection(example());
    if (!parsed.ok) throw parsed.error;
    const valleys = groupIntoValleys(parsed.value.segments);
    expect(valleys.ok).toBe(true);
    if (valleys.ok) expect(valleys.value[0]?.segments).toHaveLength(3);
  });
});

describe('필수 필드 누락', () => {
  it.each(['id', 'valleyId', 'valleyName', 'segment', 'order'])('properties.%s 누락', (key) => {
    const raw = example();
    delete raw.features[1].properties[key];
    expectFailure(
      loadValleyDataset(raw),
      'valley-data/missing-field',
      `features[1].properties.${key}`,
    );
  });

  it('metadata 누락 필드', () => {
    const raw = example();
    delete raw.metadata.datasetVersion;
    expectFailure(loadValleyDataset(raw), 'valley-data/missing-field', 'metadata.datasetVersion');
  });

  it('metadata.crs 는 required — 없으면 실패', () => {
    const raw = example();
    delete raw.metadata.crs;
    expectFailure(loadValleyDataset(raw), 'valley-data/missing-field', 'metadata.crs');
  });

  it('geometry / properties 누락', () => {
    const noGeometry = example();
    delete noGeometry.features[0].geometry;
    expectFailure(
      loadValleyDataset(noGeometry),
      'valley-data/invalid-geometry',
      'features[0].geometry',
    );
    const noProps = example();
    delete noProps.features[0].properties;
    expectFailure(
      loadValleyDataset(noProps),
      'valley-data/missing-field',
      'features[0].properties',
    );
  });
});

describe('enum · 범위 위반', () => {
  it.each([
    ['segment', 'middle'],
    ['depth', 'deep'],
    ['bed', 'mud'],
    ['accessDifficulty', 'extreme'],
  ])('properties.%s = %s', (key, value) => {
    const raw = example();
    raw.features[0].properties[key] = value;
    expectFailure(loadValleyDataset(raw), 'valley-data/invalid-value', `properties.${key}`);
  });

  it('mapIconTier 는 0|1|2 만', () => {
    const raw = example();
    raw.features[0].properties.mapIconTier = 3;
    expectFailure(loadValleyDataset(raw), 'valley-data/invalid-value', 'mapIconTier');
  });

  it('shadeRatio 는 0~1, order 는 0 이상 정수, accessDistanceM 은 정수', () => {
    const shade = example();
    shade.features[0].properties.shadeRatio = 1.2;
    expectFailure(loadValleyDataset(shade), 'valley-data/invalid-value', 'shadeRatio');
    const order = example();
    order.features[0].properties.order = -1;
    expectFailure(loadValleyDataset(order), 'valley-data/invalid-value', 'order');
    const fractional = example();
    fractional.features[0].properties.order = 1.5;
    expectFailure(loadValleyDataset(fractional), 'valley-data/invalid-value', 'order');
    const distance = example();
    distance.features[0].properties.accessDistanceM = 12.5;
    expectFailure(loadValleyDataset(distance), 'valley-data/invalid-value', 'accessDistanceM');
  });

  it('shadeByHour 는 9개 · 각 0~1, canopyCover 는 0~1 (P1 산출값)', () => {
    const ok = example();
    ok.features[0].properties.shadeByHour = [0.39, 0.38, 0.38, 0.38, 0.38, 0.38, 0.39, 0.43, 0.62];
    ok.features[0].properties.canopyCover = 0.381;
    const dataset = loadValleyDataset(ok);
    expect(dataset.ok).toBe(true);
    if (dataset.ok) {
      const upper = dataset.value.valleys[0]?.segments[0];
      expect(upper?.shadeByHour).toEqual([0.39, 0.38, 0.38, 0.38, 0.38, 0.38, 0.39, 0.43, 0.62]);
      expect(upper?.canopyCover).toBe(0.381);
    }

    const short = example();
    short.features[0].properties.shadeByHour = [0.1, 0.2, 0.3];
    expectFailure(loadValleyDataset(short), 'valley-data/invalid-value', 'properties.shadeByHour');
    const long = example();
    long.features[0].properties.shadeByHour = new Array(10).fill(0.5);
    expectFailure(loadValleyDataset(long), 'valley-data/invalid-value', 'properties.shadeByHour');
    const outOfRange = example();
    outOfRange.features[0].properties.shadeByHour = [0, 0, 0, 1.2, 0, 0, 0, 0, 0];
    expectFailure(loadValleyDataset(outOfRange), 'valley-data/invalid-value', 'shadeByHour[3]');
    const notNumber = example();
    notNumber.features[0].properties.shadeByHour = [0, 0, 0, 0, 0, 0, 0, 0, '0.5'];
    expectFailure(loadValleyDataset(notNumber), 'valley-data/invalid-value', 'shadeByHour[8]');
    const notArray = example();
    notArray.features[0].properties.shadeByHour = 0.5;
    expectFailure(
      loadValleyDataset(notArray),
      'valley-data/invalid-value',
      'properties.shadeByHour',
    );
    const cover = example();
    cover.features[0].properties.canopyCover = 1.5;
    expectFailure(loadValleyDataset(cover), 'valley-data/invalid-value', 'canopyCover');
    const absent = example();
    delete absent.features[0].properties.shadeByHour;
    delete absent.features[0].properties.canopyCover;
    delete absent.features[0].properties.shadeRatio;
    const loaded = loadValleyDataset(absent);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.valleys[0]?.segments[0]?.shadeByHour).toBeUndefined();
      expect(loaded.value.valleys[0]?.segments[0]?.canopyCover).toBeUndefined();
    }
  });

  it('boolean 자리에 문자열이 오면 실패', () => {
    const raw = example();
    raw.features[0].properties.swimBanned = 'no';
    expectFailure(loadValleyDataset(raw), 'valley-data/invalid-value', 'swimBanned');
  });

  it('datasetVersion 형식 위반', () => {
    const raw = example();
    raw.metadata.datasetVersion = 'v1';
    expectFailure(loadValleyDataset(raw), 'valley-data/invalid-value', 'datasetVersion');
  });
});

describe('좌표 규약 위반', () => {
  it('좌표가 [위도, 경도] 로 뒤집히면 실패 — 위도 127 은 범위 밖', () => {
    const raw = example();
    raw.features[1].geometry.coordinates = raw.features[1].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng],
    );
    expectFailure(
      loadValleyDataset(raw),
      'valley-data/invalid-geometry',
      'features[1].geometry.coordinates[0]',
    );
  });

  it('metadata.coordinateOrder 가 규약과 다르면 실패', () => {
    const raw = example();
    raw.metadata.coordinateOrder = '[latitude, longitude]';
    expectFailure(loadValleyDataset(raw), 'valley-data/invalid-value', 'coordinateOrder');
  });

  it('metadata.crs 가 EPSG:4326 이 아니면 실패 — 런타임 변환은 없다', () => {
    const raw = example();
    raw.metadata.crs = 'EPSG:5186';
    expectFailure(loadValleyDataset(raw), 'valley-data/unsupported-crs', 'metadata.crs');
  });

  it('구간은 LineString 이어야 하고 최소 두 점', () => {
    const point = example();
    point.features[0].geometry = { type: 'Point', coordinates: [127.26, 37.83] };
    expectFailure(loadValleyDataset(point), 'valley-data/invalid-geometry', 'geometry.type');
    const single = example();
    single.features[0].geometry.coordinates = [[127.26, 37.83]];
    expectFailure(loadValleyDataset(single), 'valley-data/invalid-geometry', 'coordinates');
  });

  it('좌표 성분은 2~3개의 숫자', () => {
    const four = example();
    four.features[0].geometry.coordinates[0] = [127.26, 37.83, 100, 0];
    expectFailure(loadValleyDataset(four), 'valley-data/invalid-geometry', 'coordinates[0]');
    const text = example();
    text.features[0].geometry.coordinates[0] = ['127.26', '37.83'];
    expectFailure(loadValleyDataset(text), 'valley-data/invalid-geometry', 'coordinates[0]');
  });

  it('고도(세 번째 성분)는 허용하고 버린다', () => {
    const raw = example();
    raw.features[0].geometry.coordinates[0] = [127.2612, 37.8341, 320];
    const dataset = loadValleyDataset(raw);
    expect(dataset.ok).toBe(true);
    if (dataset.ok) expect(dataset.value.valleys[0]?.segments[0]?.start.lng).toBe(127.2612);
  });
});

describe('컬렉션 모양', () => {
  it('객체가 아니거나 type 이 FeatureCollection 이 아니면 실패', () => {
    expectFailure(loadValleyDataset(null), 'valley-data/invalid-collection');
    expectFailure(loadValleyDataset('{}'), 'valley-data/invalid-collection');
    const raw = example();
    raw.type = 'Feature';
    expectFailure(loadValleyDataset(raw), 'valley-data/invalid-value', '$.type');
  });

  it('features 가 배열이 아니면 실패, 원소가 객체가 아니면 실패', () => {
    const notArray = example();
    notArray.features = {};
    expectFailure(loadValleyDataset(notArray), 'valley-data/invalid-value', 'features');
    const badItem = example();
    badItem.features = [42];
    expectFailure(loadValleyDataset(badItem), 'valley-data/invalid-collection', 'features[0]');
  });

  it('features 가 비어 있으면 계곡 0개로 성공한다', () => {
    const raw = example();
    raw.features = [];
    const dataset = loadValleyDataset(raw);
    expect(dataset.ok).toBe(true);
    if (dataset.ok) expect(dataset.value.valleys).toHaveLength(0);
  });

  it('모르는 필드(selected 등)는 무시한다', () => {
    const raw = example();
    raw.features[0].properties.selected = true;
    raw.features[0].properties.somethingNew = 'x';
    expect(loadValleyDataset(raw).ok).toBe(true);
  });
});

describe('시설 컬렉션', () => {
  it('Point 시설을 파싱하고 계곡에 붙인다', () => {
    const dataset = loadValleyDataset(example(), facilitiesFixture());
    expect(dataset.ok).toBe(true);
    if (!dataset.ok) throw dataset.error;
    const valley = dataset.value.valleys[0];
    expect(valley?.facilities).toHaveLength(2);
    const parking = valley?.facilitiesOf('parking')[0];
    expect(parking?.name).toBe('하류 공영주차장');
    expect(parking?.capacity).toBe(80);
    expect(parking?.mapIconTier).toBe(0);
    const store = valley?.facilitiesOf('store')[0];
    expect(store?.operatingHours).toBe('09:00~19:00');
    expect(store?.position.lat).toBe(37.8284);
    // 주차장 → 하류 구간 끝점 거리 라벨. 값 자체보다 "m 단위 문자열" 규약을 고정한다.
    const lower = valley?.segments[2];
    expect(parking?.distanceFrom(lower?.end as never).format()).toMatch(/^\d+m$/);
  });

  it('시설 파일이 없으면 시설 없는 계곡으로 성공한다', () => {
    const dataset = loadValleyDataset(example());
    if (!dataset.ok) throw dataset.error;
    expect(dataset.value.valleys[0]?.facilities).toEqual([]);
  });

  it.each(['food', 'cafe'])('%s 는 파싱은 통과하되 결과에서 빠진다', (hidden) => {
    const raw = facilitiesFixture();
    raw.features[1].properties.facilityType = hidden;
    const parsed = parseFacilityCollection(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.facilities.map((f) => f.facilityType)).toEqual(['parking']);
  });

  it('facilityType 은 9종 enum — convenience 는 실패', () => {
    const raw = facilitiesFixture();
    raw.features[1].properties.facilityType = 'convenience';
    expectFailure(parseFacilityCollection(raw), 'valley-data/invalid-value', 'facilityType');
  });

  it('시설 geometry 는 Point 여야 한다', () => {
    const raw = facilitiesFixture();
    raw.features[0].geometry = {
      type: 'LineString',
      coordinates: [
        [127.27, 37.82],
        [127.28, 37.82],
      ],
    };
    expectFailure(parseFacilityCollection(raw), 'valley-data/invalid-geometry', 'geometry.type');
  });

  it('구간이 없는 계곡을 가리키는 시설은 실패', () => {
    const raw = facilitiesFixture();
    raw.features[0].properties.valleyId = 'ghost';
    expectFailure(loadValleyDataset(example(), raw), 'valley-data/invalid-value', 'valleyId');
  });

  it('시설 파일도 metadata.crs 검사를 받는다', () => {
    const raw = facilitiesFixture();
    raw.metadata.crs = 'EPSG:3857';
    expectFailure(loadValleyDataset(example(), raw), 'valley-data/unsupported-crs', 'metadata.crs');
  });
});

describe('그늘 합본 (F4)', () => {
  it('합본이 없으면 빈 맵 — 그늘 미산출 체크아웃에서도 데이터셋은 온전하다', () => {
    const dataset = loadValleyDataset(example(), facilitiesFixture());
    if (!dataset.ok) throw dataset.error;
    expect(dataset.value.shade.size).toBe(0);
  });

  it('합본의 계곡이 구간 파일의 계곡에 붙는다', () => {
    const dataset = loadValleyDataset(example(), facilitiesFixture(), shadeBundleFixture());
    if (!dataset.ok) throw dataset.error;
    expect(dataset.value.shade.size).toBe(1);
    const sample = dataset.value.shade.get(dataset.value.valleys[0]?.id as never);
    expect(sample?.shadowByHour).toHaveLength(SHADE_HOUR_COUNT);
    expect(sample?.canopy.length).toBeGreaterThan(0);
  });

  it('구간 파일에 없는 계곡의 그늘은 버린다 — 렌즈 하나 때문에 화면을 막지 않는다', () => {
    const raw = shadeBundleFixture();
    raw.valleys.ghost = raw.valleys.sample;
    const dataset = loadValleyDataset(example(), undefined, raw);
    if (!dataset.ok) throw dataset.error;
    expect([...dataset.value.shade.keys()]).toEqual(['sample']);
  });

  it('합본이 규약을 어기면 데이터셋 전체가 실패 — 산출 파이프라인의 버그다', () => {
    const raw = shadeBundleFixture();
    delete raw.valleys.sample.shadow['18'];
    expectFailure(
      loadValleyDataset(example(), undefined, raw),
      'valley-data/missing-field',
      'shadow.18',
    );
  });
});

describe('SD1 — whole · splitBasis · verified · 합본 로더', () => {
  /** 백운계곡 1구간 파일 모양 — data/valleys/<id>.geojson 이 이렇게 생긴다. */
  function wholeValley(id = 'baegun', verified: unknown = 'desk'): Loose {
    return {
      type: 'FeatureCollection',
      metadata: {
        description: `${id} 계곡`,
        source: 'OSM 하천 중심선 (ODbL)',
        datasetVersion: '2026-09-06.0',
        collectedAt: '2026-09-06',
        coordinateOrder: '[longitude, latitude]',
        crs: 'EPSG:4326',
        verified,
        sources: ['https://www.openstreetmap.org/copyright'],
      },
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [127.42, 38.09],
              [127.43, 38.085],
            ],
          },
          properties: {
            id: `${id}-whole`,
            valleyId: id,
            valleyName: `${id} 계곡`,
            segment: 'whole',
            order: 0,
            splitBasis: 'none',
          },
        },
      ],
    };
  }

  it('segment: whole + splitBasis 를 읽고, metadata.verified·sources 를 든다', () => {
    const parsed = parseSegmentCollection(wholeValley());
    if (!parsed.ok) throw parsed.error;
    expect(parsed.value.segments[0]?.position).toBe('whole');
    expect(parsed.value.segments[0]?.splitBasis).toBe('none');
    expect(parsed.value.metadata.verified).toBe('desk');
    expect(parsed.value.metadata.sources).toEqual(['https://www.openstreetmap.org/copyright']);
    // 샘플 파일에는 둘 다 없다 — 선택 필드.
    const sample = parseSegmentCollection(example());
    if (!sample.ok) throw sample.error;
    expect(sample.value.metadata.verified).toBeUndefined();
    expect(sample.value.metadata.sources).toBeUndefined();
  });

  it('splitBasis·verified·sources 가 enum·모양을 어기면 실패', () => {
    const badSplit = wholeValley();
    badSplit.features[0].properties.splitBasis = 'guess';
    expectFailure(parseSegmentCollection(badSplit), 'valley-data/invalid-value', 'splitBasis');
    expectFailure(
      parseSegmentCollection(wholeValley('baegun', 'rumor')),
      'valley-data/invalid-value',
      'metadata.verified',
    );
    const badSources = wholeValley();
    badSources.metadata.sources = ['ok', 3];
    expectFailure(
      parseSegmentCollection(badSources),
      'valley-data/invalid-value',
      'metadata.sources',
    );
  });

  it('합본: 컬렉션 순서대로 계곡이 나오고, 계곡별 verified 가 Valley 에 붙는다', () => {
    const bundle = {
      metadata: { ...wholeValley().metadata, description: '수도권 계곡 30개' },
      collections: [wholeValley('baegun', 'desk'), wholeValley('myeongji', 'field'), example()],
    };
    const facilities = {
      metadata: bundle.metadata,
      collections: [facilitiesFixture()],
    };
    const dataset = loadValleyBundle(bundle, facilities, shadeBundleFixture());
    if (!dataset.ok) throw dataset.error;
    expect(dataset.value.metadata.description).toBe('수도권 계곡 30개');
    expect(dataset.value.valleys.map((valley) => valley.id)).toEqual([
      'baegun',
      'myeongji',
      'sample',
    ]);
    expect(dataset.value.valleys.map((valley) => valley.verified)).toEqual([
      'desk',
      'field',
      undefined,
    ]);
    // 시설 합본은 계곡을 가리지 않고 합쳐진다 — 샘플 계곡 시설 2개.
    expect(dataset.value.valleys[2]?.facilities).toHaveLength(2);
    // 그늘 합본은 아는 계곡(sample)에만 붙는다.
    expect([...dataset.value.shade.keys()]).toEqual(['sample']);
  });

  it('합본 안 컬렉션의 오류 경로는 $.collections[n] 으로 시작한다', () => {
    const broken = wholeValley();
    delete broken.features[0].properties.segment;
    const bundle = { metadata: wholeValley().metadata, collections: [wholeValley(), broken] };
    expectFailure(
      loadValleyBundle(bundle),
      'valley-data/missing-field',
      '$.collections[1].features[0]',
    );
  });

  it('합본 자체가 객체가 아니거나 collections 가 없으면 실패', () => {
    expectFailure(loadValleyBundle([]), 'valley-data/invalid-collection');
    expectFailure(loadValleyBundle({ metadata: {} }), 'valley-data/missing-field', 'collections');
  });
});
