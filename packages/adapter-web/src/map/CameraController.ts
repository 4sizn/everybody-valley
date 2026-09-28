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
 *
 * 그리고 **명령을 이 화면에 맞춰 다듬는 자리**이기도 하다. 프리셋은 "무엇을 볼지"만
 * 정하고 지금 카메라가 어디 있는지는 모른다. 여기서만 알 수 있는 두 가지를 본다.
 *   · 이미 같은 구도면 움직이지 않는다(`#alreadyFramed`).
 *   · 목표가 이미 화면 안이면 포물선 비행을 직선으로 낮춘다(`#plan`).
 * 둘 다 사용자가 "카메라가 튄다"고 부르던 것 — 같은 목표로 가는 명령이 연달아 오거나,
 * 코앞의 목표로 `flyTo` 가 줌아웃했다 다시 들어오는 동작 — 을 없앤다.
 */
import {
  type CameraCommand,
  type CameraMotion,
  type CameraPose,
  type CameraTarget,
  type CameraViewportInsets,
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

/**
 * "이미 그 구도"의 허용 오차.
 *
 * 이보다 작은 차이는 눈에 띄지 않는다. 그런데 명령으로 보내면 짧은 보정 애니메이션이
 * 한 번 더 보인다 — 선택 비행이 끝난 직후의 `recenterSelection`, 시트 높이 재측정,
 * 진입 직후의 `focusValley` 가 전부 같은 구도를 다시 요구한다. 그 연쇄가 "튐"이었다.
 */
const FRAMED_CENTER_PX = 10;
const FRAMED_ZOOM = 0.02;
const FRAMED_DEGREES = 0.5;

/**
 * 짧은 이동에서 `flyTo` 의 포물선은 줌아웃했다 다시 들어온다 — 코앞의 구간을 고른
 * 사용자에게는 그게 가장 크게 "튀는" 동작이다. 목표가 이미 화면 안이고 줌 변화가
 * 작으면 직선 보간(`easeTo`)으로 낮춘다.
 */
const SHORT_HOP_ZOOM = 1;
/**
 * 각도가 크게 바뀌는 이동은 짧은 이동이 아니다. 중심이 제자리라도 pitch 58° 를 세우고
 * bearing 을 87° 돌리는 것은 화면 전체가 뒤집히는 일이라, 거리로 잰 300ms 짜리로 줄이면
 * 그게 곧 "카메라가 한 틱 튄다"가 된다(실측 2026-09-26). 프리셋의 시간을 그대로 쓴다.
 */
const SHORT_HOP_PITCH_DEG = 8;
const SHORT_HOP_BEARING_DEG = 12;
/** 목표 중심이 화면 반폭·반높이의 이 배수 안이면 "화면 안"으로 본다. */
const SHORT_HOP_VIEWPORT = 0.75;
/** 짧은 이동의 길이 — 거리에 비례하되 프리셋(먼 거리 기준) 값을 넘지 않는다. */
const SHORT_HOP_BASE_MS = 320;
const SHORT_HOP_MS_PER_PX = 0.9;

/**
 * `keepVisible` 의 "편하게 보인다"는 폭 — 가려지지 않은 영역을 이만큼 안쪽으로 줄인 자리까지만
 * 인정한다. 경계에 딱 붙은 핀은 보이긴 해도 시트 손잡이에 닿아 불안해 보인다.
 */
const KEEP_VISIBLE_MARGIN_RATIO = 0.18;
const KEEP_VISIBLE_MARGIN_MAX_PX = 72;
/** 좌우는 시트가 가리지 않는다(시트는 화면 폭 전체 또는 가운데 컬럼). 가장자리만 피한다. */
const KEEP_VISIBLE_SIDE_PX = 48;

/** UI 의 `--mv-motion-easing` 과 같은 결 — 빠르게 출발해 부드럽게 선다. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** `keepVisible` 을 뗀 사본 — 어댑터가 푼 뒤에는 옵션 변환에 넘기지 않는다. */
function withoutKeepVisible(target: CameraTarget): CameraTarget {
  const { keepVisible: _ignored, ...rest } = target;
  return rest;
}

/**
 * 가려지지 않은 영역을 화면 **중심 기준** 사각형으로. 여백을 안쪽으로 물려 경계에 딱 붙는
 * 자리를 "보인다"로 치지 않는다. 시트가 화면을 다 덮으면(남는 높이 0 이하) `null`.
 */
function comfortableArea(
  insets: CameraViewportInsets,
  width: number,
  height: number,
): { left: number; right: number; top: number; bottom: number } | null {
  const visible = height - insets.top - insets.bottom;
  if (visible <= 0) return null;
  const margin = Math.min(KEEP_VISIBLE_MARGIN_MAX_PX, visible * KEEP_VISIBLE_MARGIN_RATIO);
  const top = insets.top + margin - height / 2;
  const bottom = height - insets.bottom - margin - height / 2;
  if (top > bottom) return null;
  const side = Math.max(0, width / 2 - KEEP_VISIBLE_SIDE_PX);
  return { left: -side, right: side, top, bottom };
}

/** 두 방위각의 최단 차이(도). 359° 와 1° 는 2° 차이다. */
function bearingDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export type CameraControllerOptions = {
  /**
   * 가까운 목표로 가는 `fly` 를 직선으로 낮출지. 계곡 화면만 `true` —
   * `/firework` 데모는 원본의 포물선 비행을 그대로 둔다(보존 규칙).
   */
  readonly shortHopEase: boolean;
};

export class CameraController implements Disposable {
  readonly #map: MapLibreMap;
  readonly #logger: Logger;
  readonly #shortHopEase: boolean;

  #disposed = false;

  constructor(map: MapLibreMap, logger: Logger, options: CameraControllerOptions) {
    this.#map = map;
    this.#logger = logger.child('camera');
    this.#shortHopEase = options.shortHopEase;
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

    /* "가려졌을 때만" 명령은 여기서 지금 화면을 보고 판정한다 — 이미 보이면 아무 일도
       하지 않고, 가려졌으면 목표 자리를 "들어올 만큼만"으로 낮춘다. */
    const target = this.#resolveKeepVisible(command.target);
    if (target === null) {
      this.#logger.debug('선택 지점이 이미 보이고 있어 카메라를 움직이지 않는다');
      return ok();
    }

    // 같은 구도를 다시 요구하는 명령 — 움직이지 않는 것이 가장 부드럽다.
    if (this.#alreadyFramed(target)) {
      this.#logger.debug('이미 같은 구도라 카메라를 움직이지 않는다');
      return ok();
    }

    const resolved: CameraCommand = { target, transition: command.transition };
    const plan = this.#plan(resolved);
    const options = toMapLibreOptions(resolved, plan);
    /* 실제로 실행되는 이동만 남긴다 — 한 조작에 카메라 명령이 몇 개나 겹치는지는 이 줄
       없이는 볼 방법이 없다(버림·낮춤은 위에서 각자 남긴다). */
    this.#logger.debug('카메라 이동', {
      motion: plan.motion,
      durationMs: plan.durationMs,
      zoom: target.zoom,
      pitch: target.pitch,
      bearing: target.bearing,
    });
    const settled = this.#waitForSettle(plan.durationMs, token);

    try {
      if (plan.motion === 'fly') {
        this.#map.flyTo(options as FlyToOptions);
      } else {
        this.#map.easeTo(options as EaseToOptions);
      }
    } catch (thrown) {
      settled.abandon();
      return err(
        new MapEngineError('map/camera-failed', '카메라 이동 호출이 실패했습니다.', {
          cause: thrown,
          context: { motion: plan.motion },
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
   * 목표 중심이 **지금** 화면에서 놓이는 자리와, 놓여야 할 자리(화면 중심 + offset)의
   * 차이(px). 목표에 중심이 없으면 비교할 것이 없으므로 `null`.
   */
  #centerDeltaPx(target: CameraTarget): { readonly x: number; readonly y: number } | null {
    const center = target.center;
    if (center === undefined) return null;
    const point = this.#map.project(toLngLatLike(center));
    const container = this.#map.getContainer();
    const [offsetX, offsetY] = target.offset ?? [0, 0];
    return {
      x: point.x - (container.clientWidth / 2 + offsetX),
      y: point.y - (container.clientHeight / 2 + offsetY),
    };
  }

  /**
   * `keepVisible` 을 지금 화면에 대고 푼다.
   *
   *   · 필드가 없으면 그대로 — "가운데로" 명령이다.
   *   · 지점이 이미 편한 영역 안이면 `null` — 움직이지 않는다.
   *   · 가려졌으면 `offset` 을 **가장 가까운 편한 자리**로 바꾼다. 화면 한가운데로
   *     데려오는 대신 최소한만 밀어, 사용자가 보고 있던 곳이 그대로 남는다.
   */
  #resolveKeepVisible(target: CameraTarget): CameraTarget | null {
    const insets = target.keepVisible;
    if (insets === undefined) return target;

    const point = this.#centerDeltaPx({ ...target, offset: [0, 0] });
    const container = this.#map.getContainer();
    // 중심 기준 좌표계로 옮긴 편한 영역. `#centerDeltaPx` 가 같은 기준을 쓴다.
    const area = comfortableArea(insets, container.clientWidth, container.clientHeight);
    if (area === null || point === null) return withoutKeepVisible(target);

    const x = clamp(point.x, area.left, area.right);
    const y = clamp(point.y, area.top, area.bottom);
    if (x === point.x && y === point.y) return null;
    return { ...withoutKeepVisible(target), offset: [x, y] };
  }

  /** 지금 카메라가 이미 그 목표 구도인가. 생략된 축은 유지되므로 비교하지 않는다. */
  #alreadyFramed(target: CameraTarget): boolean {
    const map = this.#map;
    /* 움직이는 중에는 지금 값이 지나가는 값이라 비교 대상이 못 된다 — 애니메이션이든
       사용자 제스처든. 이 경로는 보수적이어야 한다: 잘못 건너뛰면 명령이 사라진다. */
    if (map.isMoving()) return false;
    if (target.zoom !== undefined && Math.abs(map.getZoom() - target.zoom) > FRAMED_ZOOM) {
      return false;
    }
    if (target.pitch !== undefined && Math.abs(map.getPitch() - target.pitch) > FRAMED_DEGREES) {
      return false;
    }
    if (
      target.bearing !== undefined &&
      Math.abs(bearingDelta(map.getBearing(), target.bearing)) > FRAMED_DEGREES
    ) {
      return false;
    }
    const delta = this.#centerDeltaPx(target);
    return delta === null || Math.hypot(delta.x, delta.y) <= FRAMED_CENTER_PX;
  }

  /** 프리셋의 전환을 이 화면에서 실제로 어떻게 움직일지로 옮긴다. */
  #plan(command: CameraCommand): CameraPlan {
    const { transition, target } = command;
    const asIs: CameraPlan = { motion: transition.motion, durationMs: transition.durationMs };
    if (!this.#shortHopEase || transition.motion !== 'fly') return asIs;

    const zoomJump =
      target.zoom !== undefined && Math.abs(this.#map.getZoom() - target.zoom) > SHORT_HOP_ZOOM;
    const pitchSwing =
      target.pitch !== undefined &&
      Math.abs(this.#map.getPitch() - target.pitch) > SHORT_HOP_PITCH_DEG;
    const bearingSwing =
      target.bearing !== undefined &&
      Math.abs(bearingDelta(this.#map.getBearing(), target.bearing)) > SHORT_HOP_BEARING_DEG;
    if (zoomJump || pitchSwing || bearingSwing) return asIs;

    const delta = this.#centerDeltaPx(target);
    const distance = delta === null ? 0 : Math.hypot(delta.x, delta.y);
    if (delta !== null) {
      const container = this.#map.getContainer();
      const inside =
        Math.abs(delta.x) <= (container.clientWidth / 2) * SHORT_HOP_VIEWPORT &&
        Math.abs(delta.y) <= (container.clientHeight / 2) * SHORT_HOP_VIEWPORT;
      if (!inside) return asIs;
    }

    return {
      motion: 'ease',
      durationMs: Math.min(
        transition.durationMs,
        Math.round(SHORT_HOP_BASE_MS + distance * SHORT_HOP_MS_PER_PX),
      ),
      easing: easeOutCubic,
    };
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

/** 이 화면에서 실제로 실행할 동작 — `#plan` 이 프리셋에서 옮긴 값. */
type CameraPlan = {
  readonly motion: CameraMotion;
  readonly durationMs: number;
  readonly easing?: (t: number) => number;
};

/**
 * 도메인 카메라 명령 + 실행 계획 → MapLibre 옵션.
 * 생략된 축은 넘기지 않아 현재 값이 유지된다(`exactOptionalPropertyTypes` 규약).
 */
function toMapLibreOptions(command: CameraCommand, plan: CameraPlan): FlyToOptions & EaseToOptions {
  const { target, transition } = command;
  const options: FlyToOptions & EaseToOptions = {
    duration: plan.durationMs,
  };
  if (plan.easing !== undefined) options.easing = plan.easing;
  if (target.center !== undefined) options.center = toLngLatLike(target.center);
  if (target.zoom !== undefined) options.zoom = target.zoom;
  if (target.pitch !== undefined) options.pitch = target.pitch;
  if (target.bearing !== undefined) options.bearing = target.bearing;
  if (target.offset !== undefined) options.offset = [target.offset[0], target.offset[1]];
  // `curve` 는 포물선 비행에만 있는 개념 — 직선으로 낮춘 명령에는 넘기지 않는다.
  if (transition.curve !== undefined && plan.motion === 'fly') options.curve = transition.curve;
  if (transition.essential !== undefined) options.essential = transition.essential;
  return options;
}
