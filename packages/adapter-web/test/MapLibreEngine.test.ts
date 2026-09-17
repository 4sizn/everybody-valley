import { LngLat, NONE_CANCELLATION_TOKEN, NoopLogger } from '@modu-valley/core';
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
  off: vi.fn(),
  stop: vi.fn(),
  remove: vi.fn(),
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
        container: {} as HTMLElement,
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
