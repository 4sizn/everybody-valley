/**
 * 베이스맵 호스트 목록(C7 결정 (b))이 실제 상수(스타일 URL·DEM 타일)와 맞는지, GeoJSON·아이콘은
 * 제외되는지, 개발용 오리진 교체가 openfreemap URL 만 바꾸는지 고정한다.
 */

import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { isBaseMapUrl } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import {
  BASE_MAP_HOSTS,
  hostOfOrigin,
  normalizeOrigin,
  overrideBaseMapOrigin,
  overrideOpenFreeMapUrl,
} from '../src/baseMapHosts';
import { MAP_STYLE_URLS } from '../src/baseStyle';
import { composeMapStyle } from '../src/composeMapStyle';
import { facilityIconId } from '../src/facilityIcons';
import { TERRAIN_DEM_SOURCE, TERRAIN_DEM_SOURCE_ID } from '../src/terrainLayers';
import positronFixture from './fixtures/positron.layers.json';

const positron = positronFixture as unknown as StyleSpecification;

describe('BASE_MAP_HOSTS', () => {
  it('스타일 URL 두 모드와 DEM 타일 템플릿이 모두 베이스맵이다', () => {
    expect(isBaseMapUrl(MAP_STYLE_URLS.light, BASE_MAP_HOSTS)).toBe(true);
    expect(isBaseMapUrl(MAP_STYLE_URLS.dark, BASE_MAP_HOSTS)).toBe(true);
    const dem = TERRAIN_DEM_SOURCE.tiles?.[0];
    if (dem === undefined) throw new Error('DEM 소스에 tiles 가 없다');
    expect(isBaseMapUrl(dem, BASE_MAP_HOSTS)).toBe(true);
    expect(isBaseMapUrl(dem.replace('{z}/{x}/{y}', '12/3486/1594'), BASE_MAP_HOSTS)).toBe(true);
  });

  it('구성된 계곡 스타일의 소스 중 베이스맵은 openmaptiles·DEM 둘뿐이다', () => {
    const composed = composeMapStyle(positron, 'light', { terrain: true }).style;
    const baseMap = Object.entries(composed.sources)
      .filter(([, source]) => {
        const url = (source as { url?: string }).url ?? (source as { tiles?: string[] }).tiles?.[0];
        return url !== undefined && isBaseMapUrl(url, BASE_MAP_HOSTS);
      })
      .map(([id]) => id)
      .sort();
    expect(baseMap).toEqual(['openmaptiles', TERRAIN_DEM_SOURCE_ID].sort());
  });

  it('GeoJSON 데이터·아이콘 ID·다른 S3 버킷은 베이스맵이 아니다', () => {
    expect(isBaseMapUrl('/data/valley/segments.geojson', BASE_MAP_HOSTS)).toBe(false);
    expect(isBaseMapUrl(facilityIconId('parking'), BASE_MAP_HOSTS)).toBe(false);
    expect(isBaseMapUrl('https://s3.amazonaws.com/some-other/x.png', BASE_MAP_HOSTS)).toBe(false);
  });
});

describe('개발용 오리진 교체', () => {
  it('normalizeOrigin — 로컬은 http, 원격은 https, 스킴이 있으면 그대로, 빈 값은 null', () => {
    expect(normalizeOrigin('localhost:8099')).toBe('http://localhost:8099');
    expect(normalizeOrigin('127.0.0.1:8099/')).toBe('http://127.0.0.1:8099');
    expect(normalizeOrigin('tiles.invalid.example')).toBe('https://tiles.invalid.example');
    expect(normalizeOrigin('http://10.0.0.5:8099')).toBe('http://10.0.0.5:8099');
    expect(normalizeOrigin('')).toBeNull();
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(hostOfOrigin('http://localhost:8099')).toBe('localhost:8099');
  });

  it('openfreemap URL 만 바꾸고 나머지는 그대로', () => {
    const origin = 'http://localhost:8099';
    expect(overrideOpenFreeMapUrl(MAP_STYLE_URLS.light, origin)).toBe(
      'http://localhost:8099/styles/positron',
    );
    expect(overrideOpenFreeMapUrl('https://s3.amazonaws.com/elevation-tiles-prod/x', origin)).toBe(
      'https://s3.amazonaws.com/elevation-tiles-prod/x',
    );
    expect(overrideOpenFreeMapUrl('/data/x.geojson', origin)).toBe('/data/x.geojson');
  });

  it('스타일 소스·sprite·glyphs 의 openfreemap 오리진을 바꾼 새 스타일 — DEM 은 그대로', () => {
    const composed = composeMapStyle(positron, 'light', { terrain: true }).style;
    const withSprite: StyleSpecification = {
      ...composed,
      sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    };
    const overridden = overrideBaseMapOrigin(withSprite, 'http://localhost:8099');
    expect((overridden.sources.openmaptiles as { url?: string }).url).toBe(
      'http://localhost:8099/planet',
    );
    expect(overridden.sources[TERRAIN_DEM_SOURCE_ID]).toEqual(TERRAIN_DEM_SOURCE);
    expect(overridden.sprite).toBe('http://localhost:8099/sprites/ofm_f384/ofm');
    expect(overridden.glyphs).toBe('http://localhost:8099/fonts/{fontstack}/{range}.pbf');
    // 원본 불변
    expect((withSprite.sources.openmaptiles as { url?: string }).url).toBe(
      'https://tiles.openfreemap.org/planet',
    );
    expect(overridden.layers).toBe(withSprite.layers);
  });
});
