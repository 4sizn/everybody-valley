/**
 * 세션 통합 테스트 (가짜 지도 엔진).
 *
 * 검증하는 것은 "데모의 상호작용이 같은 결과를 낸다"이다.
 * 카메라 수치·플립 순서·내비 탭·티커 숨김·순회 비행의 방위 증가까지
 * 데모 코드에서 읽어 온 값을 그대로 기대값으로 쓴다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { MapSession } from '../src/application/MapSession';
import { STORAGE_KEYS } from '../src/application/ports/StoragePort';
import { InMemoryValleyRepository } from '../src/data/InMemoryValleyRepository';
import { MemoryStorage } from '../src/data/MemoryStorage';
import { StaticFestivalRepository } from '../src/data/StaticFestivalRepository';
import { createSeoulFireworks2026, LAUNCH_SITE } from '../src/data/seoulFireworks2026';
import { loadValleyDataset } from '../src/data/valley/loadValleyDataset';
import { INITIAL_BASE_MAP_HEALTH } from '../src/domain/basemap/BaseMapHealth';
import {
  INITIAL_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  TILTED_PITCH,
  VALLEY_DETAIL_FLAT_PITCH,
  VALLEY_DETAIL_TERRAIN_PITCH,
  VALLEY_DETAIL_ZOOM,
  VALLEY_FLAT_PITCH,
  VALLEY_OVERVIEW_OFFSET,
  VALLEY_OVERVIEW_ZOOM,
  valleyAxisBearing,
  ZOOM_STEP,
} from '../src/domain/camera/CameraPresets';
import { DEFAULT_MAP_GESTURES } from '../src/domain/camera/MapGestures';
import { viewportCenterOffset } from '../src/domain/camera/ViewportCameraOffset';
import { Report } from '../src/domain/report/Report';
import { toFacilityId, toSegmentId, toValleyId } from '../src/domain/valley/ids';
import { SHADE_NOON_INDEX } from '../src/domain/valley/Segment';
import type { ValleyDataset } from '../src/domain/valley/ValleyDataset';
import { NONE_CANCELLATION_TOKEN } from '../src/shared/async/cancellation';
import { NoopLogger } from '../src/shared/logger/NoopLogger';
import { FakeApiPort } from './doubles/FakeApiPort';
import { FAKE_CAPABILITIES, FakeMapEngine } from './doubles/FakeMapEngine';
import { shadeBundleFixture } from './doubles/shadeFixture';

const logger = new NoopLogger();
const festival = createSeoulFireworks2026();

function createSession(options: { api?: FakeApiPort } = {}) {
  const engine = new FakeMapEngine(logger, {
    center: LAUNCH_SITE,
    zoom: INITIAL_VIEW.zoom,
    pitch: INITIAL_VIEW.pitch,
    bearing: INITIAL_VIEW.bearing,
  });
  const storage = new MemoryStorage();
  const session = new MapSession({
    scene: 'festival',
    engine,
    repository: new StaticFestivalRepository(),
    storage,
    logger,
    ...(options.api === undefined ? {} : { api: options.api }),
  });
  return { session, engine, storage };
}

// ── valley 장면 픽스처 ────────────────────────────────────────────
//  구간은 `data/example-valley.geojson`(구간 3개), 시설은 여기 인라인 — 주차장 둘
//  (상류 가까운 것·하류 가까운 것)과 매점 하나. 카드 부제의 "주차장 320m" 와
//  시설 선택 흐름을 검증할 최소 구성이다.
const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_VALLEY_PATH = resolve(HERE, '../../../data/examples/example-valley.geojson');

function loadValleyFixture(): ValleyDataset {
  const segmentsRaw = JSON.parse(readFileSync(EXAMPLE_VALLEY_PATH, 'utf8')) as {
    metadata: unknown;
  };
  const facilitiesRaw = {
    type: 'FeatureCollection',
    metadata: segmentsRaw.metadata,
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [127.2606, 37.8348] },
        properties: {
          id: 'sample-parking-upper',
          valleyId: 'sample',
          name: '상류 주차장',
          facilityType: 'parking',
          capacity: 40,
          feeNote: '무료',
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [127.2728, 37.8258] },
        properties: {
          id: 'sample-parking-lower',
          valleyId: 'sample',
          name: '하류 공영주차장',
          facilityType: 'parking',
          capacity: 120,
          feeNote: '무료',
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [127.2646, 37.8316] },
        properties: {
          id: 'sample-store-1',
          valleyId: 'sample',
          name: '계곡 매점',
          facilityType: 'store',
        },
      },
    ],
  };
  // 그늘 합본(F4)도 함께 — 그늘 테스트가 같은 세션을 쓰고, 기본은 꺼져 있어 나머지 테스트에 영향이 없다.
  const dataset = loadValleyDataset(segmentsRaw, facilitiesRaw, shadeBundleFixture());
  if (!dataset.ok) throw dataset.error;
  return dataset.value;
}

const valleyDataset = loadValleyFixture();
const sampleValley = valleyDataset.valleys[0];
if (sampleValley === undefined) throw new Error('fixture');

/** KST 시각으로 `Date` 를 만든다 — KST 는 UTC+9. 기본 시각 규칙(결정 (a)) 검증용. */
function kst(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 7, 1, hour - 9, minute));
}

/**
 * C6 — 계곡 세션 테스트가 쓰는 인셋. 실제 앱은 `MapScreen` 이 세션 준비보다 먼저
 * `setViewportInsets` 를 부르므로(창 크기·시트 스냅을 재는 순간 채워진다), 여기서도
 * `initialize` 전에 이 값을 반영해 둔다 — 그래야 `focusValley`·`focusSegment` 의
 * offset 이 [0,0](측정 전 기본값)이 아니라 실제로 계산된 값으로 나온다.
 */
const VALLEY_TEST_INSETS = { top: 48, bottom: 340.65 };

function createValleySession(
  options: {
    now?: () => Date;
    storage?: MemoryStorage;
    terrain?: boolean;
    api?: FakeApiPort;
    preserveSelection?: boolean;
  } = {},
) {
  const engine = new FakeMapEngine(
    logger,
    {
      center: LAUNCH_SITE,
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
    },
    // 기본은 web 처럼 3D 지형이 있는 엔진. `terrain: false` 는 네이티브의 경우.
    { ...FAKE_CAPABILITIES, terrain: options.terrain ?? true },
  );
  const storage = options.storage ?? new MemoryStorage();
  const session = new MapSession({
    scene: 'valley',
    engine,
    valleyRepository: new InMemoryValleyRepository(valleyDataset),
    ...(options.preserveSelection === undefined
      ? {}
      : { preserveSelection: options.preserveSelection }),
    storage,
    logger,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.api === undefined ? {} : { api: options.api }),
  });
  session.setViewportInsets(VALLEY_TEST_INSETS);
  return { session, engine, storage };
}

/** 카메라 명령 열을 (motion, zoom) 로 요약 — 프리셋 호출 **순서**를 읽기 위해. */
function cameraTrail(engine: FakeMapEngine): string[] {
  return engine.moves.map(
    (move) => `${move.command.transition.motion}:z${move.command.target.zoom ?? '-'}`,
  );
}

describe('초기화', () => {
  it('데이터를 싣고 지도에 명당을 반영한다', async () => {
    const { session, engine } = createSession();
    const result = await session.initialize(NONE_CANCELLATION_TOKEN);

    expect(result.ok).toBe(true);
    expect(session.store.state.status).toBe('ready');
    expect(session.store.state.festival?.spots).toHaveLength(6);
    expect(engine.contents).toHaveLength(1);
    const content = engine.contents[0];
    expect(content?.launchSite?.equals(LAUNCH_SITE)).toBe(true);
    expect(content?.spots).toHaveLength(6);
    // festival 세션은 계곡 내용을 비워 둔 채 같은 계약을 쓴다.
    expect(content?.segments).toEqual([]);
    expect(content?.facilities).toEqual([]);
    expect(content?.crowd.size).toBe(0);
    session.dispose();
  });

  it('제스처 정책을 엔진에 정확히 한 번 내려보낸다', async () => {
    /* 이 호출이 web·android·ios 가 같은 제스처 설정을 받는 유일한 지점이다.
       엔진 기본값에 맡기면 플랫폼마다 켜진 제스처가 갈린다. */
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);

    expect(engine.gestureUpdates).toEqual([DEFAULT_MAP_GESTURES]);
    session.dispose();
  });

  it('저장된 배치를 복원한다', async () => {
    const { session, storage } = createSession();
    await storage.write(STORAGE_KEYS.spotLayout, 'tiles', NONE_CANCELLATION_TOKEN);
    await session.initialize(NONE_CANCELLATION_TOKEN);
    expect(session.store.state.spotLayout).toBe('tiles');
    session.dispose();
  });

  it('저장된 값이 없으면 행 배치로 시작한다', async () => {
    const { session } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    expect(session.store.state.spotLayout).toBe('rows');
    session.dispose();
  });
});

describe('명당 선택 (데모 openSpot)', () => {
  let ctx: ReturnType<typeof createSession>;

  beforeEach(async () => {
    ctx = createSession();
    await ctx.session.initialize(NONE_CANCELLATION_TOKEN);
  });

  it('상세를 열면 핀·내비 탭·티커·카메라가 함께 바뀐다', async () => {
    const { session, engine } = ctx;
    const spot = festival.spots[0];
    if (spot === undefined) throw new Error('fixture');

    await session.selectSpot(spot.id);
    const state = session.store.state;

    expect(state.selectedSpotId).toBe(spot.id);
    expect(state.sheetFace).toBe('detail');
    expect(state.flipPhase).toBe('idle');
    expect(state.navTab).toBe('spots');
    expect(state.tickerVisible).toBe(false);
    expect(engine.lastSelectedSpotId).toBe(spot.id);
    expect(engine.stops).toBeGreaterThan(0);

    // 데모: flyTo({zoom:15.4, pitch:64, duration:1400, offset:[0,-90]})
    const move = engine.lastMove;
    expect(move?.target.zoom).toBe(15.4);
    expect(move?.target.pitch).toBe(64);
    expect(move?.target.offset).toEqual([0, -90]);
    expect(move?.target.bearing).toBeUndefined();
    expect(move?.transition).toEqual({ motion: 'fly', durationMs: 1400, essential: true });
    session.dispose();
  });

  it('상세를 닫으면 목록으로 돌아간다', async () => {
    const { session, engine } = ctx;
    const spot = festival.spots[1];
    if (spot === undefined) throw new Error('fixture');

    await session.selectSpot(spot.id);
    await session.clearSelection();
    const state = session.store.state;

    expect(state.selectedSpotId).toBeNull();
    expect(state.sheetFace).toBe('list');
    expect(state.navTab).toBe('home');
    expect(state.tickerVisible).toBe(true);
    expect(engine.selections.at(-1)).toBeNull();

    // 데모: easeTo({zoom:13.8, pitch:62, duration:1100, offset:[0,0]})
    const move = engine.lastMove;
    expect(move?.target.zoom).toBe(13.8);
    expect(move?.target.pitch).toBe(TILTED_PITCH);
    expect(move?.target.offset).toEqual([0, 0]);
    expect(move?.transition).toEqual({ motion: 'ease', durationMs: 1100 });
    session.dispose();
  });

  it('선택이 없을 때 닫기는 무시된다', async () => {
    const { session } = ctx;
    const result = await session.clearSelection();
    expect(result.ok).toBe(false);
    expect(session.store.state.sheetFace).toBe('list');
    session.dispose();
  });

  it('없는 명당은 오류로 돌아온다', async () => {
    const { session } = ctx;
    // biome-ignore lint/suspicious/noExplicitAny: 브랜드 타입을 우회한 의도적 잘못된 입력
    const result = await session.selectSpot('없는-id' as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('festival/spot-not-found');
    session.dispose();
  });

  it('지도 마커를 누르면 같은 경로를 탄다', async () => {
    const { session, engine } = ctx;
    const spot = festival.spots[2];
    if (spot === undefined) throw new Error('fixture');

    engine.emit('feature-press', { kind: 'spot', id: spot.id });
    await new Promise((r) => setTimeout(r, 700));
    expect(session.store.state.selectedSpotId).toBe(spot.id);
    session.dispose();
  });

  it('festival 장면에서 구간·시설 press 는 무시된다 — 계곡 데이터가 없다', async () => {
    const { session, engine } = ctx;

    engine.emit('feature-press', { kind: 'segment', id: toSegmentId('sample-mid') });
    engine.emit('feature-press', { kind: 'facility', id: toFacilityId('sample-parking-1') });
    await new Promise((r) => setTimeout(r, 50));

    expect(session.store.state.selectedSpotId).toBeNull();
    expect(session.store.state.selectedSegmentId).toBeNull();
    expect(session.store.state.selectedFacilityId).toBeNull();
    expect(engine.selections).toEqual([]);

    const direct = await session.selectSegment(toSegmentId('sample-mid'));
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.error.code).toBe('async/cancelled');
    const recenter = await session.recenterValley();
    expect(recenter.ok).toBe(false);
    session.dispose();
  });

  it('지도 빈 곳을 누르면 상세가 닫힌다', async () => {
    const { session, engine } = ctx;
    const spot = festival.spots[3];
    if (spot === undefined) throw new Error('fixture');

    await session.selectSpot(spot.id);
    engine.emit('background-press', undefined);
    await new Promise((r) => setTimeout(r, 700));
    expect(session.store.state.selectedSpotId).toBeNull();
    session.dispose();
  });
});

describe('카메라 조작', () => {
  it('순회 비행은 데모처럼 목표는 증가 전, 방위는 증가 후 값을 쓴다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);

    await session.startTour();
    expect(engine.lastMove?.target.center?.equals(festival.spots[0]?.position ?? LAUNCH_SITE)).toBe(
      true,
    );
    expect(engine.lastMove?.target.bearing).toBe(47);
    expect(engine.lastMove?.target.zoom).toBe(15.4);
    expect(engine.lastMove?.target.pitch).toBe(72);
    expect(engine.lastMove?.transition.curve).toBe(1.5);

    await session.startTour();
    expect(engine.lastMove?.target.center?.equals(festival.spots[1]?.position ?? LAUNCH_SITE)).toBe(
      true,
    );
    expect(engine.lastMove?.target.bearing).toBe(94);
    session.dispose();
  });

  it('나침반은 북쪽 정렬 + 기울기 유지', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    await session.alignNorth();
    expect(engine.lastMove?.target.bearing).toBe(0);
    expect(engine.lastMove?.target.pitch).toBe(TILTED_PITCH);
    expect(engine.lastMove?.transition).toEqual({ motion: 'ease', durationMs: 800 });
    session.dispose();
  });

  it('2D/3D 토글은 현재 기울기로 방향을 정한다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);

    await session.togglePitch();
    expect(engine.lastMove?.target.pitch).toBe(0);

    await session.togglePitch();
    expect(engine.lastMove?.target.pitch).toBe(TILTED_PITCH);
    session.dispose();
  });

  it('확대·축소는 현재 줌에서 한 단계씩 움직인다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);

    await session.zoomIn();
    expect(engine.lastMove?.target.zoom).toBe(INITIAL_VIEW.zoom + ZOOM_STEP);
    // 줌만 바꾼다 — 사용자가 돌려·기울여 둔 시점을 건드리지 않는다.
    expect(engine.lastMove?.target.center).toBeUndefined();
    expect(engine.lastMove?.target.bearing).toBeUndefined();
    expect(engine.lastMove?.target.pitch).toBeUndefined();
    expect(engine.lastMove?.transition).toEqual({ motion: 'ease', durationMs: 300 });

    await session.zoomOut();
    expect(engine.lastMove?.target.zoom).toBe(INITIAL_VIEW.zoom);
    session.dispose();
  });

  it('줌 한계를 넘어서면 한계값으로 정착한다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);

    /* 유즈케이스는 현재 줌을 **스토어 스냅샷**에서 먼저 읽는다. 실제 엔진이
       그러듯 시점을 보고해 스냅샷을 갱신해야 한계 판정이 성립한다 —
       엔진 필드만 바꾸면 스토어는 이전 값을 들고 있다. */
    engine.pose = { ...engine.pose, zoom: MAX_ZOOM };
    engine.emit('camera-change', engine.pose);
    await session.zoomIn();
    expect(engine.lastMove?.target.zoom).toBe(MAX_ZOOM);

    engine.pose = { ...engine.pose, zoom: MIN_ZOOM };
    engine.emit('camera-change', engine.pose);
    await session.zoomOut();
    expect(engine.lastMove?.target.zoom).toBe(MIN_ZOOM);
    session.dispose();
  });

  it('지구본 토글은 줌 4 를 기준으로 나가고 돌아온다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);

    await session.toggleGlobe();
    expect(engine.lastMove?.target.zoom).toBe(1.5);
    expect(engine.lastMove?.transition.durationMs).toBe(3000);

    await session.toggleGlobe();
    expect(engine.lastMove?.target.zoom).toBe(INITIAL_VIEW.zoom);
    expect(engine.lastMove?.transition.durationMs).toBe(3400);
    session.dispose();
  });

  it('주변에서 찾기는 현재 방위에 70도를 더한다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    const spot = festival.spots[0];
    if (spot === undefined) throw new Error('fixture');

    await session.selectSpot(spot.id);
    const bearingBefore = engine.pose.bearing;
    await session.inspectNearby();
    expect(engine.lastMove?.target.bearing).toBe((bearingBefore + 70) % 360);
    expect(engine.lastMove?.target.zoom).toBe(16.4);
    expect(engine.lastMove?.target.pitch).toBe(74);
    session.dispose();
  });
});

describe('불꽃·배치·시트', () => {
  it('불꽃 토글은 엔진과 상태를 함께 바꾼다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);

    expect(session.store.state.fireworksEnabled).toBe(true);
    session.toggleFireworks();
    expect(engine.fireworks).toEqual([false]);
    expect(session.store.state.fireworksEnabled).toBe(false);

    session.toggleFireworks();
    expect(engine.fireworks).toEqual([false, true]);
    expect(session.store.state.fireworksEnabled).toBe(true);
    session.dispose();
  });

  it('배치를 바꾸면 저장된다', async () => {
    const { session, storage } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);

    await session.setSpotLayout('tiles');
    expect(session.store.state.spotLayout).toBe('tiles');
    const saved = await storage.read(STORAGE_KEYS.spotLayout, NONE_CANCELLATION_TOKEN);
    expect(saved.ok && saved.value).toBe('tiles');
    session.dispose();
  });

  it('같은 배치를 다시 고르면 아무 일도 하지 않는다', async () => {
    const { session, storage } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    await session.setSpotLayout('rows');
    const saved = await storage.read(STORAGE_KEYS.spotLayout, NONE_CANCELLATION_TOKEN);
    expect(saved.ok && saved.value).toBeNull();
    session.dispose();
  });

  it('시트 스냅은 기본이 half 이고, 손잡이 탭은 다음 칸으로 순환한다 (C8)', async () => {
    const { session } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    expect(session.store.state.sheetSnap).toBe('half');
    session.cycleSheetSnap();
    expect(session.store.state.sheetSnap).toBe('full');
    session.cycleSheetSnap();
    expect(session.store.state.sheetSnap).toBe('peek');
    session.cycleSheetSnap();
    expect(session.store.state.sheetSnap).toBe('half');
    session.dispose();
  });

  it('드래그 커밋은 스냅을 직접 정한다 (C8)', async () => {
    const { session } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    session.setSheetSnap('full');
    expect(session.store.state.sheetSnap).toBe('full');
    session.setSheetSnap('peek');
    expect(session.store.state.sheetSnap).toBe('peek');
    session.dispose();
  });
});

describe('계곡 장면 (valley scene)', () => {
  const segmentIds = sampleValley.segments.map((segment) => segment.id);
  const mid = sampleValley.segments[1];
  const upperParking = sampleValley.facilities[0];
  if (mid === undefined || upperParking === undefined) throw new Error('fixture');

  describe('적재', () => {
    it('계곡 데이터를 싣고 구간·시설만 지도에 반영한다 (명당·발사 지점은 비운다)', async () => {
      const { session, engine } = createValleySession();
      const result = await session.initialize(NONE_CANCELLATION_TOKEN);

      expect(result.ok).toBe(true);
      expect(session.scene).toBe('valley');
      const state = session.store.state;
      expect(state.status).toBe('ready');
      expect(state.scene).toBe('valley');
      expect(state.valleys).toHaveLength(1);
      expect(state.valleyMetadata?.description).toBe(valleyDataset.metadata.description);
      expect(state.festival).toBeNull();

      expect(engine.contents).toHaveLength(1);
      const content = engine.contents[0];
      expect(content?.segments.map((segment) => segment.id)).toEqual(segmentIds);
      expect(content?.facilities).toHaveLength(3);
      expect(content?.crowd.size).toBe(0);
      expect(content?.spots).toEqual([]);
      expect(content?.launchSite).toBeNull();
      // 그늘은 기본 꺼짐(결정 (g)) — 데이터는 실려 있어도 첫 렌더에는 얹지 않는다.
      expect(content?.shade).toBeNull();
      expect(state.valleyShade?.size).toBe(1);
      expect(state.shadeVisible).toBe(false);
      session.dispose();
    });

    it('불꽃은 꺼진 채 시작한다 — 엔진과 상태 모두', async () => {
      const { session, engine } = createValleySession();
      expect(session.store.state.fireworksEnabled).toBe(false);
      await session.initialize(NONE_CANCELLATION_TOKEN);
      expect(engine.fireworks).toEqual([false]);
      expect(session.store.state.fireworksEnabled).toBe(false);
      session.dispose();
    });

    it('첫 계곡 전체가 보이도록 평면(pitch 0)·북쪽 고정으로 비행한다', async () => {
      const { session, engine } = createValleySession();
      await session.initialize(NONE_CANCELLATION_TOKEN);

      expect(cameraTrail(engine)).toEqual([`fly:z${VALLEY_OVERVIEW_ZOOM}`]);
      const move = engine.lastMove;
      expect(move?.target.center?.equals(sampleValley.center())).toBe(true);
      expect(move?.target.pitch).toBe(VALLEY_FLAT_PITCH);
      expect(move?.target.bearing).toBe(0);
      // C6 — 인셋(시트 가시 높이·상단바)에서 계산한 offset. 하드코딩 값(옛
      // VALLEY_OVERVIEW_OFFSET)이 아니라 지금 인셋을 그대로 반영해야 한다.
      expect(move?.target.offset).toEqual(viewportCenterOffset(VALLEY_TEST_INSETS));
      expect(move?.transition).toEqual({ motion: 'fly', durationMs: 1400 });
      session.dispose();
    });

    it('명당 선택은 이 장면에 없다 — 취소로 끝나고 상태는 그대로', async () => {
      const { session, engine } = createValleySession();
      await session.initialize(NONE_CANCELLATION_TOKEN);
      const result = await session.selectSpot(festival.spots[0]?.id ?? ('x' as never));
      expect(result.ok).toBe(false);
      expect(session.store.state.sheetFace).toBe('list');
      expect(engine.selections).toEqual([]);
      session.dispose();
    });
  });

  /**
   * 접힌 시트(peek) 회귀 — 사용자 보고 2026-09-08 "긴고랑 검색했을때나 핀을 클릭했을때
   * 정보가 안나옴"(iOS 시뮬레이터). 검색 결과도 상세도 시트 안에만 그려지므로, 시트가
   * 접혀 있으면 상태는 정상인데 화면에는 아무것도 안 보였다 — 오류도 로그도 없다.
   */
  describe('결과가 보이는 자리로 시트를 데려온다', () => {
    let ctx: ReturnType<typeof createValleySession>;

    /** 검색이 부르는 되돌리기는 플립(비동기)이다 — 면이 바뀌기를 기다린다. */
    const waitForListFace = async (session: MapSession): Promise<void> => {
      for (let i = 0; i < 60; i += 1) {
        if (session.store.state.sheetFace === 'list') return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    };

    beforeEach(async () => {
      ctx = createValleySession();
      await ctx.session.initialize(NONE_CANCELLATION_TOKEN);
    });

    it('검색어가 생기면 접힌 시트를 half 로 올린다', () => {
      const { session } = ctx;
      session.setSheetSnap('peek');

      session.setSearchQuery('긴고랑');

      expect(session.store.state.sheetSnap).toBe('half');
      expect(session.store.state.searchQuery).toBe('긴고랑');
    });

    it('이미 펼쳐 둔 시트는 좁히지 않는다', () => {
      const { session } = ctx;
      session.setSheetSnap('full');

      session.setSearchQuery('긴고랑');

      expect(session.store.state.sheetSnap).toBe('full');
    });

    it('검색어를 지우는 것은 시트를 건드리지 않는다', () => {
      const { session } = ctx;
      session.setSheetSnap('peek');

      session.setSearchQuery('');

      expect(session.store.state.sheetSnap).toBe('peek');
    });

    it('상세가 열려 있으면 검색어 입력이 목록 면으로 되돌린다 — 결과는 목록 면에만 그려진다', async () => {
      const { session } = ctx;
      await session.selectSegment(mid.id);
      expect(session.store.state.sheetFace).toBe('detail');

      session.setSearchQuery('긴고랑');
      await waitForListFace(session);

      expect(session.store.state.sheetFace).toBe('list');
      expect(session.store.state.selectedSegmentId).toBeNull();
      expect(session.store.state.searchQuery).toBe('긴고랑');
    });

    it('설정 면이 열려 있어도 목록 면으로 되돌린다', async () => {
      const { session } = ctx;
      await session.openSettings();
      expect(session.store.state.sheetFace).toBe('settings');

      session.setSearchQuery('긴고랑');
      await waitForListFace(session);

      expect(session.store.state.sheetFace).toBe('list');
    });

    it('구간을 선택하면 접힌 시트가 올라온다 — 지도 선·검색 결과 탭이 같은 경로다', async () => {
      const { session } = ctx;
      session.setSheetSnap('peek');

      await session.selectSegment(mid.id);

      expect(session.store.state.sheetSnap).toBe('half');
      expect(session.store.state.sheetFace).toBe('detail');
    });

    it('시설 핀을 선택하면 접힌 시트가 올라온다', async () => {
      const { session } = ctx;
      session.setSheetSnap('peek');

      await session.selectFacility(upperParking.id);

      expect(session.store.state.sheetSnap).toBe('half');
      expect(session.store.state.selectedFacilityId).toBe(upperParking.id);
    });
  });

  describe('구간 선택', () => {
    let ctx: ReturnType<typeof createValleySession>;

    beforeEach(async () => {
      ctx = createValleySession();
      await ctx.session.initialize(NONE_CANCELLATION_TOKEN);
    });

    it('카드 탭: 선 강조 + 중간점으로 비행 + 상세 면 — 3D 지형이 있으면 축 가로지르기·pitch 58 (C10)', async () => {
      const { session, engine } = ctx;
      await session.selectSegment(mid.id);
      const state = session.store.state;

      expect(state.selectedSegmentId).toBe(mid.id);
      expect(state.selectedSpotId).toBeNull();
      expect(state.selectedFacilityId).toBeNull();
      expect(state.sheetFace).toBe('detail');
      expect(state.flipPhase).toBe('idle');
      expect(state.navTab).toBe('spots');

      const selection = engine.selections.at(-1);
      expect(selection?.kind).toBe('segment');
      if (selection?.kind === 'segment') expect(selection.segment.id).toBe(mid.id);
      expect(engine.stops).toBeGreaterThan(0);

      const move = engine.lastMove;
      expect(move?.target.center?.equals(mid.midpoint())).toBe(true);
      expect(move?.target.zoom).toBe(VALLEY_DETAIL_ZOOM);
      expect(move?.target.pitch).toBe(VALLEY_DETAIL_TERRAIN_PITCH);
      // C6 — 옛 하드코딩 [0,-90] 대신 인셋 기반 offset.
      expect(move?.target.offset).toEqual(viewportCenterOffset(VALLEY_TEST_INSETS));
      expect(move?.target.bearing).toBeCloseTo(valleyAxisBearing(mid), 10);
      expect(move?.transition).toEqual({ motion: 'fly', durationMs: 1400, essential: true });
      session.dispose();
    });

    it('3D 지형이 없는 엔진(네이티브)은 pitch 30 · bearing 유지 — F1b 시점 그대로', async () => {
      const flat = createValleySession({ terrain: false });
      await flat.session.initialize(NONE_CANCELLATION_TOKEN);
      await flat.session.selectSegment(mid.id);

      const move = flat.engine.lastMove;
      expect(move?.target.pitch).toBe(VALLEY_DETAIL_FLAT_PITCH);
      expect(move?.target.bearing).toBeUndefined();
      expect(move?.target.zoom).toBe(VALLEY_DETAIL_ZOOM);
      flat.session.dispose();
    });

    it('해제: 상태 세 종류 모두 null, 강조 제거, 전체 보기로 복귀, 목록 면', async () => {
      const { session, engine } = ctx;
      await session.selectSegment(mid.id);
      await session.clearSelection();
      const state = session.store.state;

      expect(state.selectedSegmentId).toBeNull();
      expect(state.selectedFacilityId).toBeNull();
      expect(state.selectedSpotId).toBeNull();
      expect(state.sheetFace).toBe('list');
      expect(state.navTab).toBe('home');
      expect(engine.selections.at(-1)).toBeNull();

      const move = engine.lastMove;
      expect(move?.target.zoom).toBe(VALLEY_OVERVIEW_ZOOM);
      expect(move?.target.pitch).toBe(VALLEY_FLAT_PITCH);
      // 상세가 축 방향으로 돌아가 있었으므로 전체 보기는 북쪽으로 되돌린다(C10).
      expect(move?.target.bearing).toBe(0);
      expect(move?.target.offset).toEqual(VALLEY_OVERVIEW_OFFSET);
      expect(move?.target.center).toBeUndefined();
      expect(move?.transition).toEqual({ motion: 'ease', durationMs: 1100 });

      // 프리셋 호출 순서: 첫 계곡 → 구간 → 복귀
      expect(cameraTrail(engine)).toEqual([
        `fly:z${VALLEY_OVERVIEW_ZOOM}`,
        `fly:z${VALLEY_DETAIL_ZOOM}`,
        `ease:z${VALLEY_OVERVIEW_ZOOM}`,
      ]);
      session.dispose();
    });

    it('상세가 열린 채 다른 구간을 고르면 플립 없이 내용과 카메라만 바뀐다', async () => {
      const { session, engine } = ctx;
      const lower = sampleValley.segments[2];
      if (lower === undefined) throw new Error('fixture');

      await session.selectSegment(mid.id);
      const flipsBefore = engine.moves.length;
      await session.selectSegment(lower.id);

      expect(session.store.state.selectedSegmentId).toBe(lower.id);
      expect(session.store.state.sheetFace).toBe('detail');
      expect(engine.moves.length).toBe(flipsBefore + 1);
      expect(engine.lastMove?.target.center?.equals(lower.midpoint())).toBe(true);
      session.dispose();
    });

    it('지도 선 탭은 카드 탭과 같은 경로', async () => {
      const { session, engine } = ctx;
      engine.emit('feature-press', { kind: 'segment', id: mid.id });
      await new Promise((r) => setTimeout(r, 700));
      expect(session.store.state.selectedSegmentId).toBe(mid.id);
      expect(session.store.state.sheetFace).toBe('detail');
      session.dispose();
    });

    it('지도 빈 곳 탭은 구간 선택을 해제한다', async () => {
      const { session, engine } = ctx;
      await session.selectSegment(mid.id);
      engine.emit('background-press', undefined);
      await new Promise((r) => setTimeout(r, 700));
      expect(session.store.state.selectedSegmentId).toBeNull();
      expect(session.store.state.sheetFace).toBe('list');
      session.dispose();
    });

    it('없는 구간은 valley/segment-not-found', async () => {
      const { session } = ctx;
      const result = await session.selectSegment(toSegmentId('없는-구간'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('valley/segment-not-found');
      session.dispose();
    });

    it('"계곡으로" 버튼은 선택된 구간의 계곡 전체 보기로 돌아간다', async () => {
      const { session, engine } = ctx;
      await session.selectSegment(mid.id);
      await session.recenterValley();
      const move = engine.lastMove;
      expect(move?.target.center?.equals(sampleValley.center())).toBe(true);
      expect(move?.target.zoom).toBe(VALLEY_OVERVIEW_ZOOM);
      expect(move?.target.pitch).toBe(VALLEY_FLAT_PITCH);
      session.dispose();
    });
  });

  describe('물줄기 흐름 (C10c)', () => {
    it('ready 가 되면 켜고, 시트가 peek 이면 끄고, half 로 돌아오면 켠다 (C8)', async () => {
      const { session, engine } = createValleySession();
      expect(engine.waterFlow).toEqual([]);
      await session.initialize(NONE_CANCELLATION_TOKEN);
      expect(engine.waterFlow).toEqual([true]);

      session.setSheetSnap('peek');
      expect(engine.waterFlow).toEqual([true, false]);
      session.setSheetSnap('half');
      expect(engine.waterFlow).toEqual([true, false, true]);
      session.dispose();
      // 정리 때 반드시 끈다.
      expect(engine.waterFlow.at(-1)).toBe(false);
    });

    it('full 스냅에서도 켜져 있다 — peek 만 끈다 (C8)', async () => {
      const { session, engine } = createValleySession();
      await session.initialize(NONE_CANCELLATION_TOKEN);
      expect(engine.waterFlow).toEqual([true]);
      session.setSheetSnap('full');
      expect(engine.waterFlow).toEqual([true]);
      session.dispose();
    });

    it('앱이 배경으로 가면 끄고, 전면으로 오면 켠다 — 같은 값은 다시 말하지 않는다', async () => {
      const { session, engine } = createValleySession();
      await session.initialize(NONE_CANCELLATION_TOKEN);
      session.setAppActive(true);
      expect(engine.waterFlow).toEqual([true]);
      session.setAppActive(false);
      expect(engine.waterFlow).toEqual([true, false]);
      // 배경인 채 시트를 접었다 펴도 켜지지 않는다.
      session.setSheetSnap('peek');
      session.setSheetSnap('half');
      expect(engine.waterFlow).toEqual([true, false]);
      session.setAppActive(true);
      expect(engine.waterFlow).toEqual([true, false, true]);
      expect(session.store.state.appActive).toBe(true);
      session.dispose();
    });

    it('festival 장면에서는 켜지지 않는다 — /firework 는 타이머도 돌지 않는다', async () => {
      const { session, engine } = createSession();
      await session.initialize(NONE_CANCELLATION_TOKEN);
      session.setSheetSnap('peek');
      session.setSheetSnap('half');
      expect(engine.waterFlow).toEqual([]);
      session.dispose();
      expect(engine.waterFlow).toEqual([]);
    });
  });

  describe('그늘 보기 (F4)', () => {
    it('기본 시각: 10~18시 안이면 가장 가까운 정시, 밖이면 정오 — now 고정', () => {
      const afternoon = createValleySession({ now: () => kst(14, 40) });
      expect(afternoon.session.store.state.shadeHourIndex).toBe(5); // 15:00
      afternoon.session.dispose();

      const morning = createValleySession({ now: () => kst(8, 30) });
      expect(morning.session.store.state.shadeHourIndex).toBe(SHADE_NOON_INDEX);
      morning.session.dispose();

      const night = createValleySession({ now: () => kst(21, 0) });
      expect(night.session.store.state.shadeHourIndex).toBe(SHADE_NOON_INDEX);
      night.session.dispose();

      // festival 은 시각 규칙과 무관 — 정오 그대로.
      const festivalSession = createSession();
      expect(festivalSession.session.store.state.shadeHourIndex).toBe(SHADE_NOON_INDEX);
      festivalSession.session.dispose();
    });

    it('토글 on: 그늘만 얹은 내용을 한 번 더 그리고, 상태·저장이 함께 바뀐다', async () => {
      const { session, engine, storage } = createValleySession({ now: () => kst(12) });
      await session.initialize(NONE_CANCELLATION_TOKEN);
      const base = engine.contents[0];
      if (base === undefined) throw new Error('fixture');

      const result = await session.toggleShade();
      expect(result.ok).toBe(true);
      expect(engine.contents).toHaveLength(2);
      const shaded = engine.contents[1];
      expect(shaded?.shade).not.toBeNull();
      expect(shaded?.shade?.canopy.length).toBeGreaterThan(0);
      expect(shaded?.shade?.shadow).toEqual([]); // 정오 — 개방지 그림자 없음
      // 바탕은 같은 참조 — 어댑터가 구간·시설 소스를 다시 쓰지 않는다.
      expect(shaded?.segments).toBe(base.segments);
      expect(shaded?.facilities).toBe(base.facilities);
      expect(shaded?.crowd).toBe(base.crowd);

      expect(session.store.state.shadeVisible).toBe(true);
      const saved = await storage.read(STORAGE_KEYS.shadeVisible, NONE_CANCELLATION_TOKEN);
      expect(saved.ok && saved.value).toBe('true');
      session.dispose();
    });

    it('토글 off: 그늘 없는 바탕(첫 렌더와 같은 참조)으로 되돌리고 false 를 저장한다', async () => {
      const { session, engine, storage } = createValleySession();
      await session.initialize(NONE_CANCELLATION_TOKEN);
      await session.toggleShade();
      await session.toggleShade();

      expect(engine.contents).toHaveLength(3);
      expect(engine.contents[2]).toBe(engine.contents[0]);
      expect(engine.contents[2]?.shade).toBeNull();
      expect(session.store.state.shadeVisible).toBe(false);
      const saved = await storage.read(STORAGE_KEYS.shadeVisible, NONE_CANCELLATION_TOKEN);
      expect(saved.ok && saved.value).toBe('false');
      session.dispose();
    });

    it('켜진 채 시각을 바꾸면 shade 참조만 바뀐다 — 수관은 같은 배열, 그림자만 그 시각의 것', async () => {
      const { session, engine } = createValleySession({ now: () => kst(12) });
      await session.initialize(NONE_CANCELLATION_TOKEN);
      await session.toggleShade();
      const noon = engine.contents.at(-1);

      expect(session.setShadeHour(7).ok).toBe(true); // 17:00 — 그림자가 가장 큰 시각
      expect(engine.contents).toHaveLength(3);
      const late = engine.contents.at(-1);
      expect(session.store.state.shadeHourIndex).toBe(7);
      expect(late?.shade).not.toBe(noon?.shade);
      expect(late?.shade?.canopy).toBe(noon?.shade?.canopy);
      expect(late?.shade?.shadow.length).toBeGreaterThan(0);
      expect(late?.segments).toBe(noon?.segments);
      expect(late?.facilities).toBe(noon?.facilities);
      expect(late?.crowd).toBe(noon?.crowd);

      // 같은 시각을 다시 고르면 아무 일도 없다. 이전 시각으로 돌아가면 캐시된 같은 오버레이.
      expect(session.setShadeHour(7).ok).toBe(true);
      expect(engine.contents).toHaveLength(3);
      session.setShadeHour(SHADE_NOON_INDEX);
      expect(engine.contents.at(-1)?.shade).toBe(noon?.shade);
      session.dispose();
    });

    it('꺼진 채 시각을 바꾸면 지도는 건드리지 않고 상태만 바뀐다 — 켤 때 그 시각으로 그린다', async () => {
      const { session, engine } = createValleySession({ now: () => kst(12) });
      await session.initialize(NONE_CANCELLATION_TOKEN);

      expect(session.setShadeHour(8).ok).toBe(true);
      expect(engine.contents).toHaveLength(1);
      expect(session.store.state.shadeHourIndex).toBe(8);

      await session.toggleShade();
      expect(engine.contents).toHaveLength(2);
      expect(engine.contents[1]?.shade?.shadow.length).toBeGreaterThan(0); // 18:00 그림자
      session.dispose();
    });

    it('저장된 토글이 켜져 있으면 첫 렌더부터 그늘을 얹는다', async () => {
      const storage = new MemoryStorage();
      await storage.write(STORAGE_KEYS.shadeVisible, 'true', NONE_CANCELLATION_TOKEN);
      const { session, engine } = createValleySession({ storage, now: () => kst(15) });
      await session.initialize(NONE_CANCELLATION_TOKEN);

      expect(session.store.state.shadeVisible).toBe(true);
      expect(engine.contents).toHaveLength(1);
      expect(engine.contents[0]?.shade).not.toBeNull();
      session.dispose();
    });

    it('알 수 없는 저장 값은 꺼짐으로 읽는다', async () => {
      const storage = new MemoryStorage();
      await storage.write(STORAGE_KEYS.shadeVisible, 'yes', NONE_CANCELLATION_TOKEN);
      const { session, engine } = createValleySession({ storage });
      await session.initialize(NONE_CANCELLATION_TOKEN);
      expect(session.store.state.shadeVisible).toBe(false);
      expect(engine.contents[0]?.shade).toBeNull();
      session.dispose();
    });

    it('festival 장면에서는 토글·시각이 조용히 무시된다 — 계곡 데이터가 없다', async () => {
      const { session, engine } = createSession();
      await session.initialize(NONE_CANCELLATION_TOKEN);

      const toggled = await session.toggleShade();
      expect(toggled.ok).toBe(false);
      if (!toggled.ok) expect(toggled.error.code).toBe('async/cancelled');
      const hour = session.setShadeHour(4);
      expect(hour.ok).toBe(false);
      if (!hour.ok) expect(hour.error.code).toBe('async/cancelled');

      expect(engine.contents).toHaveLength(1);
      expect(session.store.state.shadeVisible).toBe(false);
      expect(session.store.state.shadeHourIndex).toBe(SHADE_NOON_INDEX);
      expect(session.store.state.lastError).toBeNull();
      session.dispose();
    });
  });

  describe('시설 선택 — 핀 + 미니 행, 상세 없음', () => {
    let ctx: ReturnType<typeof createValleySession>;

    beforeEach(async () => {
      ctx = createValleySession();
      await ctx.session.initialize(NONE_CANCELLATION_TOKEN);
    });

    it('핀만 세운다: 면·내비·카메라는 그대로', async () => {
      const { session, engine } = ctx;
      const movesBefore = engine.moves.length;
      await session.selectFacility(upperParking.id);
      const state = session.store.state;

      expect(state.selectedFacilityId).toBe(upperParking.id);
      expect(state.selectedSegmentId).toBeNull();
      expect(state.sheetFace).toBe('list');
      expect(state.navTab).toBe('home');
      const selection = engine.selections.at(-1);
      expect(selection?.kind).toBe('facility');
      if (selection?.kind === 'facility') expect(selection.facility.id).toBe(upperParking.id);
      expect(engine.moves.length).toBe(movesBefore);
      session.dispose();
    });

    it('해제는 핀만 지운다 — 카메라·플립 없음', async () => {
      const { session, engine } = ctx;
      await session.selectFacility(upperParking.id);
      const movesBefore = engine.moves.length;
      const result = await session.clearSelection();

      expect(result.ok).toBe(true);
      expect(session.store.state.selectedFacilityId).toBeNull();
      expect(engine.selections.at(-1)).toBeNull();
      expect(engine.moves.length).toBe(movesBefore);
      expect(session.store.state.sheetFace).toBe('list');
      session.dispose();
    });

    it('지도 시설 탭 → 핀, 빈 곳 탭 → 해제', async () => {
      const { session, engine } = ctx;
      engine.emit('feature-press', { kind: 'facility', id: upperParking.id });
      await new Promise((r) => setTimeout(r, 50));
      expect(session.store.state.selectedFacilityId).toBe(upperParking.id);

      engine.emit('background-press', undefined);
      await new Promise((r) => setTimeout(r, 50));
      expect(session.store.state.selectedFacilityId).toBeNull();
      expect(engine.selections.at(-1)).toBeNull();
      session.dispose();
    });

    it('구간 상세 위에서 시설을 고르면 상세를 닫고(복귀 카메라) 핀으로 바꾼다', async () => {
      const { session, engine } = ctx;
      await session.selectSegment(mid.id);
      await session.selectFacility(upperParking.id);
      const state = session.store.state;

      expect(state.selectedSegmentId).toBeNull();
      expect(state.selectedFacilityId).toBe(upperParking.id);
      expect(state.sheetFace).toBe('list');
      expect(engine.selections.at(-1)?.kind).toBe('facility');
      expect(cameraTrail(engine)).toEqual([
        `fly:z${VALLEY_OVERVIEW_ZOOM}`,
        `fly:z${VALLEY_DETAIL_ZOOM}`,
        `ease:z${VALLEY_OVERVIEW_ZOOM}`,
      ]);
      session.dispose();
    });

    it('시설이 선택된 상태에서 구간을 고르면 시설 선택은 사라진다', async () => {
      const { session, engine } = ctx;
      await session.selectFacility(upperParking.id);
      await session.selectSegment(mid.id);
      const state = session.store.state;

      expect(state.selectedFacilityId).toBeNull();
      expect(state.selectedSegmentId).toBe(mid.id);
      expect(state.sheetFace).toBe('detail');
      expect(engine.selections.at(-1)?.kind).toBe('segment');
      session.dispose();
    });

    it('없는 시설은 valley/facility-not-found', async () => {
      const { session } = ctx;
      const result = await session.selectFacility(toFacilityId('없는-시설'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('valley/facility-not-found');
      session.dispose();
    });
  });
});

describe('생애', () => {
  it('dispose 는 엔진까지 정리하고 이후 조작을 무시한다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    session.dispose();

    expect(engine.disposed).toBe(true);
    expect(session.state).toBe('disposed');

    const result = await session.startTour();
    expect(result.ok).toBe(true); // 조용히 무시된다
    session.dispose(); // 멱등
  });

  it('플립 진행 중 재진입은 버려진다 (데모의 busy 가드)', async () => {
    const { session } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    const first = festival.spots[0];
    const second = festival.spots[1];
    if (first === undefined || second === undefined) throw new Error('fixture');

    const opening = session.selectSpot(first.id);
    const reentry = await session.selectSpot(second.id);
    expect(reentry.ok).toBe(false);

    await opening;
    expect(session.store.state.selectedSpotId).toBe(first.id);
    session.dispose();
  });
});

describe('베이스맵 헬스 (C7)', () => {
  it('엔진의 basemap-health 이벤트가 상태로 올라가고, 초기값은 정상', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    expect(session.store.state.baseMapHealth).toBe(INITIAL_BASE_MAP_HEALTH);

    engine.emit('basemap-health', { armedAt: 10, failures: 3, outage: false });
    expect(session.store.state.baseMapHealth.outage).toBe(false);
    engine.emit('basemap-health', { armedAt: 10, failures: 5, outage: true });
    expect(session.store.state.baseMapHealth.outage).toBe(true);
    // 헬스는 상태 오류가 아니다 — lastError 에 섞이지 않는다.
    expect(session.store.state.lastError).toBeNull();
    session.dispose();
  });

  it('retryBaseMap 은 엔진의 소스 reload 를 부르고 헬스가 처음으로 돌아온다', async () => {
    const { session, engine } = createSession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    engine.emit('basemap-health', { armedAt: 10, failures: 5, outage: true });

    const result = session.retryBaseMap();
    expect(result.ok).toBe(true);
    expect(engine.baseMapRetries).toBe(1);
    expect(session.store.state.baseMapHealth).toBe(INITIAL_BASE_MAP_HEALTH);
    session.dispose();
    // dispose 뒤에는 조용히 무시
    expect(session.retryBaseMap().ok).toBe(true);
    expect(engine.baseMapRetries).toBe(1);
  });
});

describe('상류 강우 경보 (F3b)', () => {
  it('valley 장면에서 api 가 있으면 초기화 때 한 번 적재한다', async () => {
    const api = new FakeApiPort();
    api.responses = [
      [
        {
          valleyId: 'sample',
          level: 'watch',
          source: 'gauge',
          confidence: 'observed',
          observedAt: '2026-08-01T00:00:00.000Z',
          issuedAt: '2026-08-01T00:00:00.000Z',
          rainfall1hMm: 12,
          stale: false,
          lastObservedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    ];
    const { session } = createValleySession({ api });
    await session.initialize(NONE_CANCELLATION_TOKEN);

    expect(api.calls).toBe(1);
    const alerts = session.store.state.alerts;
    expect(alerts?.get(toValleyId('sample'))?.alert?.level).toBe('watch');
    session.dispose();
  });

  it('SSE alert 이벤트가 오면 다시 부르고, dispose 하면 구독이 정리된다', async () => {
    const api = new FakeApiPort();
    api.responses = [
      [{ valleyId: 'sample', level: null, stale: false, lastObservedAt: null }],
      [
        {
          valleyId: 'sample',
          level: 'warning',
          source: 'waterlevel',
          confidence: 'observed',
          observedAt: '2026-08-01T00:10:00.000Z',
          issuedAt: '2026-08-01T00:10:00.000Z',
          stale: false,
          lastObservedAt: '2026-08-01T00:10:00.000Z',
        },
      ],
    ];
    const { session } = createValleySession({ api });
    await session.initialize(NONE_CANCELLATION_TOKEN);
    expect(session.store.state.alerts?.get(toValleyId('sample'))?.alert).toBeNull();
    // alert 구독 + report 구독(F5c) — valley 장면은 api 가 있으면 둘 다 배선한다.
    expect(api.subscriberCount).toBe(2);

    api.emit({ type: 'alert', at: 't', observedAt: null });
    await Promise.resolve();
    expect(api.calls).toBe(2);
    expect(session.store.state.alerts?.get(toValleyId('sample'))?.alert?.level).toBe('warning');

    session.dispose();
    expect(api.subscriberCount).toBe(0);
  });

  it('festival 장면에서는 api 가 있어도 부르지 않는다', async () => {
    const api = new FakeApiPort();
    const { session } = createSession({ api });
    await session.initialize(NONE_CANCELLATION_TOKEN);
    expect(api.calls).toBe(0);
    expect(api.reportCalls).toBe(0);
    expect(session.store.state.alerts).toBeNull();
    expect(session.store.state.reports).toBeNull();
    session.dispose();
  });
});

describe('제보 피드·티커 (F5c)', () => {
  function sampleReport(overrides: { id?: string; createdAt?: string } = {}) {
    return {
      id: overrides.id ?? 'r1',
      valleyId: 'sample',
      segmentId: null,
      type: 'trash' as const,
      body: '쓰레기가 많아요',
      nickname: '산꾼',
      createdAt: overrides.createdAt ?? '2026-08-01T00:00:00.000Z',
      photos: [],
    };
  }

  it('valley 장면에서 api 가 있으면 초기화 때 한 번 적재해 도메인으로 바꾼다', async () => {
    const api = new FakeApiPort();
    api.reportResponses = [{ reports: [sampleReport()], nextCursor: null }];
    const { session } = createValleySession({ api });
    await session.initialize(NONE_CANCELLATION_TOKEN);

    expect(api.reportCalls).toBe(1);
    const reports = session.store.state.reports;
    expect(reports).toHaveLength(1);
    expect(reports?.[0]).toBeInstanceOf(Report);
    expect(reports?.[0]?.id).toBe('r1');
    expect(reports?.[0]?.valleyId).toBe(toValleyId('sample'));
    session.dispose();
  });

  it('SSE report 이벤트가 오면 다시 부르고, dispose 하면 구독이 정리된다', async () => {
    const api = new FakeApiPort();
    api.reportResponses = [
      { reports: [], nextCursor: null },
      { reports: [sampleReport({ id: 'r2' })], nextCursor: null },
    ];
    const { session } = createValleySession({ api });
    await session.initialize(NONE_CANCELLATION_TOKEN);
    expect(session.store.state.reports).toEqual([]);
    expect(api.subscriberCount).toBe(2); // alert 구독 + report 구독

    api.emit({
      type: 'report',
      at: 't',
      report: { id: 'r2', valleyId: 'sample', type: 'trash', nickname: '산꾼', createdAt: 't' },
    });
    await Promise.resolve();
    expect(api.reportCalls).toBe(2);
    expect(session.store.state.reports?.map((r) => r.id)).toEqual(['r2']);

    session.dispose();
    expect(api.subscriberCount).toBe(0);
  });

  it('제보가 없어도(서버 미배선) 계곡 티커가 기본 문구로 돈다 — 빈 티커를 두지 않는다', async () => {
    const { session } = createValleySession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    expect(session.store.state.reports).toBeNull();
    expect(session.store.state.valleyTickerVisible).toBe(true);
    session.dispose();
  });

  it('제보 상세 열기·닫기 — 플립·선택 상태가 구간 상세와 같은 규약을 따른다', async () => {
    const { session } = createValleySession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    session.store.setReports([
      new Report({
        id: 'r1',
        valleyId: toValleyId('sample'),
        type: 'valley-info',
        body: '물이 맑아요',
        nickname: '산꾼',
        createdAt: '2026-08-01T00:00:00.000Z',
      }),
    ]);

    const opened = await session.selectReport('r1');
    expect(opened.ok).toBe(true);
    expect(session.store.state.selectedReportId).toBe('r1');
    expect(session.store.state.sheetFace).toBe('detail');
    expect(session.store.state.valleyTickerVisible).toBe(false);

    const closed = await session.closeReport();
    expect(closed.ok).toBe(true);
    expect(session.store.state.selectedReportId).toBeNull();
    expect(session.store.state.sheetFace).toBe('list');
    expect(session.store.state.valleyTickerVisible).toBe(true);

    session.dispose();
  });

  it('없는 제보 id 를 선택하면 실패로 끝나고 상태가 바뀌지 않는다', async () => {
    const { session } = createValleySession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    session.store.setReports([]);

    const result = await session.selectReport('nope');
    expect(result.ok).toBe(false);
    expect(session.store.state.selectedReportId).toBeNull();
    session.dispose();
  });

  it('선택이 없을 때 closeReport 는 조용히 실패한다(상태 변화 없음)', async () => {
    const { session } = createValleySession();
    await session.initialize(NONE_CANCELLATION_TOKEN);
    const result = await session.closeReport();
    expect(result.ok).toBe(false);
    expect(session.store.state.sheetFace).toBe('list');
    session.dispose();
  });
});

describe('선택 계곡 사용자 흐름', () => {
  it('선택 유지 모드에서는 배경 지도를 눌러도 시설 선택을 해제하지 않는다', async () => {
    const { session, engine } = createValleySession({ preserveSelection: true });
    await session.initialize(NONE_CANCELLATION_TOKEN);
    const id = toFacilityId('sample-parking-upper');
    await session.selectFacility(id);
    engine.emit('background-press', undefined);
    expect(session.store.state.selectedFacilityId).toBe(id);
    session.dispose();
  });

  it('시설 재중앙화는 선택을 유지하고 실제 시설 좌표와 가림 영역을 사용한다', async () => {
    const { session, engine } = createValleySession({ preserveSelection: true });
    await session.initialize(NONE_CANCELLATION_TOKEN);
    const facility = sampleValley.facilities[0];
    if (!facility) throw new Error('fixture');
    await session.selectFacility(facility.id);
    session.setViewportInsets({ top: 170, bottom: 158 });
    const result = await session.recenterSelection();
    expect(result.ok).toBe(true);
    expect(session.store.state.selectedFacilityId).toBe(facility.id);
    expect(engine.moves.at(-1)?.command.target.center).toEqual(facility.position);
    expect(engine.moves.at(-1)?.command.target.offset).toEqual(
      viewportCenterOffset({ top: 170, bottom: 158 }),
    );
    session.dispose();
  });
});
