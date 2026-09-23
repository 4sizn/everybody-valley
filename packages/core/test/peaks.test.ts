import { describe, expect, it } from 'vitest';
import { loadPeaksBundle } from '../src/data/valley/loadPeaksBundle';
import { LngLat } from '../src/domain/geo/LngLat';
import { toSegmentId, toValleyId } from '../src/domain/valley/ids';
import { nearbyPeaks, type Peak, peakLabel } from '../src/domain/valley/Peak';
import { Segment } from '../src/domain/valley/Segment';
import { Valley } from '../src/domain/valley/Valley';

const SAMPLE = toValleyId('sample');

function valley(): Valley {
  return new Valley({
    id: SAMPLE,
    name: '샘플계곡',
    segments: [
      new Segment({
        id: toSegmentId('s'),
        valleyId: SAMPLE,
        valleyName: '샘플계곡',
        position: 'whole',
        order: 0,
        path: [LngLat.of(127.26, 37.834), LngLat.of(127.27, 37.83)],
      }),
    ],
    facilities: [],
  });
}

function peak(
  name: string,
  lng: number,
  lat: number,
  elevationM?: number,
  valleyId = SAMPLE,
): Peak {
  return { valleyId, name, elevationM, position: LngLat.of(lng, lat) };
}

describe('Peak — 주변 산', () => {
  it('라벨은 "이름 표고m", 표고 없으면 이름만', () => {
    expect(peakLabel(peak('언니통봉', 127.26, 37.84, 928))).toBe('언니통봉 928m');
    expect(peakLabel(peak('쉬밀고개', 127.26, 37.84))).toBe('쉬밀고개');
  });

  it('중심선에서 가까운 순, 같은 이름은 가까운 것만, 다른 계곡은 제외, limit', () => {
    const near = nearbyPeaks(
      valley(),
      [
        peak('먼봉', 127.3, 37.86, 1000),
        peak('가까운봉', 127.262, 37.836, 700),
        peak('가까운봉', 127.263, 37.837, 702), // OSM 중복 노드
        peak('중간봉', 127.268, 37.838, 800),
        peak('남의봉', 127.262, 37.836, 500, toValleyId('other')),
      ],
      2,
    );
    expect(near.map(({ peak }) => peakLabel(peak))).toEqual(['가까운봉 700m', '중간봉 800m']);
    expect(near[0]?.distance.meters).toBeLessThan(near[1]?.distance.meters ?? 0);
  });
});

describe('loadPeaksBundle — 관대한 합본 읽기', () => {
  it('깨진 피처만 버리고 나머지는 읽는다, 합본이 아니면 빈 배열', () => {
    const peaks = loadPeaksBundle({
      collections: [
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [127.4698, 37.9819] },
              properties: { valleyId: 'myeongji', name: '언니통봉', elevationM: 928 },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [127.47, 37.98] },
              properties: { valleyId: 'myeongji', name: '표고없음' },
            },
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: ['x', 1] },
              properties: { valleyId: 'a', name: 'b' },
            },
          ],
        },
        'not-a-collection',
      ],
    });
    expect(peaks.map((peak) => [peak.name, peak.elevationM])).toEqual([
      ['언니통봉', 928],
      ['표고없음', undefined],
    ]);
    expect(peaks[0]?.position.lat).toBe(37.9819);
    expect(loadPeaksBundle(null)).toEqual([]);
    expect(loadPeaksBundle({ collections: 'x' })).toEqual([]);
  });
});
