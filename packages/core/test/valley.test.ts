/**
 * 계곡 도메인 테스트 — 애그리게이트 불변식과 valley-ds 정규화 결정을 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { LngLat } from '../src/domain/geo/LngLat';
import {
  CROWD_STATUSES,
  CrowdSnapshot,
  crowdStatusLabel,
} from '../src/domain/valley/CrowdSnapshot';
import { lookupFacility, lookupSegment } from '../src/domain/valley/catalog';
import { FACILITY_TYPES, Facility, facilityTypeLabel } from '../src/domain/valley/Facility';
import { toFacilityId, toSegmentId, toStationCode, toValleyId } from '../src/domain/valley/ids';
import {
  SEGMENT_POSITIONS,
  Segment,
  type SegmentPosition,
  SHADE_HOUR_COUNT,
  SHADE_HOURS,
  SHADE_NOON_INDEX,
  SPLIT_BASES,
  segmentPositionLabel,
} from '../src/domain/valley/Segment';
import {
  formatShadePercent,
  noonShadeRatio,
  segmentSubtitle,
  segmentTitle,
} from '../src/domain/valley/segmentSubtitle';
import { UpstreamAlert } from '../src/domain/valley/UpstreamAlert';
import { Valley } from '../src/domain/valley/Valley';
import { VERIFICATION_LEVELS, verificationLabel } from '../src/domain/valley/ValleyDataset';
import { summarizeValleys } from '../src/domain/valley/ValleySummary';

const SAMPLE = toValleyId('sample');

function segment(id: string, order: number, position: SegmentPosition, valleyId = SAMPLE): Segment {
  return new Segment({
    id: toSegmentId(id),
    valleyId,
    valleyName: '샘플계곡',
    position,
    order,
    path: [
      LngLat.of(127.2612 + order * 0.003, 37.8341 - order * 0.002),
      LngLat.of(127.2628 + order * 0.003, 37.8329 - order * 0.002),
    ],
  });
}

function facility(
  id: string,
  type: Facility['facilityType'],
  valleyId = SAMPLE,
  position = LngLat.of(127.27, 37.826),
): Facility {
  return new Facility({
    id: toFacilityId(id),
    valleyId,
    name: id,
    facilityType: type,
    position,
  });
}

function valleyOf(segments: readonly Segment[], facilities: readonly Facility[] = []): Valley {
  const created = Valley.create({ id: SAMPLE, name: '샘플계곡', segments, facilities });
  if (!created.ok) throw created.error;
  return created.value;
}

describe('그늘 시각 축 (D6/P1)', () => {
  it('shadeByHour 는 KST 10~18 정시 9개, 정오는 인덱스 2', () => {
    expect(SHADE_HOURS).toEqual([
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
    ]);
    expect(SHADE_HOUR_COUNT).toBe(9);
    expect(SHADE_NOON_INDEX).toBe(2);
  });

  it('Segment 는 shadeByHour · canopyCover 를 그대로 실어 나른다', () => {
    const base = segment('sample-upper', 0, 'upper');
    const shaded = new Segment({
      id: base.id,
      valleyId: base.valleyId,
      valleyName: base.valleyName,
      position: base.position,
      order: base.order,
      path: base.path,
      shadeByHour: [0.39, 0.38, 0.38, 0.38, 0.38, 0.38, 0.39, 0.43, 0.62],
      canopyCover: 0.381,
      shadeRatio: 0.38,
    });
    expect(shaded.shadeByHour?.[SHADE_NOON_INDEX]).toBe(0.38);
    expect(shaded.canopyCover).toBe(0.381);
    expect(base.shadeByHour).toBeUndefined();
  });
});

describe('valley-ds 정규화 결정 (C3)', () => {
  it('혼잡 3단계는 available / low / busy — 팔레트의 empty 는 들이지 않는다', () => {
    expect(CROWD_STATUSES).toEqual(['available', 'low', 'busy']);
    expect((CROWD_STATUSES as readonly string[]).includes('empty')).toBe(false);
    expect(crowdStatusLabel('busy')).toBe('혼잡');
  });

  it('시설 10종은 store 를 쓰고 convenience 는 들이지 않는다', () => {
    expect(FACILITY_TYPES).toHaveLength(10);
    expect((FACILITY_TYPES as readonly string[]).includes('store')).toBe(true);
    expect((FACILITY_TYPES as readonly string[]).includes('convenience')).toBe(false);
    for (const type of FACILITY_TYPES) expect(facilityTypeLabel(type).length).toBeGreaterThan(0);
  });
});

describe('Segment', () => {
  it('두 점 미만은 선이 아니다 — 생성자가 던진다', () => {
    expect(
      () =>
        new Segment({
          id: toSegmentId('x'),
          valleyId: SAMPLE,
          valleyName: '샘플계곡',
          position: 'upper',
          order: 0,
          path: [LngLat.of(127, 37)],
        }),
    ).toThrow(RangeError);
  });

  it('start / end / length 는 좌표열에서 파생된다', () => {
    const upper = segment('sample-upper', 0, 'upper');
    expect(upper.start.equals(upper.path[0] as LngLat)).toBe(true);
    expect(upper.end.equals(upper.path[1] as LngLat)).toBe(true);
    expect(upper.length().meters).toBeGreaterThan(100);
    expect(upper.length().meters).toBeLessThan(300);
  });

  it('선택 속성은 주지 않으면 undefined 로 남는다', () => {
    const upper = segment('sample-upper', 0, 'upper');
    expect(upper.depth).toBeUndefined();
    expect(upper.shadeRatio).toBeUndefined();
    expect(upper.swimBanned).toBeUndefined();
  });
});

describe('Valley 애그리게이트', () => {
  it('구간을 order 오름차순으로 정렬해 들고 있다', () => {
    const valley = Valley.create({
      id: SAMPLE,
      name: '샘플계곡',
      segments: [
        segment('lower', 2, 'lower'),
        segment('upper', 0, 'upper'),
        segment('mid', 1, 'mid'),
      ],
    });
    expect(valley.ok).toBe(true);
    if (!valley.ok) return;
    expect(valley.value.segments.map((s) => s.id)).toEqual(['upper', 'mid', 'lower']);
  });

  it('구간이 없으면 만들지 못한다', () => {
    const valley = Valley.create({ id: SAMPLE, name: '샘플계곡', segments: [] });
    expect(valley.ok).toBe(false);
    if (valley.ok) return;
    expect(valley.error.code).toBe('valley/empty-valley');
  });

  it('다른 계곡의 구간·시설이 섞이면 거절한다', () => {
    const other = toValleyId('other');
    const straySegment = Valley.create({
      id: SAMPLE,
      name: '샘플계곡',
      segments: [segment('a', 0, 'upper'), segment('b', 1, 'mid', other)],
    });
    expect(straySegment.ok).toBe(false);
    if (!straySegment.ok) expect(straySegment.error.code).toBe('valley/inconsistent-segments');

    const strayFacility = Valley.create({
      id: SAMPLE,
      name: '샘플계곡',
      segments: [segment('a', 0, 'upper')],
      facilities: [facility('p1', 'parking', other)],
    });
    expect(strayFacility.ok).toBe(false);
  });

  it('findSegment / segmentsAt / facilitiesOf', () => {
    const valley = Valley.create({
      id: SAMPLE,
      name: '샘플계곡',
      segments: [
        segment('upper', 0, 'upper'),
        segment('mid-a', 1, 'mid'),
        segment('mid-b', 2, 'mid'),
      ],
      facilities: [facility('p1', 'parking'), facility('p2', 'parking'), facility('s1', 'store')],
    });
    if (!valley.ok) throw valley.error;
    const v = valley.value;
    expect(v.findSegment(toSegmentId('mid-a')).ok).toBe(true);
    const missing = v.findSegment(toSegmentId('nope'));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('valley/segment-not-found');
    expect(v.segmentsAt('mid').map((s) => s.id)).toEqual(['mid-a', 'mid-b']);
    expect(v.facilitiesOf('parking')).toHaveLength(2);
    expect(v.facilitiesOf('store')).toHaveLength(1);
    expect(v.facilitiesOf('cafe')).toHaveLength(0);
  });
});

describe('런타임 관측값', () => {
  it('CrowdSnapshot 은 구간 범위인지 계곡 전체인지 안다', () => {
    const whole = new CrowdSnapshot({
      valleyId: SAMPLE,
      level: 'low',
      observedAt: '2026-09-03T10:00:00+09:00',
      source: 'report',
    });
    const scoped = new CrowdSnapshot({
      valleyId: SAMPLE,
      segmentId: toSegmentId('sample-mid'),
      level: 'busy',
      observedAt: '2026-09-03T10:00:00+09:00',
      source: 'checkin',
      sampleCount: 4,
    });
    expect(whole.isSegmentScoped).toBe(false);
    expect(scoped.isSegmentScoped).toBe(true);
  });

  it('UpstreamAlert 는 clearedAt 이 없으면 유효하다', () => {
    const alert = new UpstreamAlert({
      valleyId: SAMPLE,
      stationCode: toStationCode('SAMPLE-UP-01'),
      level: 'warning',
      source: 'gauge',
      confidence: 'observed',
      rainfall10mMm: 12.5,
      observedAt: '2026-09-03T09:55:00+09:00',
      issuedAt: '2026-09-03T10:00:00+09:00',
    });
    expect(alert.isActive).toBe(true);
    expect(alert.clearedAt).toBeNull();
    expect(alert.verified).toBeNull();
    const cleared = new UpstreamAlert({ ...alert, clearedAt: '2026-09-03T11:00:00+09:00' });
    expect(cleared.isActive).toBe(false);
  });
});

describe('Segment.midpoint — 길이 기준 중간점 (F1)', () => {
  it('두 점 구간은 두 점의 가운데', () => {
    const line = new Segment({
      id: toSegmentId('two'),
      valleyId: SAMPLE,
      valleyName: '샘플계곡',
      position: 'mid',
      order: 0,
      path: [LngLat.of(127.26, 37.83), LngLat.of(127.27, 37.84)],
    });
    const mid = line.midpoint();
    expect(mid.lng).toBeCloseTo(127.265, 9);
    expect(mid.lat).toBeCloseTo(37.835, 9);
  });

  it('점이 한쪽에 몰려 있어도 가운데 **점**이 아니라 길이의 절반 지점을 고른다', () => {
    // 첫 구간(0→1)이 두 번째·세 번째 구간을 합친 것보다 길다. 좌표열의 가운데 점은
    // 1 이지만 길이 절반은 0→1 위에 있다.
    const line = new Segment({
      id: toSegmentId('uneven'),
      valleyId: SAMPLE,
      valleyName: '샘플계곡',
      position: 'mid',
      order: 0,
      path: [LngLat.of(127.26, 37.83), LngLat.of(127.28, 37.83), LngLat.of(127.281, 37.83)],
    });
    const mid = line.midpoint();
    expect(mid.lat).toBeCloseTo(37.83, 9);
    // 전체 길이 ≈ 0.021도, 절반 ≈ 0.0105도 → lng 127.2705
    expect(mid.lng).toBeCloseTo(127.2705, 6);
    expect(mid.lng).toBeLessThan(127.28);
  });
});

describe('Valley 조회 보조 (F1)', () => {
  const upper = segment('upper', 0, 'upper');
  const mid = segment('mid', 1, 'mid');
  const lower = segment('lower', 2, 'lower');
  const nearParking = facility('p-near', 'parking', SAMPLE, LngLat.of(127.2645, 37.8317));
  const farParking = facility('p-far', 'parking', SAMPLE, LngLat.of(127.2725, 37.8262));
  const store = facility('s1', 'store', SAMPLE, LngLat.of(127.2643, 37.8319));
  const valley = valleyOf([lower, upper, mid], [farParking, store, nearParking]);

  it('center 는 모든 구간 좌표의 경계 상자 가운데', () => {
    const center = valley.center();
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    for (const s of valley.segments) {
      for (const p of s.path) {
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
      }
    }
    expect(center.lng).toBeCloseTo((minLng + maxLng) / 2, 12);
    expect(center.lat).toBeCloseTo((minLat + maxLat) / 2, 12);
  });

  it('nearestFacility 는 종류를 걸러 가장 가까운 것과 거리를 준다', () => {
    const from = upper.start;
    const nearest = valley.nearestFacility(from, 'parking');
    expect(nearest?.facility.id).toBe('p-near');
    expect(nearest?.distance.meters).toBeCloseTo(nearParking.distanceFrom(from).meters, 6);
    // 종류를 생략하면 가장 가까운 것은 매점이다(주차장보다 상류 끝에 더 가깝다).
    expect(valley.nearestFacility(from)?.facility.id).toBe('s1');
    // 그 종류가 하나도 없으면 undefined — "주차장 ??m" 을 만들지 않는다.
    expect(valley.nearestFacility(from, 'restroom')).toBeUndefined();
    // 기준점이 하류 끝이면 답이 바뀐다.
    expect(valley.nearestFacility(lower.end, 'parking')?.facility.id).toBe('p-far');
  });

  it('facilitiesByDistance 는 가까운 순', () => {
    const ordered = valley.facilitiesByDistance(upper.start).map((entry) => entry.facility.id);
    expect(ordered).toEqual(['s1', 'p-near', 'p-far']);
  });

  it('findFacility 는 시설 id 로, 없으면 valley/facility-not-found', () => {
    expect(valley.findFacility(toFacilityId('s1')).ok).toBe(true);
    const missing = valley.findFacility(toFacilityId('nope'));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('valley/facility-not-found');
  });

  it('lookupSegment / lookupFacility 는 여러 계곡을 가로질러 찾고 소속 계곡을 함께 준다', () => {
    const other = toValleyId('other');
    const otherValley = Valley.create({
      id: other,
      name: '다른계곡',
      segments: [segment('o-upper', 0, 'upper', other)],
      facilities: [facility('o-p', 'parking', other)],
    });
    if (!otherValley.ok) throw otherValley.error;
    const valleys = [valley, otherValley.value];

    const seg = lookupSegment(valleys, toSegmentId('o-upper'));
    expect(seg.ok && seg.value.valley.id).toBe(other);
    const fac = lookupFacility(valleys, toFacilityId('p-far'));
    expect(fac.ok && fac.value.valley.id).toBe(SAMPLE);

    const noSeg = lookupSegment(valleys, toSegmentId('nope'));
    expect(!noSeg.ok && noSeg.error.code).toBe('valley/segment-not-found');
    const noFac = lookupFacility(valleys, toFacilityId('nope'));
    expect(!noFac.ok && noFac.error.code).toBe('valley/facility-not-found');
  });
});

describe('segmentSubtitle — 카드 부제 (F1)', () => {
  const base = {
    id: toSegmentId('mid'),
    valleyId: SAMPLE,
    valleyName: '샘플계곡',
    position: 'mid',
    order: 1,
    path: [LngLat.of(127.26, 37.83), LngLat.of(127.27, 37.84)],
  } as const;

  it('전부 있으면 "중류 · 허리 · 자갈 · 주차장 320m"', () => {
    const seg = new Segment({ ...base, depth: 'waist', bed: 'gravel' });
    expect(segmentSubtitle(seg, 320)).toBe('중류 · 허리 · 자갈 · 주차장 320m');
  });

  it('없는 속성은 생략하고 위치만 남는다', () => {
    const seg = new Segment({ ...base, position: 'upper' });
    expect(segmentSubtitle(seg)).toBe('상류');
    expect(segmentSubtitle(new Segment({ ...base, bed: 'rock' }))).toBe('중류 · 암반');
  });

  it('주차장 거리는 Distance.format 표기를 따른다 — 1km 이상은 소수 한 자리 km', () => {
    const seg = new Segment({ ...base, depth: 'knee' });
    expect(segmentSubtitle(seg, 1240)).toBe('중류 · 무릎 · 주차장 1.2km');
    expect(segmentSubtitle(seg, 0)).toBe('중류 · 무릎 · 주차장 0m');
  });

  it('유효하지 않은 거리(음수·NaN)는 주차장 항목을 뺀다', () => {
    const seg = new Segment({ ...base, depth: 'knee' });
    expect(segmentSubtitle(seg, -1)).toBe('중류 · 무릎');
    expect(segmentSubtitle(seg, Number.NaN)).toBe('중류 · 무릎');
  });
});

describe('segmentTitle · segmentSubtitle 옵션 — 카드 제목/부제 분리 (V1 (d))', () => {
  const base = {
    id: toSegmentId('mid'),
    valleyId: SAMPLE,
    valleyName: '샘플계곡',
    position: 'mid',
    order: 1,
    path: [LngLat.of(127.26, 37.83), LngLat.of(127.27, 37.84)],
  } as const;
  const shadeByHour = [0.4, 0.5, 0.62, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];

  it('제목은 "위치 · 수심", 수심이 없으면 위치만 — 계곡명은 없다', () => {
    expect(segmentTitle(new Segment({ ...base, depth: 'waist', bed: 'gravel' }))).toBe(
      '중류 · 허리',
    );
    expect(segmentTitle(new Segment({ ...base, position: 'upper' }))).toBe('상류');
  });

  it('afterTitle 부제는 바닥부터 — "자갈 · 주차장 320m · 그늘 62%"', () => {
    const seg = new Segment({ ...base, depth: 'waist', bed: 'gravel', shadeByHour });
    expect(segmentSubtitle(seg, 320, { afterTitle: true, shade: true })).toBe(
      '자갈 · 주차장 320m · 그늘 62%',
    );
    // 옵션 없는 기본은 F1 문장 그대로 — 상세 시트가 쓴다.
    expect(segmentSubtitle(seg, 320)).toBe('중류 · 허리 · 자갈 · 주차장 320m');
  });

  it('그늘 데이터가 없으면 그늘 조각을 생략하고, 전부 없으면 빈 문자열', () => {
    const bare = new Segment({ ...base });
    expect(segmentSubtitle(bare, undefined, { afterTitle: true, shade: true })).toBe('');
    expect(
      segmentSubtitle(new Segment({ ...base, bed: 'rock' }), 1240, {
        afterTitle: true,
        shade: true,
      }),
    ).toBe('암반 · 주차장 1.2km');
  });

  it('정오 그늘은 shadeByHour 의 정오 칸이 우선, 없으면 shadeRatio, 반올림은 정수 %', () => {
    expect(noonShadeRatio(new Segment({ ...base, shadeByHour, shadeRatio: 0.1 }))).toBe(0.62);
    expect(noonShadeRatio(new Segment({ ...base, shadeRatio: 0.335 }))).toBe(0.335);
    expect(noonShadeRatio(new Segment({ ...base }))).toBeUndefined();
    expect(formatShadePercent(0.335)).toBe('34%');
    expect(formatShadePercent(0)).toBe('0%');
    expect(
      segmentSubtitle(new Segment({ ...base, shadeRatio: 0.335 }), undefined, { shade: true }),
    ).toBe('중류 · 그늘 34%');
  });
});

describe('summarizeValleys — 목록 요약 (V1 (e))', () => {
  it('계곡·구간·시설 수와 그늘 있는 구간만의 정오 평균', () => {
    const shaded = new Segment({
      id: toSegmentId('s1'),
      valleyId: SAMPLE,
      valleyName: '샘플계곡',
      position: 'upper',
      order: 0,
      path: [LngLat.of(127.26, 37.83), LngLat.of(127.27, 37.84)],
      shadeByHour: [0, 0, 0.4, 0, 0, 0, 0, 0, 0],
    });
    const shaded2 = new Segment({
      id: toSegmentId('s2'),
      valleyId: SAMPLE,
      valleyName: '샘플계곡',
      position: 'mid',
      order: 1,
      path: [LngLat.of(127.27, 37.84), LngLat.of(127.28, 37.85)],
      shadeRatio: 0.8,
    });
    const bare = segment('s3', 2, 'lower');
    const valley = new Valley({
      id: SAMPLE,
      name: '샘플계곡',
      segments: [shaded, shaded2, bare],
      facilities: [facility('f1', 'parking'), facility('f2', 'restroom')],
    });
    const summary = summarizeValleys([valley]);
    expect(summary).toMatchObject({ valleys: 1, segments: 3, facilities: 2 });
    expect(summary.noonShadeAverage).toBeCloseTo(0.6, 10);
  });

  it('그늘 데이터가 하나도 없으면 평균은 null, 빈 목록은 전부 0', () => {
    const valley = new Valley({
      id: SAMPLE,
      name: '샘플계곡',
      segments: [segment('a', 0, 'upper')],
      facilities: [],
    });
    expect(summarizeValleys([valley]).noonShadeAverage).toBeNull();
    expect(summarizeValleys([])).toEqual({
      valleys: 0,
      segments: 0,
      facilities: 0,
      noonShadeAverage: null,
    });
  });
});

describe('1구간 계곡 whole · 분할 근거 · 검수 수준 (SD1 (c)(g))', () => {
  const base = {
    id: toSegmentId('baegun-whole'),
    valleyId: toValleyId('baegun'),
    valleyName: '백운계곡',
    position: 'whole',
    order: 0,
    path: [LngLat.of(127.42, 38.09), LngLat.of(127.44, 38.08)],
  } as const;

  it('위치 enum 에 whole 이 있고 라벨은 "전체"', () => {
    expect(SEGMENT_POSITIONS).toEqual(['upper', 'mid', 'lower', 'whole']);
    expect(segmentPositionLabel('whole')).toBe('전체');
  });

  it('1구간 카드 제목 — 수심이 있으면 "전체 · 무릎", 없으면 "전체"; 부제·상세 문장도 같은 규칙', () => {
    expect(segmentTitle(new Segment({ ...base, depth: 'knee' }))).toBe('전체 · 무릎');
    expect(segmentTitle(new Segment({ ...base }))).toBe('전체');
    expect(segmentSubtitle(new Segment({ ...base, depth: 'knee', bed: 'gravel' }), 320)).toBe(
      '전체 · 무릎 · 자갈 · 주차장 320m',
    );
  });

  it('splitBasis 는 선택 — 1구간은 none, 나눈 구간은 근거를 든다', () => {
    expect(SPLIT_BASES).toEqual(['toponym', 'safemap', 'facility', 'none']);
    expect(new Segment({ ...base }).splitBasis).toBeUndefined();
    expect(new Segment({ ...base, splitBasis: 'none' }).splitBasis).toBe('none');
  });

  it('계곡은 검수 수준을 들 수 있고, desk 의 라벨은 "현장 미확인"', () => {
    expect(VERIFICATION_LEVELS).toEqual(['desk', 'field']);
    expect(verificationLabel('desk')).toBe('현장 미확인');
    expect(verificationLabel('field')).toBe('현장 확인');
    const whole = new Segment({ ...base });
    const desk = Valley.create({
      id: base.valleyId,
      name: '백운계곡',
      segments: [whole],
      verified: 'desk',
    });
    const unknown = Valley.create({ id: base.valleyId, name: '백운계곡', segments: [whole] });
    if (!desk.ok || !unknown.ok) throw new Error('생성 실패');
    expect(desk.value.verified).toBe('desk');
    expect(unknown.value.verified).toBeUndefined();
    expect(desk.value.segmentsAt('whole')).toHaveLength(1);
  });
});
