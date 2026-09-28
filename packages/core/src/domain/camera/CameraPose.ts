/**
 * 카메라 상태와 이동 명령.
 *
 * 데모는 `flyTo`/`easeTo` 에 옵션 객체를 그때그때 손으로 적는다. 같은 값이
 * 여러 군데 흩어져 있어(`pitch:62` 는 네 곳, `zoom:13.6` 은 두 곳) 한 곳만
 * 고치면 화면이 어긋난다. 목표(무엇을 볼지)와 전환(어떻게 갈지)을 나누고
 * 프리셋으로 모았다.
 */
import type { LngLat } from '../geo/LngLat';
import type { CameraViewportInsets } from './ViewportCameraOffset';

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
  /**
   * "가운데로 가져와라" 대신 **"가려지지 않게만 해라"**.
   *
   * 주면 `offset` 은 목표 자리가 아니라 상한이 된다. 지도는 먼저 지금 화면을 보고,
   * 목표 지점이 이 인셋이 남긴 영역 안에 이미 편하게 보이면 **움직이지 않는다**.
   * 가려졌을 때만, 그 영역 안으로 들어올 만큼만 민다.
   *
   * 시트가 커지면서 핀이 가려질 때 쓴다 — 예전에는 그때마다 핀을 화면 한가운데로
   * 데려와 지도가 통째로 뛰었다(사용자 보고 2026-09-26). 사용자가 직접 "위치 이동"을
   * 누른 경우에는 주지 않는다. 그건 가운데로 오라는 뜻이다.
   *
   * 화면 크기를 알아야 판정할 수 있어 **어댑터가 해석한다**. 화면 픽셀을 모르는
   * 엔진(네이티브 래퍼)은 이 필드를 무시하고 예전처럼 `offset` 자리로 옮긴다.
   */
  readonly keepVisible?: CameraViewportInsets;
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
