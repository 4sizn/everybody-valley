import { cameraCommand, LngLat, NONE_CANCELLATION_TOKEN, NoopLogger } from '@modu-valley/core';
import { afterEach, expect, it, vi } from 'vitest';
import { FIREWORK_LAYER_ID } from '../src/fireworks/FireworkLayer';
import { MapLibreEngine } from '../src/map/MapLibreEngine';

// 브라우저/GPU 경계만 대체하고 실제 엔진 초기화와 레이어 설치 경로를 실행한다.
const map = vi.hoisted(() => ({
  addControl: vi.fn(),
  setMissingStyleImageResolver: vi.fn(),
  isStyleLoaded: () => true,
  setProjection: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getStyle: () => ({ layers: [] }),
  getLayer: () => undefined,
  getSource: () => undefined,
  getCanvas: () => ({ style: {} }),
  getCenter: () => ({ lng: 127, lat: 35 }),
  getZoom: () => 14,
  getPitch: () => 0,
  getBearing: () => 0,
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  stop: vi.fn(),
  remove: vi.fn(),
  setCenterClampedToGround: vi.fn(),
  isSourceLoaded: () => true,
  getCanvasContainer: () => ({ style: {} }),
}));

vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor() {
      Object.assign(this, map);
    }
  },
  NavigationControl: class {},
  Marker: class {},
  setWorkerUrl: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each(['light', 'dark'] as const)(
  '%s: 일반 지도는 불꽃 없이 초기화하고 데모만 명시적으로 켠다',
  async (styleMode) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ version: 8, sources: {}, layers: [] }))),
    );
    const center = LngLat.create(127, 35);
    if (!center.ok) throw center.error;

    for (const options of [{}, { fireworks: false }, { fireworks: true }]) {
      map.addLayer.mockClear();
      const engine = new MapLibreEngine({
        container: { style: {} } as unknown as HTMLElement,
        launchSite: center.value,
        logger: new NoopLogger(),
        styleMode,
        ...options,
      });
      try {
        expect(await engine.initialize(NONE_CANCELLATION_TOKEN)).toEqual({
          ok: true,
          value: undefined,
        });
        expect(map.addLayer.mock.calls.length).toBeGreaterThan(0);
        const fireworks = map.addLayer.mock.calls.filter(
          ([layer]) => layer.id === FIREWORK_LAYER_ID,
        );
        expect(fireworks).toHaveLength(options.fireworks === true ? 1 : 0);
        expect(engine.capabilities.particleLayer).toBe(options.fireworks === true);
      } finally {
        engine.dispose();
      }
    }
  },
);

it('지형을 켜도 중심 고도를 직접 건드리지 않는다 — 엔진의 centerClampedToGround 에 맡긴다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ version: 8, sources: {}, layers: [] }))),
  );
  const setCenterElevation = vi.fn();
  Object.assign(map, {
    getTerrain: () => ({}),
    setTerrain: vi.fn(),
    queryTerrainElevation: () => 268,
    getCenterElevation: () => 0,
    setCenterElevation,
  });

  const center = LngLat.create(127, 35);
  if (!center.ok) throw center.error;
  const engine = new MapLibreEngine({
    container: { style: {} } as unknown as HTMLElement,
    launchSite: center.value,
    logger: new NoopLogger(),
    styleMode: 'light',
    terrain: true,
  });
  try {
    expect((await engine.initialize(NONE_CANCELLATION_TOKEN)).ok).toBe(true);

    /* 손으로 맞추던 시절 여기에 `moveend`·`idle` 핸들러가 걸려 있었다. 그 보정이
       `jumpTo` 로 비행을 죽이고 화면을 밀었다 — 다시 생기면 이 테스트가 잡는다. */
    for (const [event, handler] of map.on.mock.calls) {
      if (event === 'moveend' || event === 'idle') (handler as () => void)();
    }
    expect(setCenterElevation).not.toHaveBeenCalled();
  } finally {
    engine.dispose();
  }
});

it('지형은 타일이 다 온 뒤에 켜고, 첫 카메라 명령은 그 뒤에 움직인다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ version: 8, sources: {}, layers: [] }))),
  );
  let clock = 0;
  vi.stubGlobal('performance', { now: () => clock });
  const frames: (() => void)[] = [];
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  let sourceLoaded = false;
  const setTerrain = vi.fn();
  let risen = 0;
  const rise = (): number => {
    risen = Math.min(risen + 20, 80);
    return risen;
  };
  const easeTo = vi.fn();
  const style: Record<string, string> = {};
  Object.assign(map, {
    setTerrain,
    setCenterClampedToGround: vi.fn(),
    isSourceLoaded: () => sourceLoaded,
    isMoving: () => false,
    getCanvasContainer: () => ({ style }),
    getContainer: () => ({ clientWidth: 400, clientHeight: 800, style: {} }),
    // 지형이 켜진 뒤 몇 프레임에 걸쳐 지면이 솟는 것을 흉내낸다.
    project: () => ({ x: 200, y: setTerrain.mock.calls.length === 0 ? 400 : 400 - rise() }),
    queryTerrainElevation: () => 268,
    easeTo,
  });

  const center = LngLat.create(127, 35);
  if (!center.ok) throw center.error;
  const engine = new MapLibreEngine({
    container: { style: {} } as unknown as HTMLElement,
    launchSite: center.value,
    logger: new NoopLogger(),
    styleMode: 'light',
    terrain: true,
  });
  try {
    expect((await engine.initialize(NONE_CANCELLATION_TOKEN)).ok).toBe(true);
    /* 타일이 오기 전에 켜 두면 도착할 때마다 지면이 솟아 화면이 훅 밀린다 — 그게 "튐"이었다. */
    expect(setTerrain).not.toHaveBeenCalled();

    void engine.moveCamera(
      cameraCommand({ zoom: 15 }, { motion: 'ease', durationMs: 400 }),
      NONE_CANCELLATION_TOKEN,
    );
    await Promise.resolve();
    expect(easeTo).not.toHaveBeenCalled();

    sourceLoaded = true;
    const sourcedata = map.on.mock.calls.find(([event]) => event === 'sourcedata')?.[1] as (
      payload?: unknown,
    ) => void;
    sourcedata();
    // 흐려진 뒤에 켠다 — 타이머가 돌 때까지는 아직.
    expect(setTerrain).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(setTerrain).toHaveBeenCalledTimes(1);

    // 지면이 멈출 때까지 지켜본 뒤에야 카메라가 움직인다.
    for (let i = 0; i < 80 && frames.length > 0; i += 1) {
      clock += 16;
      frames.shift()?.();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(easeTo).toHaveBeenCalledTimes(1);
  } finally {
    engine.dispose();
  }
});
