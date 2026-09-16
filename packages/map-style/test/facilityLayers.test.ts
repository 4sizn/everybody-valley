import { FACILITY_TYPES } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { FACILITY_PIN_TIP_INSET, facilityIconId } from '../src/facilityIcons';
import {
  FACILITY_ICON_IMAGE,
  FACILITY_ICON_OFFSET,
  FACILITY_LAYER_SET,
  FACILITY_PIN_LAYER,
  FACILITY_PIN_LAYER_ID,
  FACILITY_SOURCE_ID,
  readFacilityFeatureId,
  toFacilityFeatureCollection,
} from '../src/facilityLayers';
import { FACILITIES, PARKING, STORE } from './fixtures';

describe('toFacilityFeatureCollection', () => {
  it('시설마다 Point 피처 하나, 좌표는 [lng, lat] 순서', () => {
    const { features } = toFacilityFeatureCollection(FACILITIES);
    expect(features).toHaveLength(2);
    expect(features[0]?.geometry).toEqual({ type: 'Point', coordinates: [127.2701, 37.8262] });
    expect(features[0]?.properties).toEqual({
      facilityId: 'sample-parking-1',
      valleyId: 'sample',
      name: '하류 공영주차장',
      facilityType: 'parking',
      selected: false,
    });
  });

  it('선택 id 를 받은 시설만 selected 가 true', () => {
    const { features } = toFacilityFeatureCollection(FACILITIES, STORE.id);
    expect(features.map((f) => f.properties.selected)).toEqual([false, true]);
  });

  it('readFacilityFeatureId 는 만든 속성에서 id 를 되읽는다', () => {
    const feature = toFacilityFeatureCollection([PARKING]).features[0];
    expect(readFacilityFeatureId(feature?.properties)).toBe('sample-parking-1');
    expect(readFacilityFeatureId({ segmentId: 'sample-mid' })).toBeUndefined();
    expect(readFacilityFeatureId('sample-parking-1')).toBeUndefined();
  });
});

/** `FACILITY_ICON_IMAGE` 를 피처 속성으로 손 평가한다 — 표현식이 `facilityIconId` 와 같은 ID 를 내는지. */
function evaluateIconImage(facilityType: string, selected: boolean): string {
  const [op, prefix, match, suffixCase] = FACILITY_ICON_IMAGE as unknown as [
    string,
    string,
    readonly unknown[],
    readonly unknown[],
  ];
  expect(op).toBe('concat');
  const body = match.slice(2, -1);
  const fallback = match[match.length - 1];
  const index = body.indexOf(facilityType);
  const type = index >= 0 && index % 2 === 0 ? body[index + 1] : fallback;
  const suffix = selected ? suffixCase[2] : suffixCase[3];
  return `${prefix}${String(type)}${String(suffix)}`;
}

describe('시설 핀 심볼 레이어 — C5 결정 (a)(c)(d)', () => {
  it('icon-image 는 9종 모두 facilityIconId 와 같은 ID 를 내고, 모르는 종류는 etc 핀', () => {
    for (const type of FACILITY_TYPES) {
      expect(evaluateIconImage(type, false)).toBe(facilityIconId(type, false));
      expect(evaluateIconImage(type, true)).toBe(facilityIconId(type, true));
    }
    expect(evaluateIconImage('convenience', false)).toBe(facilityIconId('etc', false));
    expect(FACILITY_ICON_IMAGE).not.toContain('convenience');
  });

  it('핀 한 장: 같은 소스, 꼭짓점 앵커, 항상 그리고 자리 안 빼앗음, 선택 시 링 두께 보정', () => {
    expect(FACILITY_PIN_LAYER.source).toBe(FACILITY_SOURCE_ID);
    expect(FACILITY_PIN_LAYER.type).toBe('symbol');
    expect(FACILITY_PIN_LAYER.layout).toEqual({
      'icon-image': FACILITY_ICON_IMAGE,
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-offset': FACILITY_ICON_OFFSET,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    });
    expect(FACILITY_PIN_LAYER.paint).toBeUndefined();
    expect(FACILITY_ICON_OFFSET).toEqual([
      'case',
      ['boolean', ['get', 'selected'], false],
      ['literal', [0, FACILITY_PIN_TIP_INSET.selected]],
      ['literal', [0, 0]],
    ]);
  });

  it('레이어 셋은 핀 한 장, 히트 대상도 그 한 장 — 원·이니셜 레이어는 없다', () => {
    expect(FACILITY_LAYER_SET.layers.map((layer) => layer.id)).toEqual([FACILITY_PIN_LAYER_ID]);
    expect(FACILITY_LAYER_SET.interactiveLayerIds).toEqual([FACILITY_PIN_LAYER_ID]);
    expect(FACILITY_PIN_LAYER_ID).toBe('valley-facility-pin');
  });
});
