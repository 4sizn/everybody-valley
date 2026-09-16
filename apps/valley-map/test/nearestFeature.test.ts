/**
 * 네이티브 지도 탭의 겹친 피처 재선정(X2) — web `FeatureLayerController.test.ts`
 * 의 네이티브 짝. 안골계곡 실측 사례(떡볶이 대박집 vs 호국로 주차장)를 좌표로
 * 고정해 둔다.
 */
import { describe, expect, it } from 'vitest';
import { nearestFeatureByLngLat } from '../src/platform/native/nearestFeature';

function pointFeature(facilityId: string, coordinates: [number, number]): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { facilityId },
    geometry: { type: 'Point', coordinates },
  };
}

describe('nearestFeatureByLngLat', () => {
  it('겹친 탭은 좌표가 가장 가까운 피처를 고른다', () => {
    // 실측: '떡볶이 대박집'(food) 탭 지점 — 이전 코드라면 features[0] 인 '호국로
    // 주차장' 이 뽑혔다.
    const tapped = pointFeature('angol-osm-food-4632060362', [127.027324, 37.7433]);
    const farParking = pointFeature('angol-std-p-207-2-000064', [127.02714, 37.742871]);

    const picked = nearestFeatureByLngLat(
      [127.0274, 37.74331], // 탭 지점 — 'tapped' 바로 위, 'farParking' 보다 훨씬 가깝다
      [farParking, tapped],
    );

    expect(picked?.properties?.facilityId).toBe('angol-osm-food-4632060362');
  });

  it('점이 하나만 잡히면 그대로 쓴다(회귀 없음)', () => {
    const only = pointFeature('only-facility', [127, 37]);
    expect(nearestFeatureByLngLat([999, 999], [only])).toBe(only);
  });

  it('점 지오메트리가 아닌 피처만 있으면 첫 피처를 그대로 쓴다', () => {
    const line: GeoJSON.Feature = {
      type: 'Feature',
      properties: { segmentId: 'seg-1' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
    };
    expect(nearestFeatureByLngLat([0.5, 0.5], [line])).toBe(line);
  });
});
