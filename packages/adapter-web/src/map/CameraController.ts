/**
 * 취소 가능한 카메라 이동.
 *
 * MapLibre 의 `flyTo`/`easeTo` 는 즉시 반환하고 애니메이션은 뒤에서 돈다.
 * 데모는 그 사실을 무시하고 다음 조작에서 `map.stop()` 을 부른다. 언제
 * 끝났는지 알 수 없어 "비행이 끝나면 X" 같은 연출을 쓸 수 없고, 겹침 방지도
 * 이벤트가 아니라 플래그에 의존하게 된다.
 *
 * 여기서는 `moveend` 를 기다려 Promise 로 바꾼다. 취소되면 `map.stop()` 을
 * 부르고 즉시 돌아온다. 안전망으로 예상 시간 + 여유를 두고 타임아웃을 걸어
 * 이벤트가 오지 않는 경우에도 큐가 잠기지 않게 한다.
 */
import {
  type CameraCommand,
  type CameraPose,
  type CancellationToken,
  type Disposable,
  DisposableStore,
  err,
  LngLat,
  type Logger,
  MapEngineError,
  ok,
  type Result,
  toDisposable,
  type VoidResult,
} from '@modu-valley/core';
import type { EaseToOptions, FlyToOptions, Map as MapLibreMap } from 'maplibre-gl';
import { toLngLatLike } from './mapStyle';

/** `moveend` 가 오지 않을 때를 대비한 여유 시간. */
const MOVE_END_GRACE_MS = 600;

export class CameraController implements Disposable {
  readonly #map: MapLibreMap;
  readonly #logger: Logger;

  #disposed = false;

  constructor(map: MapLibreMap, logger: Logger) {
    this.#map = map;
    this.#logger = logger.child('camera');
  }

  getPose(): Result<CameraPose> {
    const center = this.#map.getCenter();
    const position = LngLat.create(center.lng, center.lat);
    if (!position.ok) return position;
    return ok({
      center: position.value,
      zoom: this.#map.getZoom(),
      pitch: this.#map.getPitch(),
      bearing: this.#map.getBearing(),
    });
  }

  stop(): void {
    if (this.#disposed) return;
    this.#map.stop();
  }

  async move(command: CameraCommand, token: CancellationToken): Promise<VoidResult> {
    if (this.#disposed) {
      return err(
        new MapEngineError('map/camera-failed', '지도가 이미 정리되어 카메라를 옮길 수 없습니다.'),
      );
    }

    const guard = token.checkpoint('camera-move');
    if (!guard.ok) return guard;

    const options = toMapLibreOptions(command);
    const settled = this.#waitForSettle(command.transition.durationMs, token);

    try {
      if (command.transition.motion === 'fly') {
        this.#map.flyTo(options as FlyToOptions);
      } else {
        this.#map.easeTo(options as EaseToOptions);
      }
    } catch (thrown) {
      settled.abandon();
      return err(
        new MapEngineError('map/camera-failed', '카메라 이동 호출이 실패했습니다.', {
          cause: thrown,
          context: { motion: command.transition.motion },
        }),
      );
    }

    return settled.promise;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
  }

  /**
   * `moveend` · 취소 · 타임아웃 중 먼저 오는 것으로 정착한다.
   * 세 경로 모두 같은 store 를 비우므로 리스너가 남지 않는다.
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

    const onMoveEnd = (): void => settle(ok());
    this.#map.once('moveend', onMoveEnd);
    store.add(toDisposable(() => this.#map.off('moveend', onMoveEnd)));

    store.add(
      token.onCancel((reason) => {
        // 진행 중인 애니메이션을 즉시 끊는다. 데모의 `map.stop()` 과 같은 일을,
        // 다음 명령이 아니라 취소 신호가 부른다.
        this.#map.stop();
        settle(err(reason));
      }),
    );

    const timer = setTimeout(() => {
      this.#logger.debug('moveend 가 오지 않아 타임아웃으로 정착시킨다', { durationMs });
      settle(ok());
    }, durationMs + MOVE_END_GRACE_MS);
    store.add(toDisposable(() => clearTimeout(timer)));

    return { promise, abandon: () => settle(ok()) };
  }
}

/**
 * 도메인 카메라 명령 → MapLibre 옵션.
 * 생략된 축은 넘기지 않아 현재 값이 유지된다(`exactOptionalPropertyTypes` 규약).
 */
function toMapLibreOptions(command: CameraCommand): FlyToOptions & EaseToOptions {
  const { target, transition } = command;
  const options: FlyToOptions & EaseToOptions = {
    duration: transition.durationMs,
  };
  if (target.center !== undefined) options.center = toLngLatLike(target.center);
  if (target.zoom !== undefined) options.zoom = target.zoom;
  if (target.pitch !== undefined) options.pitch = target.pitch;
  if (target.bearing !== undefined) options.bearing = target.bearing;
  if (target.offset !== undefined) options.offset = [target.offset[0], target.offset[1]];
  if (transition.curve !== undefined) options.curve = transition.curve;
  if (transition.essential !== undefined) options.essential = transition.essential;
  return options;
}
