/**
 * 카메라 상태와 이동 명령.
 *
 * 데모는 `flyTo`/`easeTo` 에 옵션 객체를 그때그때 손으로 적는다. 같은 값이
 * 여러 군데 흩어져 있어(`pitch:62` 는 네 곳, `zoom:13.6` 은 두 곳) 한 곳만
 * 고치면 화면이 어긋난다. 목표(무엇을 볼지)와 전환(어떻게 갈지)을 나누고
 * 프리셋으로 모았다.
 */
import type { LngLat } from '../geo/LngLat';

/** 지도 엔진이 보고하는 현재 카메라. 모든 값이 채워져 있다. */
export type CameraPose = {
  readonly center: LngLat;
  readonly zoom: number;
  /** 도(degree). 0 = 수직 내려보기, 클수록 저각. */
  readonly pitch: number;
  /** 도(degree). 0 = 북쪽이 위. */
  readonly bearing: number;
};

/**
 * 이동 목표. 생략한 축은 현재 값을 유지한다 — 데모의 `openSpot` 이
 * bearing 을 넘기지 않아 사용자가 돌려 둔 방향을 지키는 동작과 같다.
 */
export type CameraTarget = {
  readonly center?: LngLat;
  readonly zoom?: number;
  readonly pitch?: number;
  readonly bearing?: number;
  /** 화면 픽셀 단위 밀어내기. 하단 시트에 가리지 않게 중심을 위로 올릴 때 쓴다. */
  readonly offset?: readonly [x: number, y: number];
};

export const CAMERA_MOTIONS = ['fly', 'ease'] as const;
/** `fly` = 줌아웃을 끼운 포물선 비행, `ease` = 직선 보간. MapLibre 의 두 동작. */
export type CameraMotion = (typeof CAMERA_MOTIONS)[number];

export type CameraTransition = {
  readonly motion: CameraMotion;
  readonly durationMs: number;
  /** `fly` 의 비행 곡률. MapLibre 기본값 1.42. */
  readonly curve?: number;
  /** 접근성 설정(모션 축소)을 무시하고 반드시 애니메이션할지. */
  readonly essential?: boolean;
};

export type CameraCommand = {
  readonly target: CameraTarget;
  readonly transition: CameraTransition;
};

export function cameraCommand(target: CameraTarget, transition: CameraTransition): CameraCommand {
  return { target, transition };
}
