/**
 * 계곡 카메라 프리셋 (C10b) — 축 방위각과 지형 유무별 상세 시점을 고정한다.
 *
 * 결정 (e) E4 "계곡 축을 가로질러, 상류 왼쪽·하류 오른쪽, pitch 58" 의 **결과**를 검사한다.
 * 동쪽으로 흐르는 구간은 북쪽이 위(bearing 0)여야 상류(서)가 왼쪽에 온다 — 결정 기록의
 * "+90" 표기와 다르다는 점은 `valleyAxisBearing` 주석과 PR 에 적었다.
 */
import { describe, expect, it } from 'vitest';
import {
  focusSegment,
  MAX_PITCH,
  releaseSegment,
  VALLEY_DETAIL_FLAT_PITCH,
  VALLEY_DETAIL_TERRAIN_PITCH,
  VALLEY_DETAIL_ZOOM,
  VALLEY_FLAT_PITCH,
  VALLEY_OVERVIEW_OFFSET,
  VALLEY_OVERVIEW_ZOOM,
  valleyAxisBearing,
} from '../src/domain/camera/CameraPresets';
import { viewportCenterOffset } from '../src/domain/camera/ViewportCameraOffset';
import { bearingBetween, normalizeBearing } from '../src/domain/geo/Bearing';
import { LngLat } from '../src/domain/geo/LngLat';
import { toSegmentId, toValleyId } from '../src/domain/valley/ids';
import { Segment } from '../src/domain/valley/Segment';

function segment(path: readonly (readonly [number, number])[]): Segment {
  return new Segment({
    id: toSegmentId('s'),
    valleyId: toValleyId('v'),
    valleyName: 'v',
    position: 'mid',
    order: 0,
    path: path.map(([lng, lat]) => LngLat.of(lng, lat)),
  });
}

const ORIGIN = LngLat.of(127.27, 37.83);

describe('bearingBetween — 초기 방위각', () => {
  it('북·동·남·서는 0·90·180·270', () => {
    expect(bearingBetween(ORIGIN, LngLat.of(127.27, 37.84))).toBeCloseTo(0, 5);
    expect(bearingBetween(ORIGIN, LngLat.of(127.28, 37.83))).toBeCloseTo(90, 1);
    expect(bearingBetween(ORIGIN, LngLat.of(127.27, 37.82))).toBeCloseTo(180, 5);
    expect(bearingBetween(ORIGIN, LngLat.of(127.26, 37.83))).toBeCloseTo(270, 1);
  });

  it('같은 점은 0, 결과는 항상 [0, 360)', () => {
    expect(bearingBetween(ORIGIN, ORIGIN)).toBe(0);
    expect(bearingBetween(ORIGIN, LngLat.of(127.26, 37.84))).toBeGreaterThanOrEqual(0);
    expect(bearingBetween(ORIGIN, LngLat.of(127.26, 37.84))).toBeLessThan(360);
    expect(normalizeBearing(-90)).toBe(270);
    expect(normalizeBearing(450)).toBe(90);
    expect(normalizeBearing(360)).toBe(0);
  });
});

describe('valleyAxisBearing — 축을 가로질러, 상류 왼쪽·하류 오른쪽', () => {
  it('동쪽으로 흐르는 구간은 북쪽이 위(0) — 서쪽 상류가 왼쪽에 온다', () => {
    const bearing = valleyAxisBearing(
      segment([
        [127.26, 37.83],
        [127.28, 37.83],
      ]),
    );
    // 대권 방위각은 정동에서 살짝 벗어나 0 또는 359.99… 로 나온다 — 0 과의 각거리로 본다.
    expect(Math.min(bearing, 360 - bearing)).toBeLessThan(0.05);
  });

  it('남쪽으로 흐르는 구간은 동쪽이 위(90) — 북쪽 상류가 왼쪽에 온다', () => {
    expect(
      valleyAxisBearing(
        segment([
          [127.27, 37.84],
          [127.27, 37.82],
        ]),
      ),
    ).toBeCloseTo(90, 5);
  });

  it('축은 첫 점→끝 점으로 잰다 — 중간 굽이는 무시', () => {
    const straight = segment([
      [127.26, 37.83],
      [127.28, 37.83],
    ]);
    const bent = segment([
      [127.26, 37.83],
      [127.27, 37.835],
      [127.28, 37.83],
    ]);
    expect(valleyAxisBearing(bent)).toBeCloseTo(valleyAxisBearing(straight), 5);
  });

  it('샘플 계곡(북서→남동)은 남서쪽이 위 — 결과가 [0, 360) 안', () => {
    // data/example-valley.geojson 중류 구간과 같은 좌표.
    const mid = segment([
      [127.2641, 37.8318],
      [127.2674, 37.8291],
    ]);
    const axis = bearingBetween(mid.start, mid.end);
    expect(axis).toBeGreaterThan(90);
    expect(axis).toBeLessThan(180);
    const bearing = valleyAxisBearing(mid);
    expect(bearing).toBeCloseTo(axis - 90, 5);
    expect(bearing).toBeGreaterThanOrEqual(0);
  });
});

describe('focusSegment — 지형 유무별 상세 시점', () => {
  const mid = segment([
    [127.2641, 37.8318],
    [127.2674, 37.8291],
  ]);
  // C6 — offset 은 이제 인셋에서 계산된다(`viewportCenterOffset`). 여기서는 임의의
  // 인셋 하나로 고정해 다른 수치(pitch·bearing·zoom)만 검사한다 — offset 자체의
  // 계산 규칙은 `ViewportCameraOffset.test.ts` 몫이다.
  const insets = { top: 48, bottom: 340.65 };

  it('지형이 있으면 pitch 58 · 축 가로지르기 bearing · 중간점 · 15.5 · 인셋 기반 offset', () => {
    const command = focusSegment(mid, { terrain: true, insets });
    expect(command.target.pitch).toBe(VALLEY_DETAIL_TERRAIN_PITCH);
    expect(VALLEY_DETAIL_TERRAIN_PITCH).toBe(58);
    expect(VALLEY_DETAIL_TERRAIN_PITCH).toBeLessThan(MAX_PITCH);
    expect(command.target.bearing).toBeCloseTo(valleyAxisBearing(mid), 10);
    expect(command.target.center?.equals(mid.midpoint())).toBe(true);
    expect(command.target.zoom).toBe(VALLEY_DETAIL_ZOOM);
    expect(command.target.offset).toEqual(viewportCenterOffset(insets));
    expect(command.transition).toEqual({ motion: 'fly', durationMs: 1400, essential: true });
  });

  it('지형이 없으면(네이티브) pitch 30 · bearing 은 건드리지 않는다 — F1b 시점 그대로', () => {
    const command = focusSegment(mid, { terrain: false, insets });
    expect(command.target.pitch).toBe(VALLEY_DETAIL_FLAT_PITCH);
    expect(VALLEY_DETAIL_FLAT_PITCH).toBe(30);
    expect(command.target.bearing).toBeUndefined();
    expect(command.target.zoom).toBe(VALLEY_DETAIL_ZOOM);
    expect(command.target.offset).toEqual(viewportCenterOffset(insets));
  });
});

describe('releaseSegment — 전체 보기로 복귀', () => {
  it('전체 보기 줌·평면·북쪽·전체 보기 offset, 중심은 유지', () => {
    const command = releaseSegment();
    expect(command.target).toEqual({
      zoom: VALLEY_OVERVIEW_ZOOM,
      pitch: VALLEY_FLAT_PITCH,
      bearing: 0,
      offset: VALLEY_OVERVIEW_OFFSET,
    });
    expect(command.transition).toEqual({ motion: 'ease', durationMs: 1100 });
  });
});
