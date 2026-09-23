import {
  CROWD_STATUSES,
  createSeoulFireworks2026,
  EMPTY_MAP_CONTENT,
  LAUNCH_SITE,
  type MapContent,
  type MapSelection,
} from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import {
  findLayerSetBySource,
  isInteractiveLayerSet,
  MAP_LAYER_SETS,
  sameDependencies,
} from '../src/layerSets';
import { CROWD_STATUS_COLORS } from '../src/markerPalette';
import { SEGMENT_SOURCE_ID } from '../src/segmentLayers';
import { SHADE_SOURCE_ID } from '../src/shadeLayers';
import { SPOT_SOURCE_ID } from '../src/spotLayers';
import { CROWD, FACILITIES, MID, PARKING, SEGMENTS } from './fixtures';

const festival = createSeoulFireworks2026();

const CONTENT: MapContent = {
  spots: festival.spots,
  launchSite: LAUNCH_SITE,
  segments: SEGMENTS,
  facilities: FACILITIES,
  crowd: CROWD,
  shade: null,
};

describe('MAP_LAYER_SETS', () => {
  it('종류·소스·레이어 id 가 겹치지 않고 레이어가 자기 소스를 가리킨다', () => {
    const kinds = MAP_LAYER_SETS.map((set) => set.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toEqual(
      expect.arrayContaining(['shade', 'water', 'segment', 'flow', 'spot', 'facility', 'peak']),
    );

    const sourceIds = MAP_LAYER_SETS.map((set) => set.sourceId);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);

    const layerIds = MAP_LAYER_SETS.flatMap((set) => set.layers.map((layer) => layer.id));
    expect(new Set(layerIds).size).toBe(layerIds.length);

    for (const set of MAP_LAYER_SETS) {
      for (const layer of set.layers) {
        expect('source' in layer && layer.source).toBe(set.sourceId);
      }
      const ids = set.layers.map((layer) => layer.id);
      for (const interactive of set.interactiveLayerIds) expect(ids).toContain(interactive);
    }
  });

  it('그늘 → 토지 경계 → 물줄기 면 → 구간 선 → 흐름 점선 → 시설 → 봉우리 → 명당 순서로 그린다', () => {
    const order = MAP_LAYER_SETS.map((set) => set.kind);
    expect(order).toEqual([
      'shade',
      'land',
      'water',
      'segment',
      'flow',
      'facility',
      'peak',
      'spot',
    ]);
  });

  it('그늘·토지·물줄기·흐름·봉우리는 비인터랙티브(그늘·토지는 라벨 아래), 나머지는 히트 대상·맨 위', () => {
    for (const set of MAP_LAYER_SETS) {
      if (
        set.kind === 'shade' ||
        set.kind === 'land' ||
        set.kind === 'water' ||
        set.kind === 'flow' ||
        set.kind === 'peak'
      ) {
        expect(isInteractiveLayerSet(set)).toBe(false);
        expect(set.interactiveLayerIds).toEqual([]);
        expect(set.placement).toBe(
          set.kind === 'shade' || set.kind === 'land' ? 'below-labels' : undefined,
        );
      } else {
        expect(isInteractiveLayerSet(set)).toBe(true);
        expect(set.interactiveLayerIds.length).toBeGreaterThan(0);
        expect(set.placement).toBeUndefined();
      }
    }
  });

  it('findLayerSetBySource 는 소스 id 로 종류를 찾는다', () => {
    expect(findLayerSetBySource(SEGMENT_SOURCE_ID)?.kind).toBe('segment');
    expect(findLayerSetBySource(SPOT_SOURCE_ID)?.kind).toBe('spot');
    expect(findLayerSetBySource(SHADE_SOURCE_ID)?.kind).toBe('shade');
    expect(findLayerSetBySource('없는-소스')).toBeUndefined();
  });

  it('빈 내용에서는 모든 셋이 빈 컬렉션을 만든다', () => {
    for (const set of MAP_LAYER_SETS) {
      expect(set.toFeatureCollection(EMPTY_MAP_CONTENT, null).features).toEqual([]);
    }
  });

  it('N1 필터로 계곡이 걸러지면 그늘·물줄기·구간·흐름·시설 5개 레이어가 함께 빈다', () => {
    // MapContentComposer 가 이미 계곡 단위로 걸러 넘긴다는 전제(레이어별 필터 표현식 없음) —
    // 여기서는 그 결과(구간·시설 빈 배열, 그늘 null)가 5개 레이어 모두를 비우는지만 본다.
    const filteredOut: MapContent = { ...EMPTY_MAP_CONTENT, shade: null };
    const affectedByFilter = ['shade', 'water', 'segment', 'flow', 'facility'] as const;
    for (const kind of affectedByFilter) {
      const set = MAP_LAYER_SETS.find((candidate) => candidate.kind === kind);
      if (set === undefined) throw new Error('fixture');
      expect(set.toFeatureCollection(filteredOut, null).features).toEqual([]);
    }
  });

  it('각 셋의 toFeatureCollection 이 자기 종류의 데이터만 만든다', () => {
    const byKind = new Map(MAP_LAYER_SETS.map((set) => [set.kind, set]));
    expect(byKind.get('spot')?.toFeatureCollection(CONTENT, null).features).toHaveLength(
      festival.spots.length,
    );
    expect(byKind.get('segment')?.toFeatureCollection(CONTENT, null).features).toHaveLength(3);
    expect(byKind.get('facility')?.toFeatureCollection(CONTENT, null).features).toHaveLength(2);
  });
});

describe('dependencies — 바뀐 소스만 다시 쓰기 위한 참조 목록', () => {
  const byKind = new Map(MAP_LAYER_SETS.map((set) => [set.kind, set]));
  const segmentSet = byKind.get('segment');
  const facilitySet = byKind.get('facility');
  const spotSet = byKind.get('spot');
  if (segmentSet === undefined || facilitySet === undefined || spotSet === undefined) {
    throw new Error('fixture');
  }

  it('같은 내용·같은 선택이면 세 셋 모두 같다', () => {
    for (const set of MAP_LAYER_SETS) {
      expect(
        sameDependencies(set.dependencies(CONTENT, null), set.dependencies(CONTENT, null)),
      ).toBe(true);
    }
  });

  it('첫 렌더(이전 없음)는 항상 다르다', () => {
    expect(sameDependencies(undefined, segmentSet.dependencies(CONTENT, null))).toBe(false);
  });

  it('구간 선택은 구간 소스만 바꾼다', () => {
    const selection: MapSelection = { kind: 'segment', segment: MID };
    const unselected = (set: (typeof MAP_LAYER_SETS)[number]) => set.dependencies(CONTENT, null);
    const withSegment = (set: (typeof MAP_LAYER_SETS)[number]) =>
      set.dependencies(CONTENT, selection);

    expect(sameDependencies(unselected(segmentSet), withSegment(segmentSet))).toBe(false);
    expect(sameDependencies(unselected(facilitySet), withSegment(facilitySet))).toBe(true);
    expect(sameDependencies(unselected(spotSet), withSegment(spotSet))).toBe(true);

    const selected = segmentSet.toFeatureCollection(CONTENT, selection).features;
    expect(selected.filter((f) => f.properties?.['selected'] === true)).toHaveLength(1);
  });

  it('시설 선택은 시설 소스만, 명당 선택은 어느 소스도 바꾸지 않는다', () => {
    const facility: MapSelection = { kind: 'facility', facility: PARKING };
    expect(
      sameDependencies(
        facilitySet.dependencies(CONTENT, null),
        facilitySet.dependencies(CONTENT, facility),
      ),
    ).toBe(false);
    expect(
      sameDependencies(
        segmentSet.dependencies(CONTENT, null),
        segmentSet.dependencies(CONTENT, facility),
      ),
    ).toBe(true);

    const spot = festival.spots[0];
    if (spot === undefined) throw new Error('fixture');
    const spotSelection: MapSelection = { kind: 'spot', spot };
    for (const set of MAP_LAYER_SETS) {
      expect(
        sameDependencies(set.dependencies(CONTENT, null), set.dependencies(CONTENT, spotSelection)),
      ).toBe(true);
    }
  });

  it('혼잡 맵이 새 참조면 구간 소스가 다시 쓰이고 색이 바뀐다', () => {
    const [status] = CROWD_STATUSES;
    const crowd = new Map(CROWD).set(MID.id, status);
    const next: MapContent = { ...CONTENT, crowd };
    expect(
      sameDependencies(segmentSet.dependencies(CONTENT, null), segmentSet.dependencies(next, null)),
    ).toBe(false);
    expect(
      sameDependencies(
        facilitySet.dependencies(CONTENT, null),
        facilitySet.dependencies(next, null),
      ),
    ).toBe(true);
    expect(CROWD_STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
