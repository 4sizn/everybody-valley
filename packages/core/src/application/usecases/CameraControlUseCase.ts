/**
 * 카메라 조작 묶음 — 원형 컨트롤과 시트 CTA 가 부르는 것들.
 *
 * 하나같이 "프리셋으로 카메라 명령을 만들어 큐에 넣는다"라는 같은 모양이라
 * 유즈케이스를 다섯 개로 쪼개는 대신 한 클래스에 모았다. 전부 `preempt` 라
 * 버튼을 연달아 눌러도 애니메이션이 겹치지 않는다 — 데모 주석이 경고한
 * `flyTo/easeTo` 연타 시 타일 캐시 경합을 구조적으로 줄인다.
 */

import type { CameraCommand, CameraPose } from '../../domain/camera/CameraPose';
import {
  alignNorth,
  focusValley,
  GLOBE_ZOOM_THRESHOLD,
  inspectNearby,
  recenterLaunch,
  returnFromGlobe,
  togglePitch,
  ZOOM_STEP,
  zoomBy,
  zoomToGlobe,
} from '../../domain/camera/CameraPresets';
import type { SegmentId } from '../../domain/valley/ids';
import type { SerialTaskQueue } from '../../shared/async/SerialTaskQueue';
import { CancelledError } from '../../shared/errors';
import type { Logger } from '../../shared/logger/Logger';
import { err, type VoidResult } from '../../shared/result';
import type { MapEnginePort } from '../ports/MapEnginePort';
import type { SessionStore } from '../state/SessionStore';

export type CameraControlDeps = {
  readonly engine: MapEnginePort;
  readonly store: SessionStore;
  readonly cameraQueue: SerialTaskQueue;
  readonly logger: Logger;
};

export class CameraControlUseCase {
  readonly #deps: CameraControlDeps;
  readonly #logger: Logger;

  constructor(deps: CameraControlDeps) {
    this.#deps = deps;
    this.#logger = deps.logger.child('camera-control');
  }

  /** 나침반 — 북쪽 정렬. */
  alignNorth(): Promise<VoidResult> {
    return this.#run('camera:align-north', alignNorth());
  }

  /** 발사 지점으로 복귀. festival 의 "내 위치" 자리 버튼. */
  recenterLaunch(): Promise<VoidResult> {
    const launchSite = this.#deps.store.state.festival?.launchSite;
    if (launchSite === undefined) return this.#notLoaded('camera:recenter-launch');
    return this.#run('camera:recenter-launch', recenterLaunch(launchSite));
  }

  /**
   * 계곡 전체 보기로 복귀. valley 의 같은 자리 버튼.
   * 구간이 선택돼 있으면 그 계곡, 아니면 첫 계곡 — 계곡이 여럿일 때 "돌아갈 곳"이다.
   */
  recenterValley(): Promise<VoidResult> {
    const state = this.#deps.store.state;
    const valleys = state.valleys;
    if (valleys === null) return this.#notLoaded('camera:recenter-valley');
    const selected =
      state.selectedSegmentId === null
        ? undefined
        : valleys.find((valley) => valley.findSegment(state.selectedSegmentId as SegmentId).ok);
    const target = selected ?? valleys[0];
    if (target === undefined) return this.#notLoaded('camera:recenter-valley');
    return this.#run('camera:recenter-valley', focusValley(target.center(), state.viewportInsets));
  }

  /**
   * 확대 한 단계. 표현 계층의 `+` 버튼.
   *
   * 현재 줌을 알아야 하므로 카메라가 준비되기 전에는 조용히 무시한다 —
   * `#currentPose()` 가 스냅샷과 엔진을 차례로 본다.
   */
  zoomIn(): Promise<VoidResult> {
    const pose = this.#currentPose();
    if (pose === null) return this.#notLoaded('camera:zoom-in');
    return this.#run('camera:zoom-in', zoomBy(pose.zoom, ZOOM_STEP));
  }

  /** 축소 한 단계. 표현 계층의 `−` 버튼. */
  zoomOut(): Promise<VoidResult> {
    const pose = this.#currentPose();
    if (pose === null) return this.#notLoaded('camera:zoom-out');
    return this.#run('camera:zoom-out', zoomBy(pose.zoom, -ZOOM_STEP));
  }

  /** 2D / 3D 토글. */
  togglePitch(): Promise<VoidResult> {
    const pose = this.#currentPose();
    if (pose === null) return this.#notLoaded('camera:toggle-pitch');
    return this.#run('camera:toggle-pitch', togglePitch(pose.pitch));
  }

  /**
   * 지구본 토글. 데모는 현재 줌으로 방향을 정한다 —
   * `map.getZoom() > 4` 이면 나가고, 아니면 돌아온다.
   */
  toggleGlobe(): Promise<VoidResult> {
    const launchSite = this.#deps.store.state.festival?.launchSite;
    const pose = this.#currentPose();
    if (launchSite === undefined || pose === null) return this.#notLoaded('camera:toggle-globe');
    const command =
      pose.zoom > GLOBE_ZOOM_THRESHOLD ? zoomToGlobe(launchSite) : returnFromGlobe(launchSite);
    return this.#run('camera:toggle-globe', command);
  }

  /** 상세 패널의 '주변에서 명당 찾기'. 현재 방위에서 70도 더 돌린다. */
  inspectNearby(): Promise<VoidResult> {
    const state = this.#deps.store.state;
    const pose = this.#currentPose();
    const selectedId = state.selectedSpotId;
    if (pose === null || selectedId === null || state.festival === null) {
      return this.#notLoaded('camera:inspect-nearby');
    }
    const found = state.festival.findSpot(selectedId);
    if (!found.ok) return Promise.resolve(found);
    return this.#run('camera:inspect-nearby', inspectNearby(found.value.position, pose.bearing));
  }

  /**
   * 현재 카메라. 스토어의 스냅샷을 먼저 보고, 아직 이벤트가 오지 않았으면
   * 엔진에 직접 묻는다 — 첫 조작이 스냅샷 없이 들어오는 창을 메운다.
   */
  #currentPose(): CameraPose | null {
    const snapshot = this.#deps.store.state.camera;
    if (snapshot !== null) return snapshot;
    const live = this.#deps.engine.getCamera();
    return live.ok ? live.value : null;
  }

  #run(operation: string, command: CameraCommand): Promise<VoidResult> {
    const { engine, cameraQueue } = this.#deps;
    return cameraQueue.run(operation, (token) => engine.moveCamera(command, token), 'preempt');
  }

  #notLoaded(operation: string): Promise<VoidResult> {
    this.#logger.debug('데이터·카메라 준비 전 조작을 무시했다', { operation });
    return Promise.resolve(
      err(new CancelledError(operation, { context: { reason: 'not-ready' } })),
    );
  }
}
