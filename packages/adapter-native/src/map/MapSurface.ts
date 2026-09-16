/**
 * 명령형 포트와 선언형 지도 뷰 사이의 양방향 다리.
 *
 * ```
 *  MapEnginePort 호출  ──▶  MapSurface.publish()  ──▶  scene 스냅샷  ──▶  <Map>/<Layer>/<Marker>
 *  MapEnginePort 이벤트 ◀──  MapSurface.report*()  ◀──  onPress / onRegion* / onDidFinishLoadingStyle
 *  moveCamera()        ──▶  MapSurface.moveCamera() ──▶  CameraRef.setStop()
 * ```
 *
 * 왜 이 물건이 필요한가 — `@maplibre/maplibre-react-native` 는 지도·소스·
 * 레이어·마커를 React 엘리먼트로 만든다. 어댑터가 지도 객체를 소유할 수
 * 없으므로, "무엇을 그릴지"는 스냅샷으로 넘기고 "지금 지도가 어떤 상태인지"
 * 는 뷰가 되돌려 준다. 이 파일이 그 두 방향의 유일한 통로다.
 *
 * 소유권: 표현 계층이 만들고 표현 계층이 정리한다(지도 뷰와 생애가 같다).
 * 엔진은 빌려 쓰기만 하므로 `dispose()` 하지 않는다.
 */
import {
  type Disposable,
  Emitter,
  type EmitterView,
  type Logger,
  ObservableStore,
} from '@modu-valley/core';
import {
  EMPTY_MAP_SCENE,
  type MapScene,
  type NativeCameraStop,
  type NativeViewState,
} from './MapScene';

/**
 * 카메라를 실제로 움직이는 쪽. 표현 계층이 `CameraRef.setStop` 으로 구현한다.
 * 어댑터가 SDK 타입을 몰라도 되게 하는 좁은 구멍이다.
 *
 * 아직 네이티브 뷰가 없으면 `false` 를 돌려준다 — 못 움직였다는 사실이
 * 호출부까지 올라가야 `Result` 로 드러난다.
 */
export type MapCameraDriver = {
  readonly setStop: (stop: NativeCameraStop) => boolean;
};

export type MapSurfaceEvents = {
  /** 스타일 로드가 끝났다. `onDidFinishLoadingStyle`. */
  'style-loaded': undefined;
  /**
   * 지도 리소스 로드가 실패했다. `onDidFailLoadingMap` — 스타일뿐 아니라 타일·글리프 실패에도
   * 온다(mbgl `onDidFailLoadingMap` 은 리소스 오류마다). 초기화 중이면 스타일 실패, ready 뒤면
   * 베이스맵 헬스의 실패 하나로 센다(C7).
   */
  'style-failed': undefined;
  /**
   * 지도가 완전히 그려졌다. `onDidFinishRenderingMapFully` — 베이스맵 헬스의 성공 신호(C7).
   * 오류난 타일도 "완료" 로 치므로 엔진이 실패 직후의 신호는 무시한다(`BaseMapHealthMonitor`).
   */
  rendered: undefined;
  /** 카메라가 움직이는 중. `onRegionIsChanging`. */
  'view-state': NativeViewState;
  /** 카메라 이동이 끝났다. `onRegionDidChange` — web 의 `moveend` 자리. */
  settled: NativeViewState;
  /**
   * 어떤 소스의 피처를 눌렀다. 뷰는 소스 id 와 속성에서 읽은 도메인 id 만
   * 올리고, 종류로 바꾸는 일은 엔진이 한다(`MAP_LAYER_SETS` 조회).
   */
  'feature-press': { readonly sourceId: string; readonly featureId: string };
  /** 지도 빈 곳을 눌렀다. */
  'background-press': undefined;
};

export class MapSurface implements Disposable {
  readonly scene: ObservableStore<MapScene>;

  readonly #emitter: Emitter<MapSurfaceEvents>;
  readonly #logger: Logger;

  #camera: MapCameraDriver | null = null;
  #disposed = false;

  constructor(logger: Logger) {
    this.#logger = logger.child('map-surface');
    this.scene = new ObservableStore<MapScene>(EMPTY_MAP_SCENE, this.#logger);
    this.#emitter = new Emitter<MapSurfaceEvents>(this.#logger);
  }

  /** 엔진이 구독하는 얼굴. 발화 권한은 표현 계층의 `report*` 에만 있다. */
  get events(): EmitterView<MapSurfaceEvents> {
    return this.#emitter;
  }

  // ── 엔진 → 뷰 ────────────────────────────────────────────────

  /** 그릴 것을 갱신한다. 값이 모두 같으면 재렌더가 일어나지 않는다. */
  publish(patch: Partial<MapScene>): void {
    if (this.#disposed) return;
    this.scene.update((current) => ({ ...current, ...patch }));
  }

  /**
   * 카메라 명령을 흘려보낸다. 아직 뷰가 붙지 않았으면 `false` —
   * 호출부가 "준비되지 않음"을 `Result` 로 올릴 수 있게 조용히 삼키지 않는다.
   */
  moveCamera(stop: NativeCameraStop): boolean {
    if (this.#disposed) return false;
    const camera = this.#camera;
    if (camera === null) return false;
    try {
      return camera.setStop(stop);
    } catch (thrown) {
      // `setStop` 은 네이티브 뷰가 아직 없으면 던진다(래퍼 구현).
      this.#logger.debug('카메라 명령을 전달하지 못했다', { reason: String(thrown) });
      return false;
    }
  }

  // ── 뷰 → 엔진 ────────────────────────────────────────────────

  /** 지도 뷰가 마운트/언마운트될 때 카메라 손잡이를 넣고 뺀다. */
  attachCamera(driver: MapCameraDriver | null): void {
    if (this.#disposed) return;
    this.#camera = driver;
  }

  reportStyleLoaded(): void {
    this.#emitter.emit('style-loaded', undefined);
  }

  reportStyleFailed(): void {
    this.#emitter.emit('style-failed', undefined);
  }

  reportRendered(): void {
    this.#emitter.emit('rendered', undefined);
  }

  reportViewState(state: NativeViewState): void {
    this.#emitter.emit('view-state', state);
  }

  reportSettled(state: NativeViewState): void {
    // 이동 종료도 최신 시점이다 — 둘을 함께 보내 스냅샷이 뒤처지지 않게 한다.
    this.#emitter.emit('view-state', state);
    this.#emitter.emit('settled', state);
  }

  reportFeaturePress(sourceId: string, featureId: string): void {
    this.#emitter.emit('feature-press', { sourceId, featureId });
  }

  reportBackgroundPress(): void {
    this.#emitter.emit('background-press', undefined);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#camera = null;
    this.#emitter.dispose();
    this.scene.dispose();
  }
}
