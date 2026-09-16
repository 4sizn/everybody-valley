/**
 * 취소 가능한 카메라 이동 (네이티브).
 *
 * web 의 `CameraController` 와 같은 계약을 지킨다 — 이동을 Promise 로 만들고,
 * 취소되면 즉시 멈추고 돌아온다. 네이티브에서 달라지는 세 가지만 적어 둔다.
 *
 * 1. **완료 신호**: `CameraRef.setStop` 이 돌려주는 Promise 는 애니메이션이
 *    끝날 때가 아니라 **명령이 네이티브로 넘어갔을 때** resolve 된다(래퍼의
 *    `MLRNCameraModule` 이 `handleImperativeStop` 직후 `promise.resolve`).
 *    그래서 web 의 `moveend` 자리에 `onRegionDidChange` 를 쓴다.
 *
 * 2. **정지**: 네이티브에는 `map.stop()` 이 없다. 현재 시점으로 duration 0
 *    이동을 밀어넣으면 진행 중인 애니메이션이 그 자리에서 끊긴다.
 *
 * 3. **offset → padding**: maplibre-gl 의 화면 픽셀 offset 이 래퍼에는 없다.
 *    padding 으로 옮긴다(아래 `toNativeStop` 주석 참고).
 */
import {
  type CameraCommand,
  type CameraPose,
  type CancellationToken,
  type Disposable,
  DisposableStore,
  err,
  type Logger,
  MapEngineError,
  ok,
  type VoidResult,
} from '@modu-valley/core';
import type { NativeCameraStop, NativeViewPadding } from './MapScene';
import type { MapSurface } from './MapSurface';

/** `onRegionDidChange` 가 오지 않을 때를 대비한 여유 시간. web 과 같은 값. */
const REGION_SETTLE_GRACE_MS = 600;

export type NativeCameraControllerOptions = {
  readonly surface: MapSurface;
  readonly logger: Logger;
  /** 현재 시점을 읽는다. offset 보정과 정지에 필요하다. */
  readonly readPose: () => CameraPose;
};

export class NativeCameraController implements Disposable {
  readonly #surface: MapSurface;
  readonly #logger: Logger;
  readonly #readPose: () => CameraPose;

  #disposed = false;

  constructor(options: NativeCameraControllerOptions) {
    this.#surface = options.surface;
    this.#logger = options.logger.child('camera');
    this.#readPose = options.readPose;
  }

  async move(command: CameraCommand, token: CancellationToken): Promise<VoidResult> {
    if (this.#disposed) {
      return err(
        new MapEngineError('map/camera-failed', '지도가 이미 정리되어 카메라를 옮길 수 없습니다.'),
      );
    }

    const guard = token.checkpoint('camera-move');
    if (!guard.ok) return guard;

    const settled = this.#waitForSettle(command.transition.durationMs, token);
    const dispatched = this.#surface.moveCamera(toNativeStop(command, this.#readPose()));
    if (!dispatched) {
      settled.abandon();
      return err(
        new MapEngineError('map/not-initialized', '지도 카메라가 아직 준비되지 않았습니다.', {
          context: { motion: command.transition.motion },
        }),
      );
    }

    return settled.promise;
  }

  stop(): void {
    if (this.#disposed) return;
    const pose = this.#readPose();
    this.#surface.moveCamera({
      center: [pose.center.lng, pose.center.lat],
      zoom: pose.zoom,
      pitch: pose.pitch,
      bearing: pose.bearing,
      duration: 0,
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
  }

  /**
   * `settled` · 취소 · 타임아웃 중 먼저 오는 것으로 정착한다.
   * 세 경로 모두 같은 store 를 비우므로 구독이 남지 않는다.
   */
  #waitForSettle(
    durationMs: number,
    token: CancellationToken,
  ): { readonly promise: Promise<VoidResult>; abandon: () => void } {
    const store = new DisposableStore(this.#logger);
    let settle: (result: VoidResult) => void = () => {};

    const promise = new Promise<VoidResult>((resolve) => {
      settle = (result) => {
        store.dispose();
        resolve(result);
      };
    });

    store.add(this.#surface.events.once('settled', () => settle(ok())));

    store.add(
      token.onCancel((reason) => {
        // 진행 중인 애니메이션을 그 자리에서 끊는다. web 의 `map.stop()` 자리.
        this.stop();
        settle(err(reason));
      }),
    );

    const timer = setTimeout(() => {
      this.#logger.debug('onRegionDidChange 가 오지 않아 타임아웃으로 정착시킨다', { durationMs });
      settle(ok());
    }, durationMs + REGION_SETTLE_GRACE_MS);
    store.addFn(() => clearTimeout(timer));

    return { promise, abandon: () => settle(ok()) };
  }
}

/**
 * 도메인 카메라 명령 → 네이티브 카메라 stop.
 *
 * 생략된 축은 넘기지 않아 현재 값이 유지된다(`exactOptionalPropertyTypes`
 * 규약이기도 하고, 네이티브도 현재 `CameraPosition` 에서 시작한다).
 *
 * 데모와 달라지는 두 곳:
 *  · `curve`(비행 곡률)는 래퍼에 없다. `easing: 'fly'` 가 SDK 기본 곡선을
 *    쓰므로 순회 비행의 포물선이 데모보다 완만할 수 있다.
 *  · `essential`(모션 축소 무시)도 없다. 접근성 설정을 켠 기기에서는 OS 가
 *    애니메이션을 줄일 수 있다.
 */
export function toNativeStop(command: CameraCommand, currentPose: CameraPose): NativeCameraStop {
  const { target, transition } = command;
  const stop: {
    center?: readonly [number, number];
    zoom?: number;
    pitch?: number;
    bearing?: number;
    padding?: NativeViewPadding;
    duration: number;
    easing: 'ease' | 'fly';
  } = {
    duration: transition.durationMs,
    easing: transition.motion === 'fly' ? 'fly' : 'ease',
  };

  if (target.zoom !== undefined) stop.zoom = target.zoom;
  if (target.pitch !== undefined) stop.pitch = target.pitch;
  if (target.bearing !== undefined) stop.bearing = target.bearing;

  if (target.center !== undefined) {
    stop.center = [target.center.lng, target.center.lat];
  }

  if (target.offset !== undefined) {
    stop.padding = toPadding(target.offset);
    /* 네이티브는 **center 가 있을 때만** padding 을 카메라에 반영한다
       (`CameraStop.toCameraUpdate`: `if (center != null) builder.padding(...)`).
       데모의 '상세 닫기'(`releaseSpot`)는 offset 만 [0,0] 으로 되돌리고
       center 를 넘기지 않으므로, 그대로 두면 시트 회피 오프셋이 영구히
       남는다. 현재 중심을 채워 padding 이 반영되게 한다. */
    stop.center ??= [currentPose.center.lng, currentPose.center.lat];
  }

  return stop;
}

/**
 * 화면 픽셀 offset → 뷰 padding.
 *
 * maplibre-gl 의 `offset` 은 "이동이 끝난 뒤 목표점이 화면 중심에서 몇 px
 * 어긋나 있을지"다. 래퍼에는 offset 이 없고 padding 만 있는데, 한쪽에
 * padding `p` 를 주면 유효 중심이 반대쪽으로 `p / 2` 만큼 밀린다. 따라서
 * offset 의 두 배를 반대쪽 padding 으로 준다 — 데모의 `offset:[0,-90]`
 * (하단 시트 회피)은 `padding.bottom = 180` 이 된다.
 */
function toPadding(offset: readonly [x: number, y: number]): NativeViewPadding {
  const [x, y] = offset;
  return {
    top: y > 0 ? y * 2 : 0,
    bottom: y < 0 ? -y * 2 : 0,
    left: x > 0 ? x * 2 : 0,
    right: x < 0 ? -x * 2 : 0,
  };
}
