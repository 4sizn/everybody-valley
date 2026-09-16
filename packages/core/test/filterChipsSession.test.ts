/**
 * N1 조건 필터 칩 — 세션 배선 테스트(가짜 지도 엔진).
 *
 * `filterChips.test.ts` 가 술어·개수(순수 함수)를 실측으로 고정한다면, 여기는
 * "칩을 토글하면 지도가 실제로 다시 그려지는가" · "선택된 계곡이 필터를 이기는가"
 * (해석 4) · "그늘도 함께 걸리는가"(해석 2·3) · "칩은 저장되지 않는가" 를 본다.
 *
 * 픽스처는 실데이터 대신 최소 2계곡을 코드로 직접 만든다(GeoJSON 파싱 없이) —
 * 이 파일이 보려는 것은 개수가 아니라 배선이라 합성 데이터가 더 명확하다.
 *   alpha — 주차장 있음 · 무료 · 야영 불가 · 그늘 많음(종일 평균 0.6, `shadeTags` 기준) · 그늘 폴리곤 있음
 *   beta  — 주차장 없음 · 무료 정보 없음 · 야영 가능 · 그늘 적음(종일 평균 0.1) · 그늘 폴리곤 없음
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { MapSession } from '../src/application/MapSession';
import { STORAGE_KEYS } from '../src/application/ports/StoragePort';
import { InMemoryValleyRepository } from '../src/data/InMemoryValleyRepository';
import { MemoryStorage } from '../src/data/MemoryStorage';
import { INITIAL_VIEW } from '../src/domain/camera/CameraPresets';
import { LngLat } from '../src/domain/geo/LngLat';
import { Facility } from '../src/domain/valley/Facility';
import { toFacilityId, toSegmentId, toValleyId } from '../src/domain/valley/ids';
import { Segment, SHADE_HOUR_COUNT } from '../src/domain/valley/Segment';
import type { ShadePolygon, ShadeRing, ValleyShade } from '../src/domain/valley/Shade';
import { Valley } from '../src/domain/valley/Valley';
import {
  COORDINATE_ORDER,
  DATASET_CRS,
  type DatasetMetadata,
  type ValleyDataset,
} from '../src/domain/valley/ValleyDataset';
import { NONE_CANCELLATION_TOKEN } from '../src/shared/async/cancellation';
import { NoopLogger } from '../src/shared/logger/NoopLogger';
import { FAKE_CAPABILITIES, FakeMapEngine } from './doubles/FakeMapEngine';

const logger = new NoopLogger();

const METADATA: DatasetMetadata = {
  description: 'N1 픽스처',
  source: 'test',
  sourceFile: undefined,
  datasetVersion: 'test',
  collectedAt: '2026-09-07',
  coordinateOrder: COORDINATE_ORDER,
  crs: DATASET_CRS,
  filter: undefined,
  verified: undefined,
  sources: undefined,
};

const RING: ShadeRing = [
  [127, 37],
  [127.001, 37],
  [127.001, 37.001],
  [127, 37.001],
  [127, 37],
];
const POLYGON: ShadePolygon = [RING];

function segment(props: {
  id: string;
  valleyId: string;
  freeAccess?: boolean;
  campingAllowed?: boolean;
  /** 종일 평균 그늘 비율 — 9칸 모두 이 값(그늘 많음 칩은 `shadeTags` 의 종일 평균 기준). */
  dayAverageShade: number;
}): Segment {
  return new Segment({
    id: toSegmentId(props.id),
    valleyId: toValleyId(props.valleyId),
    valleyName: props.valleyId,
    position: 'whole',
    order: 0,
    path: [LngLat.of(127, 37), LngLat.of(127.01, 37.01)],
    canopyCover: props.dayAverageShade,
    shadeByHour: new Array(SHADE_HOUR_COUNT).fill(props.dayAverageShade),
    ...(props.freeAccess === undefined ? {} : { freeAccess: props.freeAccess }),
    ...(props.campingAllowed === undefined ? {} : { campingAllowed: props.campingAllowed }),
  });
}

function buildDataset(): { dataset: ValleyDataset; alpha: Valley; beta: Valley } {
  const alphaSegment = segment({
    id: 'alpha-1',
    valleyId: 'alpha',
    freeAccess: true,
    campingAllowed: false,
    dayAverageShade: 0.6,
  });
  const alphaParking = new Facility({
    id: toFacilityId('alpha-parking'),
    valleyId: toValleyId('alpha'),
    name: '알파 주차장',
    facilityType: 'parking',
    position: LngLat.of(127, 37),
  });
  const alphaResult = Valley.create({
    id: toValleyId('alpha'),
    name: '알파계곡',
    segments: [alphaSegment],
    facilities: [alphaParking],
  });
  if (!alphaResult.ok) throw alphaResult.error;

  const betaSegment = segment({
    id: 'beta-1',
    valleyId: 'beta',
    campingAllowed: true,
    dayAverageShade: 0.1,
  });
  const betaResult = Valley.create({
    id: toValleyId('beta'),
    name: '베타계곡',
    segments: [betaSegment],
  });
  if (!betaResult.ok) throw betaResult.error;

  const alpha = alphaResult.value;
  const beta = betaResult.value;

  const alphaShade: ValleyShade = {
    valleyId: alpha.id,
    canopy: [POLYGON],
    shadowByHour: new Array(SHADE_HOUR_COUNT).fill([POLYGON]) as readonly (typeof POLYGON)[][],
    metadata: { representativeDate: '2026-08-01', chmAcquisition: [], source: 'test' },
  };

  return {
    dataset: {
      metadata: METADATA,
      valleys: [alpha, beta],
      shade: new Map([[alpha.id, alphaShade]]),
    },
    alpha,
    beta,
  };
}

function createSession() {
  const { dataset, alpha, beta } = buildDataset();
  const engine = new FakeMapEngine(
    logger,
    {
      center: LngLat.of(127, 37),
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
    },
    FAKE_CAPABILITIES,
  );
  const storage = new MemoryStorage();
  const session = new MapSession({
    scene: 'valley',
    engine,
    valleyRepository: new InMemoryValleyRepository(dataset),
    storage,
    logger,
  });
  return { session, engine, storage, alpha, beta };
}

describe('N1 필터 칩 — 세션 배선', () => {
  let ctx: ReturnType<typeof createSession>;

  beforeEach(async () => {
    ctx = createSession();
    await ctx.session.initialize(NONE_CANCELLATION_TOKEN);
  });

  it('첫 렌더는 필터가 없다 — 두 계곡 모두 보인다', () => {
    const { engine } = ctx;
    const first = engine.contents[0];
    expect(first?.segments).toHaveLength(2);
    expect(first?.facilities).toHaveLength(1);
    expect(ctx.session.store.state.filterChips.size).toBe(0);
  });

  it('칩을 고르면 지도를 다시 그리고 상태에 남는다 — 주차장은 alpha 만', () => {
    const { session, engine } = ctx;
    const result = session.toggleFilterChip('parking');
    expect(result.ok).toBe(true);
    expect(session.store.state.filterChips).toEqual(new Set(['parking']));

    const last = engine.contents.at(-1);
    expect(last?.segments.map((s) => s.id)).toEqual([ctx.alpha.segments[0]?.id]);
    expect(last?.facilities).toHaveLength(1);
  });

  it('다시 누르면 해제되고 두 계곡이 돌아온다', () => {
    const { session, engine } = ctx;
    session.toggleFilterChip('parking');
    session.toggleFilterChip('parking');

    expect(session.store.state.filterChips.size).toBe(0);
    expect(engine.contents.at(-1)?.segments).toHaveLength(2);
  });

  it('그늘도 걸러진 계곡과 함께 빠진다(해석 2·3) — beta 만 남으면 그늘은 null', async () => {
    const { session, engine } = ctx;
    await session.toggleShade(); // 그늘 켜기 — alpha 의 캐노피가 보여야 한다
    expect(engine.contents.at(-1)?.shade?.canopy).toEqual([POLYGON]);

    // 야영 가능은 beta 만 참(alpha 는 명시적으로 false) — alpha 가 걸러지고 beta 만 남는다.
    session.toggleFilterChip('camping');
    const filtered = engine.contents.at(-1);
    expect(filtered?.segments.map((s) => s.id)).toEqual([ctx.beta.segments[0]?.id]);
    expect(filtered?.facilities).toHaveLength(0);
    // beta 는 그늘 데이터가 없다 — alpha 가 빠지면 그늘도 통째로 사라진다.
    expect(filtered?.shade).toBeNull();
  });

  it('선택된 계곡은 필터를 이긴다(해석 4) — 상세를 열면 걸러졌던 계곡도 지도에 남는다', async () => {
    const { session, engine, alpha, beta } = ctx;
    session.toggleFilterChip('camping'); // alpha 제외, beta 만
    expect(engine.contents.at(-1)?.segments.map((s) => s.id)).toEqual([beta.segments[0]?.id]);

    const alphaSegmentId = alpha.segments[0]?.id;
    if (alphaSegmentId === undefined) throw new Error('fixture');
    await session.selectSegment(alphaSegmentId);

    const pinned = engine.contents.at(-1);
    expect(pinned?.segments.map((s) => s.id).sort()).toEqual(
      [alpha.segments[0]?.id, beta.segments[0]?.id].sort(),
    );

    // 상세를 닫으면 핀이 풀려 alpha 가 다시 걸린다.
    await session.clearSelection();
    const unpinned = engine.contents.at(-1);
    expect(unpinned?.segments.map((s) => s.id)).toEqual([beta.segments[0]?.id]);
  });

  it('칩 선택은 저장하지 않는다 — 같은 스토리지로 새 세션을 열어도 빈 선택', async () => {
    const { session, storage } = ctx;
    session.toggleFilterChip('parking');
    expect(session.store.state.filterChips.size).toBe(1);
    session.dispose();

    const { dataset } = buildDataset();
    const engine2 = new FakeMapEngine(logger, {
      center: LngLat.of(127, 37),
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
    });
    const session2 = new MapSession({
      scene: 'valley',
      engine: engine2,
      valleyRepository: new InMemoryValleyRepository(dataset),
      storage,
      logger,
    });
    await session2.initialize(NONE_CANCELLATION_TOKEN);
    expect(session2.store.state.filterChips.size).toBe(0);
    // 참고 — 그늘 토글 같은 값은 저장된다(STORAGE_KEYS.shadeVisible). 필터 칩엔 그런 키가 없다.
    const shadeSaved = await storage.read(STORAGE_KEYS.shadeVisible, NONE_CANCELLATION_TOKEN);
    expect(shadeSaved.ok && shadeSaved.value).toBeNull();
    session2.dispose();
  });
});
