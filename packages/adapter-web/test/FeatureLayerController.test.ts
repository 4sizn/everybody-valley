import { Emitter, type MapEngineEvents, type MapFeatureRef, NoopLogger } from '@modu-valley/core';
import { FACILITY_LAYER_SET, FACILITY_PIN_LAYER_ID } from '@modu-valley/map-style';
import type { GeoJSON } from 'geojson';
import type { MapGeoJSONFeature, Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { FeatureLayerController } from '../src/map/FeatureLayerController';

type Registered = {
  readonly type: string;
  readonly layerId: string;
  readonly handler: (event: unknown) => void;
};

/** maplibre `Map` 중 `FeatureLayerController` 가 만지는 조각. `on` 은 핸들러를 기록만 한다 — 테스트가 직접 부른다. */
function fakeMap() {
  const registered: Registered[] = [];
  const map = {
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getStyle: vi.fn(() => ({ layers: [] })),
    getSource: vi.fn(() => ({ setData: vi.fn() })),
    getLayer: vi.fn(() => undefined),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getCanvas: vi.fn(() => ({ style: {} }) as unknown as HTMLCanvasElement),
    project: vi.fn(),
    on: vi.fn((type: string, layerId: string, handler: (event: unknown) => void) => {
      registered.push({ type, layerId, handler });
    }),
    off: vi.fn(),
  };
  return { map: map as unknown as MapLibreMap, registered };
}

/** 점 피처 하나 — `nearestFeature` 가 보는 조각(속성 + Point 지오메트리)만 채운다. */
function pointFeature(facilityId: string, coordinates: [number, number]): MapGeoJSONFeature {
  return {
    properties: { facilityId },
    geometry: { type: 'Point', coordinates } as GeoJSON.Point,
  } as unknown as MapGeoJSONFeature;
}

describe('FeatureLayerController — 시설 히트 테스트', () => {
  it('클릭 지점에 점이 여럿 잡히면 화면상 가장 가까운 것을 고른다(X2)', () => {
    const { map } = fakeMap();
    const events = new Emitter<MapEngineEvents>();
    const controller = new FeatureLayerController(
      map,
      FACILITY_LAYER_SET,
      events,
      new NoopLogger(),
    );
    expect(controller.install().ok).toBe(true);

    const onClick = (
      map.on as unknown as { mock: { calls: [string, string, (event: unknown) => void][] } }
    ).mock.calls.find(
      ([type, layerId]) => type === 'click' && layerId === FACILITY_PIN_LAYER_ID,
    )?.[2];
    expect(onClick).toBeDefined();

    // '멀다' 는 queryRenderedFeatures 가 [0] 으로 준 것 — 이전 코드라면 이게 뽑혔다.
    // '가깝다' 가 실제로 탭한 픽셀에 더 가깝다.
    const far = pointFeature('far-facility', [10, 10]);
    const near = pointFeature('near-facility', [20, 20]);
    (map.project as ReturnType<typeof vi.fn>).mockImplementation((coordinates: [number, number]) =>
      coordinates[0] === 10 ? { x: 500, y: 500 } : { x: 101, y: 101 },
    );

    const pressed: MapFeatureRef[] = [];
    events.on('feature-press', (feature) => pressed.push(feature));

    onClick?.({
      preventDefault: vi.fn(),
      point: { x: 100, y: 100 },
      features: [far, near],
    });

    expect(pressed).toEqual([{ kind: 'facility', id: 'near-facility' }]);
  });

  it('점이 하나만 잡히면 그대로 쓴다(회귀 없음)', () => {
    const { map } = fakeMap();
    const events = new Emitter<MapEngineEvents>();
    const controller = new FeatureLayerController(
      map,
      FACILITY_LAYER_SET,
      events,
      new NoopLogger(),
    );
    controller.install();

    const onClick = (
      map.on as unknown as { mock: { calls: [string, string, (event: unknown) => void][] } }
    ).mock.calls.find(
      ([type, layerId]) => type === 'click' && layerId === FACILITY_PIN_LAYER_ID,
    )?.[2];

    const pressed: MapFeatureRef[] = [];
    events.on('feature-press', (feature) => pressed.push(feature));

    onClick?.({
      preventDefault: vi.fn(),
      point: { x: 0, y: 0 },
      features: [pointFeature('only-facility', [1, 1])],
    });

    expect(pressed).toEqual([{ kind: 'facility', id: 'only-facility' }]);
    expect(map.project).not.toHaveBeenCalled();
  });
});
