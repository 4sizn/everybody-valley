/**
 * 네이티브 지도 엔진의 포트 계약.
 *
 * 시뮬레이터 없이 검증할 수 있는 범위를 테스트로 고정한다 — 스타일 장식,
 * 초기화 순서, scene 게시, 카메라 이동의 정착·취소, 능력 부족의 정직한 실패.
 * `MapSurface` 가 뷰 대신 서 주므로 지도 SDK 없이 돌아간다.
 */
import {
  type BaseMapHealth,
  CancellationTokenSource,
  type CrowdStatus,
  DEFAULT_MAP_GESTURES,
  type Disposable,
  EMPTY_MAP_CONTENT,
  Facility,
  focusSpot,
  INITIAL_BASE_MAP_HEALTH,
  LngLat,
  type MapContent,
  type MapFeatureRef,
  NONE_CANCELLATION_TOKEN,
  NoopLogger,
  OUTAGE_SUSTAIN_MS,
  Segment,
  type SegmentId,
  StaticFestivalRepository,
  toFacilityId,
  toSegmentId,
  toValleyId,
} from '@modu-valley/core';
import {
  BUILDINGS_LAYER_ID,
  FACILITY_SOURCE_ID,
  FLOW_DASH_LAYER_ID,
  FLOW_FRAME_MS,
  HILLSHADE_LAYER_ID,
  MAP_LAYER_SETS,
  SEGMENT_CASING_LAYER_ID,
  SEGMENT_SOURCE_ID,
  SHADE_CANOPY_LAYER_ID,
  SHADE_SOURCE_ID,
  SPOT_SOURCE_ID,
  TERRAIN_DEM_SOURCE_ID,
  valleyPaintOverrides,
} from '@modu-valley/map-style';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapSurface } from '../src/map/MapSurface';
import { NATIVE_SUCCESS_QUIET_MS, NativeMapEngine } from '../src/map/NativeMapEngine';

const LAUNCH = LngLat.of(126.9427, 37.5219);
const STYLE_URL = 'https://example.test/style.json';

/** 라벨 심볼 레이어 하나를 가진 최소 스타일. */
const RAW_STYLE = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background' },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway' },
    { id: 'place-label', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
  ],
};

function stubFetch(payload: unknown = RAW_STYLE, ok = true): void {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(payload) }),
  );
}

const VALLEY = toValleyId('sample');
const UPPER = new Segment({
  id: toSegmentId('sample-upper'),
  valleyId: VALLEY,
  valleyName: '샘플계곡',
  position: 'upper',
  order: 0,
  path: [LngLat.of(127.2612, 37.8341), LngLat.of(127.2641, 37.8318)],
});
const MID = new Segment({
  id: toSegmentId('sample-mid'),
  valleyId: VALLEY,
  valleyName: '샘플계곡',
  position: 'mid',
  order: 1,
  path: [LngLat.of(127.2641, 37.8318), LngLat.of(127.2674, 37.8291)],
});
const PARKING = new Facility({
  id: toFacilityId('sample-parking-1'),
  valleyId: VALLEY,
  name: '하류 공영주차장',
  facilityType: 'parking',
  position: LngLat.of(127.2701, 37.8262),
});
const CROWD: ReadonlyMap<SegmentId, CrowdStatus> = new Map([[MID.id, 'busy']]);

async function festivalContent(): Promise<MapContent> {
  const festival = await new StaticFestivalRepository().load(NONE_CANCELLATION_TOKEN);
  if (!festival.ok) throw new Error('fixture');
  return {
    ...EMPTY_MAP_CONTENT,
    spots: festival.value.spots,
    launchSite: festival.value.launchSite,
  };
}

function makeEngine(options: { terrain?: boolean } = {}): {
  engine: NativeMapEngine;
  surface: MapSurface;
} {
  const logger = new NoopLogger();
  const surface = new MapSurface(logger);
  const engine = new NativeMapEngine({
    surface,
    launchSite: LAUNCH,
    logger,
    styleMode: 'dark',
    styleUrl: STYLE_URL,
    ...options,
  });
  return { engine, surface };
}

/**
 * 지도 뷰를 대신한다 — 스타일이 게시되면 로드 완료를 알린다.
 *
 * 실제 뷰도 같은 순서로 움직인다(게시 → 리렌더 → 네이티브 지도 마운트 →
 * `onDidFinishLoadingStyle`). 게시 시점에 곧바로 알리면 엔진이 아직 구독하기
 * 전이므로, 실제와 같게 한 틱 뒤로 미룬다.
 */
function completeStyleLoad(surface: MapSurface): Disposable {
  return surface.scene.subscribe(() => {
    if (surface.scene.getSnapshot().style === null) return;
    queueMicrotask(() => surface.reportStyleLoaded());
  });
}

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('NativeMapEngine 초기화', () => {
  it('스타일을 받아 장식한 뒤 scene 에 게시하고 ready 가 된다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);

    const result = await engine.initialize(NONE_CANCELLATION_TOKEN);

    expect(result.ok).toBe(true);
    expect(engine.state).toBe('ready');

    const style = surface.scene.getSnapshot().style;
    expect(style).not.toBeNull();
    // 밤하늘·3D 건물·한국어 라벨이 스타일에 얹혀 있어야 한다.
    expect(style?.sky).toBeDefined();
    expect(style?.layers.map((layer) => layer.id)).toContain(BUILDINGS_LAYER_ID);
    const label = style?.layers.find((layer) => layer.id === 'place-label');
    expect(label?.layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:ko'],
      ['get', 'name:nonlatin'],
      ['get', 'name'],
      ['get', 'name:latin'],
    ]);

    styleLoad.dispose();
    engine.dispose();
  });

  it('배치별 기준 레이어 id 를 함께 게시한다 — 라벨 아래(F4)·물줄기 아래(C10)', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    expect(surface.scene.getSnapshot().placementLayerIds).toEqual({
      'below-labels': null,
      'below-waterway': null,
    });

    await engine.initialize(NONE_CANCELLATION_TOKEN);
    expect(surface.scene.getSnapshot().placementLayerIds).toEqual({
      'below-labels': 'place-label',
      'below-waterway': 'waterway',
    });

    styleLoad.dispose();
    engine.dispose();
    expect(surface.scene.getSnapshot().placementLayerIds).toEqual({
      'below-labels': null,
      'below-waterway': null,
    });
  });

  it('terrain 옵션이 있을 때만 DEM 소스와 음영 레이어가 스타일에 실린다 (festival 은 소스도 없다)', async () => {
    const plain = makeEngine();
    const plainLoad = completeStyleLoad(plain.surface);
    await plain.engine.initialize(NONE_CANCELLATION_TOKEN);
    const plainStyle = plain.surface.scene.getSnapshot().style;
    expect(plainStyle?.sources[TERRAIN_DEM_SOURCE_ID]).toBeUndefined();
    expect(plainStyle?.layers.map((layer) => layer.id)).not.toContain(HILLSHADE_LAYER_ID);
    plainLoad.dispose();
    plain.engine.dispose();

    const valley = makeEngine({ terrain: true });
    const valleyLoad = completeStyleLoad(valley.surface);
    await valley.engine.initialize(NONE_CANCELLATION_TOKEN);
    const style = valley.surface.scene.getSnapshot().style;
    expect(style?.sources[TERRAIN_DEM_SOURCE_ID]?.type).toBe('raster-dem');
    const ids = style?.layers.map((layer) => layer.id) ?? [];
    // 물줄기 바로 앞 — 숲 위·waterway 아래(결정 (a)).
    expect(ids.indexOf(HILLSHADE_LAYER_ID)).toBe(ids.indexOf('waterway') - 1);
    valleyLoad.dispose();
    valley.engine.dispose();
  });

  it('초기 시점을 발사 지점으로 게시하고, getCamera 가 그것을 즉시 돌려준다', () => {
    const { engine, surface } = makeEngine();

    // 이벤트가 오기 전에도 동기 호출이 성립해야 한다 — 첫 버튼 조작이
    // 지도 이벤트보다 먼저 들어올 수 있다.
    const camera = engine.getCamera();
    expect(camera.ok).toBe(true);
    expect(camera.ok && camera.value.center.lng).toBe(LAUNCH.lng);
    expect(surface.scene.getSnapshot().initialView.center).toEqual([LAUNCH.lng, LAUNCH.lat]);

    engine.dispose();
  });

  it('스타일 요청이 실패하면 failed 로 남고 지도를 띄우지 않는다', async () => {
    stubFetch({}, false);
    const { engine, surface } = makeEngine();

    const result = await engine.initialize(NONE_CANCELLATION_TOKEN);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('map/style-load-failed');
    expect(engine.state).toBe('failed');
    expect(surface.scene.getSnapshot().style).toBeNull();

    engine.dispose();
  });

  it('스타일을 받는 중 취소되면 지도를 띄우지 않고 idle 로 남는다', async () => {
    const { engine, surface } = makeEngine();
    const lifetime = new CancellationTokenSource();

    const pending = engine.initialize(lifetime.token);
    lifetime.cancel('unmounted');
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('async/cancelled');
    expect(engine.state).toBe('idle');
    expect(surface.scene.getSnapshot().style).toBeNull();

    lifetime.dispose();
    engine.dispose();
  });

  it('스타일 로드 완료를 기다리는 중 취소되면 게시한 스타일을 되돌린다', async () => {
    const { engine, surface } = makeEngine();
    const lifetime = new CancellationTokenSource();

    // 로드 완료를 알리지 않는다 — 엔진이 대기 상태에 들어간 뒤에 취소한다.
    const pending = engine.initialize(lifetime.token);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(surface.scene.getSnapshot().style).not.toBeNull();

    lifetime.cancel('unmounted');
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('async/cancelled');
    expect(engine.state).toBe('idle');
    expect(surface.scene.getSnapshot().style).toBeNull();

    lifetime.dispose();
    engine.dispose();
  });
});

describe('NativeMapEngine scene 게시', () => {
  it('명당 내용을 spots 소스 GeoJSON 으로, 명당 선택을 핀 한 개로 게시한다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const content = await festivalContent();
    expect(engine.renderContent(content).ok).toBe(true);

    const features = surface.scene.getSnapshot().sources[SPOT_SOURCE_ID]?.features;
    expect(features).toHaveLength(content.spots.length);
    expect(features?.[0]?.properties?.['spotId']).toBe(content.spots[0]?.id);
    // 라벨 두 번째 줄의 거리 문자열도 함께 실린다.
    expect(features?.[0]?.properties?.['dist']).toMatch(/km|m/);
    // 계곡·그늘 소스는 빈 채로 **존재**한다 — 뷰가 키를 순회하므로 빠지면 안 된다.
    expect(surface.scene.getSnapshot().sources[SEGMENT_SOURCE_ID]?.features).toEqual([]);
    expect(surface.scene.getSnapshot().sources[FACILITY_SOURCE_ID]?.features).toEqual([]);
    expect(surface.scene.getSnapshot().sources[SHADE_SOURCE_ID]?.features).toEqual([]);

    const first = content.spots[0];
    if (first === undefined) return;
    expect(engine.setSelection({ kind: 'spot', spot: first }).ok).toBe(true);
    expect(surface.scene.getSnapshot().selectedPin).toEqual({
      id: first.id,
      center: [first.position.lng, first.position.lat],
      color: first.color,
    });

    expect(engine.setSelection(null).ok).toBe(true);
    expect(surface.scene.getSnapshot().selectedPin).toBeNull();

    styleLoad.dispose();
    engine.dispose();
  });

  it('구간·시설을 각자 소스에 게시하고 혼잡 상태를 속성으로 싣는다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const content: MapContent = {
      ...(await festivalContent()),
      segments: [UPPER, MID],
      facilities: [PARKING],
      crowd: CROWD,
    };
    expect(engine.renderContent(content).ok).toBe(true);

    const sources = surface.scene.getSnapshot().sources;
    expect(Object.keys(sources).sort()).toEqual(MAP_LAYER_SETS.map((s) => s.sourceId).sort());

    const segments = sources[SEGMENT_SOURCE_ID]?.features;
    expect(segments).toHaveLength(2);
    expect(segments?.[0]?.geometry.type).toBe('LineString');
    expect(segments?.map((f) => f.properties?.['crowd'])).toEqual(['unknown', 'busy']);

    const facilities = sources[FACILITY_SOURCE_ID]?.features;
    expect(facilities).toHaveLength(1);
    expect(facilities?.[0]?.properties?.['facilityType']).toBe('parking');
    expect(sources[SPOT_SOURCE_ID]?.features).toHaveLength(content.spots.length);

    styleLoad.dispose();
    engine.dispose();
  });

  it('바뀌지 않은 소스는 이전 컬렉션 참조를 그대로 둔다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const content: MapContent = {
      ...(await festivalContent()),
      segments: [UPPER, MID],
      crowd: CROWD,
    };
    engine.renderContent(content);
    const before = surface.scene.getSnapshot().sources;

    // 혼잡만 새 참조 — 구간 소스만 바뀌고 명당·시설 소스는 같은 객체여야 한다.
    engine.renderContent({ ...content, crowd: new Map(CROWD).set(UPPER.id, 'available') });
    const after = surface.scene.getSnapshot().sources;
    expect(after[SEGMENT_SOURCE_ID]).not.toBe(before[SEGMENT_SOURCE_ID]);
    expect(after[SPOT_SOURCE_ID]).toBe(before[SPOT_SOURCE_ID]);
    expect(after[FACILITY_SOURCE_ID]).toBe(before[FACILITY_SOURCE_ID]);

    // 같은 참조를 다시 넘기면 게시 자체가 일어나지 않는다.
    engine.renderContent(content);
    const settled = surface.scene.getSnapshot();
    engine.renderContent(content);
    expect(surface.scene.getSnapshot()).toBe(settled);

    styleLoad.dispose();
    engine.dispose();
  });

  it('그늘 오버레이는 shade 소스에만 실리고, 시각이 바뀌면 그 소스만 새 참조다 (F4)', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const ring = [
      [127.26, 37.83],
      [127.261, 37.83],
      [127.261, 37.831],
      [127.26, 37.83],
    ] as const;
    const base: MapContent = { ...EMPTY_MAP_CONTENT, segments: [UPPER, MID], crowd: CROWD };
    engine.renderContent(base);
    const before = surface.scene.getSnapshot().sources;
    expect(before[SHADE_SOURCE_ID]?.features).toEqual([]);

    engine.renderContent({ ...base, shade: { canopy: [[ring]], shadow: [] } });
    const noon = surface.scene.getSnapshot().sources;
    expect(noon[SHADE_SOURCE_ID]?.features).toHaveLength(1);
    expect(noon[SHADE_SOURCE_ID]?.features[0]?.properties?.['layer']).toBe('canopy');
    expect(noon[SEGMENT_SOURCE_ID]).toBe(before[SEGMENT_SOURCE_ID]);
    expect(noon[FACILITY_SOURCE_ID]).toBe(before[FACILITY_SOURCE_ID]);

    engine.renderContent({ ...base, shade: { canopy: [[ring]], shadow: [[ring]] } });
    const late = surface.scene.getSnapshot().sources;
    expect(late[SHADE_SOURCE_ID]).not.toBe(noon[SHADE_SOURCE_ID]);
    expect(late[SHADE_SOURCE_ID]?.features.map((f) => f.properties?.['layer'])).toEqual([
      'canopy',
      'shadow',
    ]);
    expect(late[SEGMENT_SOURCE_ID]).toBe(before[SEGMENT_SOURCE_ID]);

    styleLoad.dispose();
    engine.dispose();
  });

  it('선택 종류별 핀 — 시설·구간은 핀 없이 selected 재주입(시설 마커가 이미 핀, C5)', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    engine.renderContent({
      ...EMPTY_MAP_CONTENT,
      segments: [UPPER, MID],
      facilities: [PARKING],
      crowd: CROWD,
    });

    expect(engine.setSelection({ kind: 'facility', facility: PARKING }).ok).toBe(true);
    let scene = surface.scene.getSnapshot();
    // 시설 선택 핀은 세우지 않는다 — 시설 레이어의 `selected` 가 핀 확대 + 흰 링(`facility/<type>/selected`).
    expect(scene.selectedPin).toBeNull();
    expect(scene.sources[FACILITY_SOURCE_ID]?.features[0]?.properties?.['selected']).toBe(true);

    expect(engine.setSelection({ kind: 'segment', segment: MID }).ok).toBe(true);
    scene = surface.scene.getSnapshot();
    expect(scene.selectedPin).toBeNull();
    expect(
      scene.sources[SEGMENT_SOURCE_ID]?.features.map((f) => f.properties?.['selected']),
    ).toEqual([false, true]);
    // 시설 선택이 풀렸으니 시설 소스의 selected 도 내려간다.
    expect(scene.sources[FACILITY_SOURCE_ID]?.features[0]?.properties?.['selected']).toBe(false);

    expect(engine.setSelection(null).ok).toBe(true);
    scene = surface.scene.getSnapshot();
    expect(
      scene.sources[SEGMENT_SOURCE_ID]?.features.every((f) => f.properties?.['selected'] === false),
    ).toBe(true);

    styleLoad.dispose();
    engine.dispose();
  });

  it('지도 뷰가 알려 온 시점이 camera-change 로 올라온다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const seen: number[] = [];
    const subscription = engine.events.on('camera-change', (pose) => seen.push(pose.bearing));

    surface.reportViewState({ center: [127, 37.5], zoom: 15, pitch: 60, bearing: 41 });
    expect(seen).toEqual([41]);
    expect(engine.getCamera().ok && engine.getCamera().value?.bearing).toBe(41);

    subscription.dispose();
    styleLoad.dispose();
    engine.dispose();
  });

  it('소스별 press 를 종류가 붙은 feature-press 로, 빈 곳 press 는 그대로 옮긴다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const pressed: MapFeatureRef[] = [];
    let background = 0;
    engine.events.on('feature-press', (ref) => pressed.push(ref));
    engine.events.on('background-press', () => {
      background += 1;
    });

    surface.reportFeaturePress(SPOT_SOURCE_ID, 'yeouido');
    surface.reportFeaturePress(SEGMENT_SOURCE_ID, 'sample-mid');
    surface.reportFeaturePress(FACILITY_SOURCE_ID, 'sample-parking-1');
    surface.reportFeaturePress('unknown-source', 'x'); // 배선 불일치 — 무시
    surface.reportFeaturePress(SHADE_SOURCE_ID, 'canopy'); // 히트 대상이 아닌 셋(F4) — 무시
    surface.reportBackgroundPress();

    expect(pressed).toEqual([
      { kind: 'spot', id: 'yeouido' },
      { kind: 'segment', id: 'sample-mid' },
      { kind: 'facility', id: 'sample-parking-1' },
    ]);
    expect(background).toBe(1);

    styleLoad.dispose();
    engine.dispose();
  });
});

describe('NativeMapEngine 제스처 정책', () => {
  it('내려온 정책을 scene 에 그대로 게시한다', async () => {
    /* 네이티브에서 제스처는 `<Map>` 의 prop 이라 명령형으로 적용할 수 없다.
       스냅샷을 거쳐 표현 계층에 닿는 경로가 성립하는지 고정한다. */
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const policy = {
      pan: true,
      pinchZoom: true,
      pinchRotate: false,
      doubleTapZoom: true,
      quickZoom: false,
      dragPitch: true,
    } as const;

    expect(engine.setGestures(policy).ok).toBe(true);
    expect(surface.scene.getSnapshot().gestures).toEqual(policy);

    styleLoad.dispose();
    engine.dispose();
  });

  it('dispose 뒤에는 정책을 받지 않는다', () => {
    const { engine } = makeEngine();
    engine.dispose();

    const result = engine.setGestures(DEFAULT_MAP_GESTURES);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('map/not-initialized');
  });
});

describe('NativeMapEngine 카메라', () => {
  it('이동은 지도가 정착을 알릴 때까지 기다린다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const stops: unknown[] = [];
    surface.attachCamera({
      setStop: (stop) => {
        stops.push(stop);
        return true;
      },
    });

    let settled = false;
    const move = engine.moveCamera(focusSpot(LAUNCH), NONE_CANCELLATION_TOKEN).then((result) => {
      settled = true;
      return result;
    });

    // 명령은 곧바로 내려가지만 아직 끝나지 않았다.
    expect(stops).toHaveLength(1);
    await Promise.resolve();
    expect(settled).toBe(false);

    surface.reportSettled({
      center: [LAUNCH.lng, LAUNCH.lat],
      zoom: 15.4,
      pitch: 64,
      bearing: -22,
    });
    expect((await move).ok).toBe(true);

    styleLoad.dispose();
    engine.dispose();
  });

  it('취소되면 즉시 돌아오고 진행 중인 애니메이션을 끊는다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const stops: { duration?: number }[] = [];
    surface.attachCamera({
      setStop: (stop) => {
        stops.push(stop);
        return true;
      },
    });

    const lifetime = new CancellationTokenSource();
    const move = engine.moveCamera(focusSpot(LAUNCH), lifetime.token);
    lifetime.cancel('preempted');

    const result = await move;
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('async/cancelled');
    // 두 번째 stop 은 정지용(duration 0)이다 — web 의 `map.stop()` 자리.
    expect(stops).toHaveLength(2);
    expect(stops[1]?.duration).toBe(0);

    lifetime.dispose();
    styleLoad.dispose();
    engine.dispose();
  });

  it('지도 뷰가 아직 없으면 이동이 조용히 성공하지 않는다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const result = await engine.moveCamera(focusSpot(LAUNCH), NONE_CANCELLATION_TOKEN);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('map/not-initialized');

    styleLoad.dispose();
    engine.dispose();
  });
});

describe('NativeMapEngine 능력 부족', () => {
  it('불꽃 토글은 지원하지 않음을 돌려준다', () => {
    const { engine } = makeEngine();

    const result = engine.setFireworksEnabled(true);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('map/capability-unsupported');
    expect(engine.capabilities.particleLayer).toBe(false);

    engine.dispose();
  });

  it('globe 투영 요청은 거절하고 mercator 요청만 받는다', () => {
    const { engine } = makeEngine();

    expect(engine.setProjection('mercator').ok).toBe(true);
    const globe = engine.setProjection('globe');
    expect(globe.ok).toBe(false);
    expect(!globe.ok && globe.error.code).toBe('map/capability-unsupported');

    engine.dispose();
  });

  it('dispose 뒤에는 게시도 조회도 하지 않는다', async () => {
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    engine.dispose();

    expect(engine.state).toBe('disposed');
    expect(surface.scene.getSnapshot().style).toBeNull();
    expect(engine.getCamera().ok).toBe(false);
    expect(engine.setSelection(null).ok).toBe(false);
    expect(engine.renderContent(EMPTY_MAP_CONTENT).ok).toBe(false);

    styleLoad.dispose();
  });
});

describe('NativeMapEngine 물줄기 흐름 (C10c)', () => {
  it('켜면 타이머가 점선 위상을 밀어 게시하고, 끄면 덧쓰기가 비며, 같은 값은 no-op', async () => {
    vi.useFakeTimers();
    const { engine, surface } = makeEngine({ terrain: true });
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);
    // 흐름 전에는 계곡 paint(다크 케이싱, 그늘 꺼짐)만 — V1.
    const idle = valleyPaintOverrides('dark', { shadeVisible: false });
    expect(surface.scene.getSnapshot().layerPaintOverrides).toEqual(idle);

    expect(engine.setWaterFlowEnabled(true).ok).toBe(true);
    vi.advanceTimersByTime(FLOW_FRAME_MS);
    const first = surface.scene.getSnapshot().layerPaintOverrides[FLOW_DASH_LAYER_ID];
    expect(first).toEqual({ 'line-dasharray': [0.5, 4, 2.5] });
    vi.advanceTimersByTime(FLOW_FRAME_MS);
    expect(surface.scene.getSnapshot().layerPaintOverrides[FLOW_DASH_LAYER_ID]).toEqual({
      'line-dasharray': [1, 4, 2],
    });

    // 같은 값은 타이머를 다시 만들지 않는다 — 위상이 이어진다.
    expect(engine.setWaterFlowEnabled(true).ok).toBe(true);
    vi.advanceTimersByTime(FLOW_FRAME_MS);
    expect(surface.scene.getSnapshot().layerPaintOverrides[FLOW_DASH_LAYER_ID]).toEqual({
      'line-dasharray': [1.5, 4, 1.5],
    });

    // 흐름 중에도 계곡 paint 는 남아 있고, 끄면 흐름 항목만 빠진다.
    expect(surface.scene.getSnapshot().layerPaintOverrides[SEGMENT_CASING_LAYER_ID]).toEqual(
      idle[SEGMENT_CASING_LAYER_ID],
    );
    expect(engine.setWaterFlowEnabled(false).ok).toBe(true);
    expect(surface.scene.getSnapshot().layerPaintOverrides).toEqual(idle);
    const snapshot = surface.scene.getSnapshot();
    vi.advanceTimersByTime(FLOW_FRAME_MS * 3);
    expect(surface.scene.getSnapshot()).toBe(snapshot);

    styleLoad.dispose();
    engine.dispose();
  });

  it('dispose 는 타이머를 멈춘다', async () => {
    vi.useFakeTimers();
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);
    engine.setWaterFlowEnabled(true);
    vi.advanceTimersByTime(FLOW_FRAME_MS);
    styleLoad.dispose();
    engine.dispose();
    const after = surface.scene.getSnapshot();
    vi.advanceTimersByTime(FLOW_FRAME_MS * 5);
    expect(surface.scene.getSnapshot()).toBe(after);
    expect(after.layerPaintOverrides).toEqual({});
  });
});

describe('NativeMapEngine 계곡 paint (V1)', () => {
  it('스타일 게시부터 다크 케이싱 색이 실리고, 그늘이 켜지면 음영 0.2·수관 0.4, 꺼지면 복귀', async () => {
    const { engine, surface } = makeEngine({ terrain: true });
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);

    const off = valleyPaintOverrides('dark', { shadeVisible: false });
    expect(surface.scene.getSnapshot().layerPaintOverrides).toEqual(off);
    expect(off[SEGMENT_CASING_LAYER_ID]).toEqual({ 'line-color': '#0c0c0c' });

    const base: MapContent = { ...EMPTY_MAP_CONTENT, segments: [UPPER, MID], crowd: CROWD };
    engine.renderContent(base);
    const before = surface.scene.getSnapshot();
    expect(before.layerPaintOverrides).toEqual(off);

    // 같은 그늘 상태의 renderContent 는 덧쓰기를 다시 게시하지 않는다(참조 유지).
    engine.renderContent({ ...base, facilities: [PARKING] });
    expect(surface.scene.getSnapshot().layerPaintOverrides).toBe(before.layerPaintOverrides);

    const ring = [
      [127.26, 37.83],
      [127.261, 37.83],
      [127.261, 37.831],
      [127.26, 37.83],
    ] as const;
    engine.renderContent({ ...base, shade: { canopy: [[ring]], shadow: [] } });
    const on = surface.scene.getSnapshot().layerPaintOverrides;
    expect(on).toEqual(valleyPaintOverrides('dark', { shadeVisible: true }));
    expect(on[HILLSHADE_LAYER_ID]).toEqual({ 'hillshade-exaggeration': 0.2 });
    expect(on[SHADE_CANOPY_LAYER_ID]).toEqual({ 'fill-opacity': 0.4 });
    expect(on[SEGMENT_CASING_LAYER_ID]).toEqual({ 'line-color': '#0c0c0c' });

    engine.renderContent(base);
    expect(surface.scene.getSnapshot().layerPaintOverrides).toEqual(off);

    styleLoad.dispose();
    engine.dispose();
    expect(surface.scene.getSnapshot().layerPaintOverrides).toEqual({});
  });

  it('흐름 점선과 계곡 paint 는 서로를 지우지 않는다', async () => {
    vi.useFakeTimers();
    const { engine, surface } = makeEngine({ terrain: true });
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);
    engine.setWaterFlowEnabled(true);
    vi.advanceTimersByTime(FLOW_FRAME_MS);

    engine.renderContent({
      ...EMPTY_MAP_CONTENT,
      segments: [UPPER],
      shade: { canopy: [], shadow: [] },
    });
    const merged = surface.scene.getSnapshot().layerPaintOverrides;
    expect(merged[FLOW_DASH_LAYER_ID]).toEqual({ 'line-dasharray': [0.5, 4, 2.5] });
    expect(merged[SHADE_CANOPY_LAYER_ID]).toEqual({ 'fill-opacity': 0.4 });

    vi.advanceTimersByTime(FLOW_FRAME_MS);
    const next = surface.scene.getSnapshot().layerPaintOverrides;
    expect(next[FLOW_DASH_LAYER_ID]).toEqual({ 'line-dasharray': [1, 4, 2] });
    expect(next[SHADE_CANOPY_LAYER_ID]).toEqual({ 'fill-opacity': 0.4 });

    styleLoad.dispose();
    engine.dispose();
  });
});

describe('NativeMapEngine 베이스맵 헬스 (C7)', () => {
  it('ready 뒤 onDidFailLoadingMap 이 8초 동안 이어지면 장애, 실패 직후의 완전 렌더는 무시, 뒤의 렌더는 회복', async () => {
    vi.useFakeTimers();
    const { engine, surface } = makeEngine();
    const styleLoad = completeStyleLoad(surface);
    const health: BaseMapHealth[] = [];
    const sub = engine.events.on('basemap-health', (h) => health.push(h));
    await engine.initialize(NONE_CANCELLATION_TOKEN);
    expect(health).toEqual([]);

    surface.reportStyleFailed();
    expect(health.at(-1)?.armedAt).not.toBeNull();
    // 같은 프레임의 "완전히 그려졌다" 는 오류난 타일도 완료로 치는 신호 — 세지 않는다.
    vi.advanceTimersByTime(NATIVE_SUCCESS_QUIET_MS - 1);
    surface.reportRendered();
    expect(health.at(-1)?.armedAt).not.toBeNull();
    surface.reportStyleFailed();
    vi.advanceTimersByTime(OUTAGE_SUSTAIN_MS);
    expect(health.at(-1)?.outage).toBe(true);
    expect(health.at(-1)?.failures).toBe(2);

    // 마지막 실패에서 무시 구간이 지난 뒤의 렌더는 회복.
    surface.reportRendered();
    expect(health.at(-1)).toBe(INITIAL_BASE_MAP_HEALTH);

    sub.dispose();
    styleLoad.dispose();
    engine.dispose();
  });

  it('retryBaseMap 은 같은 스타일을 새 참조로 게시하고 헬스를 처음으로 — ready 전에는 실패', async () => {
    vi.useFakeTimers();
    const { engine, surface } = makeEngine();
    expect(engine.retryBaseMap().ok).toBe(false);

    const styleLoad = completeStyleLoad(surface);
    const health: BaseMapHealth[] = [];
    const sub = engine.events.on('basemap-health', (h) => health.push(h));
    await engine.initialize(NONE_CANCELLATION_TOKEN);
    const before = surface.scene.getSnapshot();
    surface.reportStyleFailed();
    vi.advanceTimersByTime(OUTAGE_SUSTAIN_MS);
    expect(health.at(-1)?.outage).toBe(true);

    expect(engine.retryBaseMap().ok).toBe(true);
    const after = surface.scene.getSnapshot();
    expect(after.style).not.toBe(before.style);
    expect(after.style).toEqual(before.style);
    // 소스·핀·paint 는 그대로.
    expect(after.sources).toBe(before.sources);
    expect(after.layerPaintOverrides).toBe(before.layerPaintOverrides);
    expect(health.at(-1)).toBe(INITIAL_BASE_MAP_HEALTH);

    sub.dispose();
    styleLoad.dispose();
    engine.dispose();
  });

  it('초기화 중의 style-failed 는 헬스가 아니라 초기화 실패다', async () => {
    const { engine, surface } = makeEngine();
    const health: BaseMapHealth[] = [];
    const sub = engine.events.on('basemap-health', (h) => health.push(h));
    const failing = surface.scene.subscribe(() => {
      if (surface.scene.getSnapshot().style !== null)
        queueMicrotask(() => surface.reportStyleFailed());
    });
    const result = await engine.initialize(NONE_CANCELLATION_TOKEN);
    expect(result.ok).toBe(false);
    expect(engine.state).toBe('failed');
    expect(health).toEqual([]);
    failing.dispose();
    sub.dispose();
    engine.dispose();
  });

  it('개발용 오리진 교체 — 스타일 URL 과 소스 URL 이 프록시로 바뀐다', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      calls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ...RAW_STYLE,
            sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
          }),
      });
    });
    const logger = new NoopLogger();
    const surface = new MapSurface(logger);
    const engine = new NativeMapEngine({
      surface,
      launchSite: LAUNCH,
      logger,
      styleMode: 'dark',
      baseMapOriginOverride: 'http://localhost:8099',
    });
    const styleLoad = completeStyleLoad(surface);
    await engine.initialize(NONE_CANCELLATION_TOKEN);
    expect(calls).toEqual(['http://localhost:8099/styles/dark']);
    const source = surface.scene.getSnapshot().style?.sources.omt as { url?: string } | undefined;
    expect(source?.url).toBe('http://localhost:8099/planet');
    styleLoad.dispose();
    engine.dispose();
  });
});
