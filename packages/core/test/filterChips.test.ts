/**
 * 조건 필터 칩(N1) 테스트 — SD1 실데이터 30계곡의 실측 개수를 박아 둔다.
 *
 * `docs/TODO.md` N1 절의 표(화장실 14·주차장 15·무료 10·야영 7·그늘 많음 8,
 * 조합 주차장+그늘 5·주차장+무료 4·주차장+무료+그늘 1·주차장+무료+야영 0)와
 * 같은 값이어야 한다. 다르게 나오면 시딩 데이터가 바뀐 것이고, 이 시험이
 * 먼저 깨져야 한다.
 *
 * 2026-09-21 기준선 재측정: "시설이 있다" 가 계곡 점 1.5 km 안 존재 → **물가(중심선) 300 m 안,
 * 주차장 800 m** (`Valley.facilitiesAround().nearby`) 로 바뀌어 화장실 19→14 · 주차장 18→15 ·
 * 주차장+그늘 6→5 · 주차장+무료 5→4. 같은 날 7곳 재시딩(시딩 반경 3 km)도 있었지만 새 정의에선
 * 그 시설들(1 km 밖)이 칩을 켜지 않는다. 사용자 결정 A.
 *
 * 그늘 많음(8/30)은 N5 카드 배지(`shadeTags(segment).amount === 'many'`, 종일
 * 평균 ≥ 0.5)와 **같은 술어**다 — 처음엔 수관 비율(`canopyCover`) 기준으로
 * 짜서 6/30 이 나왔는데, 카드에 "나무 그늘 많음" 배지가 붙은 계곡이 이 칩을
 * 누르면 사라지는 불일치가 리뷰에서 잡혀 `shadeTags` 재사용으로 정정했다.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadValleyDataset } from '../src/data/valley/loadValleyDataset';
import { LngLat } from '../src/domain/geo/LngLat';
import { Facility } from '../src/domain/valley/Facility';
import {
  evaluateFilterChips,
  FILTER_CHIP_KEYS,
  type FilterChipKey,
  filterChipMatchCounts,
  filterValleys,
} from '../src/domain/valley/filterChips';
import { toFacilityId, toSegmentId, toValleyId } from '../src/domain/valley/ids';
import { Segment } from '../src/domain/valley/Segment';
import type { Valley } from '../src/domain/valley/Valley';
import { Valley as ValleyClass } from '../src/domain/valley/Valley';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../../data');

/** `data/valleys` + `data/facilities` 의 계곡별 파일을 한 FeatureCollection씩으로 합쳐 싣는다. */
function loadSd1Valleys(): readonly Valley[] {
  const merge = (dir: string) => {
    const files = readdirSync(resolve(DATA_DIR, dir)).filter((name) => name.endsWith('.geojson'));
    let metadata: unknown;
    const features: unknown[] = [];
    for (const file of files) {
      // biome-ignore lint/suspicious/noExplicitAny: 원본 GeoJSON 을 그대로 합친다
      const dataset = JSON.parse(readFileSync(resolve(DATA_DIR, dir, file), 'utf8')) as any;
      metadata ??= dataset.metadata;
      features.push(...dataset.features);
    }
    return { type: 'FeatureCollection', metadata, features };
  };

  const dataset = loadValleyDataset(merge('valleys'), merge('facilities'));
  if (!dataset.ok) throw dataset.error;
  return dataset.value.valleys;
}

const catalog = loadSd1Valleys();
// 기존 SD1 30곳의 실측 회귀 기준은 유지한다.
/* SD1(수도권 30) 기준선 — 나중에 손으로 추가한 계곡은 뺀다. 긴고랑(SD3)에 이어 광주 무등산
   두 곳(SD5, 2026-09-09)이 들어와, 그 값들이 SD1 실측 표를 흔들지 않게 여기서 가른다. */
const ADDED_AFTER_SD1 = ['gingorang', 'jeungsimsa', 'wonhyo'].map(toValleyId);
const sd1 = catalog.filter((valley) => !ADDED_AFTER_SD1.includes(valley.id));

describe('SD1 뒤에 더한 계곡', () => {
  it('긴고랑·무등산 두 곳까지 33곳이 검색 대상이고, 산출된 그늘이 필터에 반영된다', () => {
    expect(catalog).toHaveLength(33);
    const added = catalog.filter((valley) => valley.id === toValleyId('gingorang'));
    expect(added).toHaveLength(1);
    const filtered = filterValleys(added, new Set(['shadeMany']));
    expect(filtered.valleys).toHaveLength(1);
    expect(filtered.excludedByMissingInfo).toBe(0);

    // 광주 무등산(SD5) — 수도권 밖 첫 계곡. 정자 5곳이 붙은 증심사계곡도 목록에 든다.
    const mudeung = catalog.filter((valley) =>
      [toValleyId('jeungsimsa'), toValleyId('wonhyo')].includes(valley.id),
    );
    expect(mudeung).toHaveLength(2);
  });
});

function selectionOf(...keys: readonly FilterChipKey[]): ReadonlySet<FilterChipKey> {
  return new Set(keys);
}

describe('filterChips — SD1 실측', () => {
  it('30계곡을 실었다', () => {
    expect(sd1.length).toBe(30);
  });

  it('칩 단독 개수 — 화장실 14 · 주차장 15 · 무료 10 · 야영 7 · 그늘 많음 8', () => {
    const counts = filterChipMatchCounts(sd1, selectionOf());
    expect(counts.get('restroom')).toBe(14);
    expect(counts.get('parking')).toBe(15);
    expect(counts.get('freeAccess')).toBe(10);
    expect(counts.get('camping')).toBe(7);
    expect(counts.get('shadeMany')).toBe(8);
  });

  it('AND 조합 — 주차장+그늘 5 · 주차장+무료 4 · 주차장+무료+그늘 1 · 주차장+무료+야영 0', () => {
    expect(filterValleys(sd1, selectionOf('parking', 'shadeMany')).valleys).toHaveLength(5);
    expect(filterValleys(sd1, selectionOf('parking', 'freeAccess')).valleys).toHaveLength(4);
    expect(
      filterValleys(sd1, selectionOf('parking', 'freeAccess', 'shadeMany')).valleys,
    ).toHaveLength(1);
    // 셋을 겹치면 0 곳도 흔하다 — (b)(e) 결정의 근거. 위 조합은 이제 1 곳이라
    // (그늘 술어 정정 뒤) 실제 0 곳 사례로 이걸 쓴다.
    expect(
      filterValleys(sd1, selectionOf('parking', 'freeAccess', 'camping')).valleys,
    ).toHaveLength(0);
  });

  it('칩 배지 개수는 다른 칩의 현재 선택을 반영한다(결정 (b))', () => {
    // 주차장을 이미 선택한 상태에서 그늘·무료 배지가 보여야 하는 값 — 위 조합과 같다.
    const withParking = filterChipMatchCounts(sd1, selectionOf('parking'));
    expect(withParking.get('shadeMany')).toBe(5);
    expect(withParking.get('freeAccess')).toBe(4);
    // 이미 선택된 칩 자신의 배지는 그 선택을 유지한 개수(=주차장 단독 개수).
    expect(withParking.get('parking')).toBe(15);
  });

  it('정보가 없어 제외된 계곡 수 — 무료 15(30−15) · 야영 21(30−9)', () => {
    expect(filterValleys(sd1, selectionOf('freeAccess')).excludedByMissingInfo).toBe(15);
    expect(filterValleys(sd1, selectionOf('camping')).excludedByMissingInfo).toBe(21);
    // 화장실·주차장·그늘은 정보 없음이 없다 — 시설 존재 여부·`shadeByHour` 산출은
    // SD1 30계곡 전부에 있다(N5 실측과 같다).
    expect(filterValleys(sd1, selectionOf('restroom')).excludedByMissingInfo).toBe(0);
    expect(filterValleys(sd1, selectionOf('shadeMany')).excludedByMissingInfo).toBe(0);
  });

  it('칩이 하나도 없으면 그대로(같은 참조) — 핀도 필요 없다', () => {
    const result = filterValleys(sd1, selectionOf());
    expect(result.valleys).toBe(sd1);
    expect(result.excludedByMissingInfo).toBe(0);
  });

  it('선택된 계곡은 필터를 이긴다(해석 4) — 주차장이 없는 계곡도 핀이면 남는다', () => {
    const withoutParking = sd1.find((valley) => valley.facilitiesOf('parking').length === 0);
    if (withoutParking === undefined) throw new Error('fixture — 주차장 없는 계곡이 있어야 한다');

    const unpinned = filterValleys(sd1, selectionOf('parking'));
    expect(unpinned.valleys.some((valley) => valley.id === withoutParking.id)).toBe(false);

    const pinned = filterValleys(sd1, selectionOf('parking'), withoutParking.id);
    expect(pinned.valleys.some((valley) => valley.id === withoutParking.id)).toBe(true);
    // 핀 고정된 계곡은 "정보 없어 제외" 로 세지 않는다.
    expect(pinned.excludedByMissingInfo).toBe(unpinned.excludedByMissingInfo);
  });
});

describe('evaluateFilterChips — 판정 우선순위', () => {
  const facility = (type: 'restroom' | 'parking') =>
    new Facility({
      id: toFacilityId(`f-${type}`),
      valleyId: toValleyId('v'),
      name: '시설',
      facilityType: type,
      position: LngLat.of(127, 37),
    });

  function segment(props: { freeAccess?: boolean; shadeByHour?: readonly number[] }): Segment {
    return new Segment({
      id: toSegmentId('s1'),
      valleyId: toValleyId('v'),
      valleyName: '계곡',
      position: 'whole',
      order: 0,
      path: [LngLat.of(127, 37), LngLat.of(127.01, 37.01)],
      ...props,
    });
  }

  it('확실한 배제가 정보 없음보다 강하다 — 주차장 없음(확실) + 무료 모름 = no-match', () => {
    const valley = ValleyClass.create({
      id: toValleyId('v'),
      name: '계곡',
      segments: [segment({ freeAccess: undefined })],
      facilities: [facility('restroom')], // 주차장 시설이 없다 → parking = false
    });
    if (!valley.ok) throw valley.error;
    const outcome = evaluateFilterChips(valley.value, new Set(['parking', 'freeAccess']));
    expect(outcome).toBe('no-match');
  });

  it('배제가 없고 정보 없음만 있으면 no-info', () => {
    const valley = ValleyClass.create({
      id: toValleyId('v'),
      name: '계곡',
      segments: [segment({ freeAccess: undefined })],
      facilities: [facility('parking')],
    });
    if (!valley.ok) throw valley.error;
    const outcome = evaluateFilterChips(valley.value, new Set(['parking', 'freeAccess']));
    expect(outcome).toBe('no-info');
  });

  it('전부 판정되고 전부 참이면 match', () => {
    const valley = ValleyClass.create({
      id: toValleyId('v'),
      name: '계곡',
      // 종일 평균 0.6 — shadeTags 의 many 경계(0.5) 위, N5 카드 배지와 같은 술어.
      segments: [segment({ freeAccess: true, shadeByHour: new Array(9).fill(0.6) })],
      facilities: [facility('parking')],
    });
    if (!valley.ok) throw valley.error;
    const outcome = evaluateFilterChips(
      valley.value,
      new Set(['parking', 'freeAccess', 'shadeMany']),
    );
    expect(outcome).toBe('match');
  });

  it('칩 5종 키가 결정 (a) 의 순서와 같다', () => {
    expect(FILTER_CHIP_KEYS).toEqual(['restroom', 'parking', 'freeAccess', 'camping', 'shadeMany']);
  });
});
