/**
 * 카메라 명령 → 네이티브 stop 변환.
 *
 * 이 변환이 네이티브 파리티에서 가장 조용히 깨지는 곳이다. 래퍼에 offset 이
 * 없어 padding 으로 옮기는데, 네이티브는 center 가 있을 때만 padding 을
 * 반영하기 때문이다. 기기 없이 검증할 수 있는 부분이므로 테스트로 못 박는다.
 */
import {
  alignNorth,
  type CameraPose,
  focusSpot,
  LngLat,
  recenterLaunch,
  releaseSpot,
  tourStep,
} from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { toNativeStop } from '../src/map/NativeCameraController';

const LAUNCH = LngLat.of(126.9427, 37.5219);
const CURRENT: CameraPose = {
  center: LngLat.of(127.0, 37.5),
  zoom: 13.6,
  pitch: 62,
  bearing: -22,
};

describe('toNativeStop', () => {
  it('fly 명령은 easing:fly, ease 명령은 easing:ease 로 간다', () => {
    expect(toNativeStop(recenterLaunch(LAUNCH), CURRENT)).toMatchObject({
      easing: 'fly',
      duration: 1400,
    });
    expect(toNativeStop(alignNorth(), CURRENT)).toMatchObject({
      easing: 'ease',
      duration: 800,
    });
  });

  it('생략된 축은 넘기지 않는다 — 네이티브가 현재 값을 유지한다', () => {
    // 나침반은 bearing·pitch 만 정한다. center·zoom 이 실리면 사용자가
    // 옮겨 둔 위치가 튄다.
    const stop = toNativeStop(alignNorth(), CURRENT);
    expect(stop.bearing).toBe(0);
    expect(stop.pitch).toBe(62);
    expect(stop).not.toHaveProperty('center');
    expect(stop).not.toHaveProperty('zoom');
  });

  it('offset [0,-90] 은 padding.bottom 180 이 된다', () => {
    // 데모의 상세 열기 — 하단 시트를 피해 목표점을 화면 중심 위로 올린다.
    const stop = toNativeStop(focusSpot(LAUNCH), CURRENT);
    expect(stop.padding).toEqual({ top: 0, right: 0, bottom: 180, left: 0 });
    expect(stop.center).toEqual([LAUNCH.lng, LAUNCH.lat]);
  });

  it('offset 만 있고 center 가 없으면 현재 중심을 채운다', () => {
    /* 상세 닫기는 offset 을 [0,0] 으로 되돌리지만 center 를 넘기지 않는다.
       네이티브는 center 가 없으면 padding 을 반영하지 않으므로, 그대로 두면
       열 때 걸어 둔 오프셋이 영구히 남는다. */
    const stop = toNativeStop(releaseSpot(), CURRENT);
    expect(stop.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(stop.center).toEqual([CURRENT.center.lng, CURRENT.center.lat]);
  });

  it('offset 이 없는 명령에는 padding 을 붙이지 않는다', () => {
    const stop = toNativeStop(tourStep(LAUNCH, 3), CURRENT);
    expect(stop).not.toHaveProperty('padding');
    expect(stop.bearing).toBe((3 * 47) % 360);
  });
});
