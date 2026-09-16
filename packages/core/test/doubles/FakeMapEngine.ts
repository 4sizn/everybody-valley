/**
 * 테스트용 지도 엔진.
 *
 * `MapEnginePort` 를 온전히 구현하므로, 이 파일이 컴파일된다는 것 자체가
 * "애플리케이션 계층이 maplibre 를 모른다"는 증거다. 카메라 이동은 즉시
 * 끝나고, 어떤 명령이 어떤 순서로 왔는지 기록한다.
 */

import type { MapCapabilities } from '../../src/application/ports/MapCapabilities';
import type { MapContent, MapSelection } from '../../src/application/ports/MapContent';
import { type MapEngineEvents, MapEnginePort } from '../../src/application/ports/MapEnginePort';
import { INITIAL_BASE_MAP_HEALTH } from '../../src/domain/basemap/BaseMapHealth';
import type { CameraCommand, CameraPose } from '../../src/domain/camera/CameraPose';
import type { MapGestures } from '../../src/domain/camera/MapGestures';
import type { ProjectionMode } from '../../src/domain/camera/ProjectionMode';
import type { CancellationToken } from '../../src/shared/async/cancellation';
import type { LifecycleState } from '../../src/shared/async/lifecycle';
import { Emitter, type EmitterView } from '../../src/shared/events/Emitter';
import type { Logger } from '../../src/shared/logger/Logger';
import { ok, type Result, type VoidResult } from '../../src/shared/result';

export const FAKE_CAPABILITIES: MapCapabilities = {
  engineName: 'fake',
  globeProjection: true,
  extrudedBuildings: true,
  particleLayer: true,
  localizedLabels: true,
  cameraOffset: true,
  sky: true,
  builtInZoomControls: false,
  terrain: true,
};

export class FakeMapEngine extends MapEnginePort {
  override readonly capabilities: MapCapabilities;

  readonly moves: { operation: string; command: CameraCommand }[] = [];
  readonly selections: (MapSelection | null)[] = [];
  readonly contents: MapContent[] = [];
  readonly projections: ProjectionMode[] = [];
  readonly gestureUpdates: MapGestures[] = [];
  readonly fireworks: boolean[] = [];
  readonly waterFlow: boolean[] = [];

  stops = 0;
  /** `retryBaseMap` 호출 수(C7). */
  baseMapRetries = 0;
  disposed = false;
  pose: CameraPose;

  readonly #emitter: Emitter<MapEngineEvents>;
  #state: LifecycleState = 'idle';

  /** 능력을 바꿔 끼울 수 있다 — 네이티브처럼 3D 지형이 없는 엔진의 카메라 프리셋을 검사할 때. */
  constructor(
    logger: Logger,
    initialPose: CameraPose,
    capabilities: MapCapabilities = FAKE_CAPABILITIES,
  ) {
    super();
    this.capabilities = capabilities;
    this.#emitter = new Emitter<MapEngineEvents>(logger);
    this.pose = initialPose;
  }

  override get state(): LifecycleState {
    return this.#state;
  }

  override get events(): EmitterView<MapEngineEvents> {
    return this.#emitter;
  }

  /** 테스트가 엔진 이벤트를 흉내 내는 통로. */
  emit<K extends keyof MapEngineEvents & string>(event: K, payload: MapEngineEvents[K]): void {
    this.#emitter.emit(event, payload);
  }

  override initialize(token: CancellationToken): Promise<VoidResult> {
    const guard = token.checkpoint('fake-initialize');
    if (!guard.ok) return Promise.resolve(guard);
    this.#state = 'ready';
    this.#emitter.emit('ready', undefined);
    return Promise.resolve(ok());
  }

  override moveCamera(command: CameraCommand, token: CancellationToken): Promise<VoidResult> {
    const guard = token.checkpoint('fake-move');
    if (!guard.ok) return Promise.resolve(guard);
    this.moves.push({ operation: describe(command), command });
    // 실제 엔진처럼 목표를 반영한다 — 후속 명령이 현재 값을 참조한다.
    this.pose = {
      center: command.target.center ?? this.pose.center,
      zoom: command.target.zoom ?? this.pose.zoom,
      pitch: command.target.pitch ?? this.pose.pitch,
      bearing: command.target.bearing ?? this.pose.bearing,
    };
    this.#emitter.emit('camera-change', this.pose);
    return Promise.resolve(ok());
  }

  override stopCamera(): void {
    this.stops += 1;
  }

  override getCamera(): Result<CameraPose> {
    return ok(this.pose);
  }

  override setProjection(mode: ProjectionMode): VoidResult {
    this.projections.push(mode);
    return ok();
  }

  override setGestures(gestures: MapGestures): VoidResult {
    this.gestureUpdates.push(gestures);
    return ok();
  }

  override renderContent(content: MapContent): VoidResult {
    this.contents.push(content);
    return ok();
  }

  override setSelection(selection: MapSelection | null): VoidResult {
    this.selections.push(selection);
    return ok();
  }

  /** 마지막 선택이 명당이면 그 id. 핀 검증을 짧게 쓰기 위한 도우미. */
  get lastSelectedSpotId(): string | null {
    const last = this.selections.at(-1);
    return last === undefined || last === null || last.kind !== 'spot' ? null : last.spot.id;
  }

  override setFireworksEnabled(enabled: boolean): VoidResult {
    this.fireworks.push(enabled);
    return ok();
  }

  override setWaterFlowEnabled(enabled: boolean): VoidResult {
    this.waterFlow.push(enabled);
    return ok();
  }

  /** 실제 어댑터처럼 소스 reload 뒤 헬스를 처음으로 돌려 알린다. */
  override retryBaseMap(): VoidResult {
    this.baseMapRetries += 1;
    this.#emitter.emit('basemap-health', INITIAL_BASE_MAP_HEALTH);
    return ok();
  }

  override dispose(): void {
    this.disposed = true;
    this.#state = 'disposed';
    this.#emitter.dispose();
  }

  get lastMove(): CameraCommand | undefined {
    return this.moves.at(-1)?.command;
  }
}

function describe(command: CameraCommand): string {
  const t = command.target;
  return `${command.transition.motion}:z${t.zoom ?? '-'}:p${t.pitch ?? '-'}:b${t.bearing ?? '-'}`;
}
