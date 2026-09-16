/**
 * maplibre-native 기반 지도 엔진 어댑터 (android/ios).
 *
 * `MapLibreEngine`(web)과 같은 포트를 구현하지만 SDK 의 모양이 달라 역할
 * 분담이 다르다. 선언형 래퍼에서는 지도 객체를 어댑터가 소유할 수 없으므로,
 * 이 클래스는 **무엇을 그릴지**를 `MapSurface` 에 게시하고 **지도가 무엇을
 * 알려 왔는지**를 포트 이벤트로 되돌린다. 실제 렌더링은 표현 계층의
 * `<Map>` 트리가 한다(`MapSurface` 주석의 그림 참고).
 *
 * 초기화 순서
 *   스타일 JSON fetch → 구성(팔레트 → 라벨 → 장식) → scene 에 게시(여기서 지도가 뜬다)
 *   → `onDidFinishLoadingStyle` 대기 → ready
 *
 * web 과 같게 유지되는 것
 *   · 모든 실패가 `Result` 로 나온다.
 *   · 카메라 이동은 취소 가능하고, 끝날 때까지 기다린다.
 *   · 중간에 취소되면 그 지점까지의 상태를 되돌린다.
 *
 * web 과 다른 것은 능력 매트릭스에 적혀 있다(`NativeMapCapabilities.ts`).
 * 불꽃 파티클만은 구조적으로 옮길 수 없어 `setFireworksEnabled` 가 항상
 * 실패를 돌려준다 — 표현 계층은 그 사실을 미리 읽어 버튼을 비활성으로 둔다.
 */
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import {
  BaseMapHealthMonitor,
  type CameraCommand,
  type CameraPose,
  type CancellationToken,
  CapabilityUnsupportedError,
  DisposableStore,
  EMPTY_MAP_CONTENT,
  Emitter,
  type EmitterView,
  err,
  INITIAL_VIEW,
  type InitialCameraView,
  type LifecycleState,
  LngLat,
  type Logger,
  type MapCapabilities,
  type MapContent,
  MapEngineError,
  type MapEngineEvents,
  MapEnginePort,
  type MapGestures,
  type MapSelection,
  ok,
  type ProjectionMode,
  type Result,
  toDisposable,
  toMapFeatureRef,
  type VoidResult,
} from '@modu-valley/core';
import {
  FLOW_DASH_LAYER_ID,
  FLOW_DASH_SEQUENCE,
  FLOW_FRAME_MS,
  findLayerSetBySource,
  findPlacementLayerId,
  flowDashArray,
  isInteractiveLayerSet,
  isShadeVisible,
  LAYER_PLACEMENTS,
  type LayerPlacement,
  MAP_LAYER_SETS,
  MAP_STYLE_URLS,
  type MapStyleMode,
  mergePaintOverrides,
  type PaintOverrides,
  sameDependencies,
  valleyPaintOverrides,
} from '@modu-valley/map-style';
import { MAPLIBRE_NATIVE_CAPABILITIES } from '../NativeMapCapabilities';
import {
  EMPTY_LAYER_PAINT_OVERRIDES,
  EMPTY_MAP_SCENE,
  EMPTY_PLACEMENT_LAYER_IDS,
  type NativeViewState,
  type PlacementLayerIds,
  type SceneSources,
  type SelectedPin,
} from './MapScene';
import type { MapSurface } from './MapSurface';
import { NativeCameraController } from './NativeCameraController';
import { loadMapStyle } from './nativeStyle';

/**
 * 스타일 로드 완료 신호를 기다리는 한계. 넘으면 실패로 두지 않고 경고만
 * 남기고 ready 로 간다 — 레이어·마커는 선언형이라 이 신호와 무관하게
 * 그려지므로, 신호 하나 때문에 화면 전체를 막을 이유가 없다.
 */
const STYLE_READY_TIMEOUT_MS = 15_000;

export type NativeMapEngineOptions = {
  readonly surface: MapSurface;
  /** 지도 최초 중심. */
  readonly launchSite: LngLat;
  /** 지도 최초 시점(줌·pitch·bearing). 생략하면 festival 데모의 `INITIAL_VIEW`. */
  readonly initialView?: InitialCameraView;
  readonly logger: Logger;
  /**
   * 지도 팔레트 모드. 앱 테마와 같은 값을 넘긴다 — 라이트는 positron 재색칠,
   * 다크는 데모 장식(밤하늘·3D 건물). 생성 시점에 정해지고 바뀌지 않는다(런타임
   * 전환은 C9).
   */
  readonly styleMode: MapStyleMode;
  /** 베이스 스타일 URL. 생략하면 모드별 openfreemap 스타일(`MAP_STYLE_URLS`). */
  readonly styleUrl?: string;
  /**
   * 지형(DEM 소스 + 고도색·음영기복)을 스타일에 얹는가 — 계곡 장면만 `true`(C10a).
   * 스타일 JSON 에 리터럴 색으로 실리므로 iOS hillshade 버그(#4296·#4453, 런타임 setter)를
   * 거치지 않는다. festival 은 기본값 `false`.
   */
  readonly terrain?: boolean;
  /** 개발용 강제 장애(C7) — openfreemap 오리진을 이 값으로 바꾼다. web `MapLibreEngineOptions` 와 같다. */
  readonly baseMapOriginOverride?: string;
};

/**
 * 실패 뒤 이 시간 안의 "완전히 그려졌다" 신호는 성공으로 세지 않는다(C7). mbgl 은 오류난 타일도
 * 완료로 치고 곧바로 `onDidFinishRenderingMapFully` 를 올리므로, 실패와 같은 프레임의 신호를
 * 회복으로 읽으면 장애가 영영 판정되지 않는다. 네트워크가 돌아와 타일이 실제로 로드된 뒤의 신호는
 * 이 구간 밖에서 온다.
 */
export const NATIVE_SUCCESS_QUIET_MS = 500;

export class NativeMapEngine extends MapEnginePort {
  override readonly capabilities: MapCapabilities = MAPLIBRE_NATIVE_CAPABILITIES;

  readonly #surface: MapSurface;
  readonly #logger: Logger;
  readonly #styleUrl: string;
  readonly #styleMode: MapStyleMode;
  readonly #terrain: boolean;
  readonly #emitter: Emitter<MapEngineEvents>;
  readonly #subscriptions: DisposableStore;
  readonly #camera: NativeCameraController;
  /** 베이스맵 헬스(C7) — `onDidFailLoadingMap` 을 실패, 완전 렌더를 성공으로 넣는다. */
  readonly #health: BaseMapHealthMonitor;
  readonly #baseMapOriginOverride: string | undefined;

  #state: LifecycleState = 'idle';
  #pose: CameraPose;
  /** 물줄기 흐름 타이머. 돌고 있으면 `FLOW_FRAME_MS` 마다 점선 위상을 한 단계 밀어 게시한다. */
  #flowTimer: ReturnType<typeof setInterval> | null = null;
  #flowStep = 0;
  /* `layerPaintOverrides` 의 두 출처 — 흐름 점선(프레임마다)과 계곡 paint(모드·그늘, V1). 게시할
     때 합친다. 한쪽을 갈아 끼우며 다른 쪽을 지우지 않게 따로 든다. */
  #flowPaint: PaintOverrides = EMPTY_LAYER_PAINT_OVERRIDES;
  #valleyPaint: PaintOverrides = EMPTY_LAYER_PAINT_OVERRIDES;
  #paintShadeVisible: boolean | undefined;

  /* 마지막 내용·선택과, 소스별로 마지막에 데이터를 만들 때 쓴 의존 참조.
     web 의 `FeatureLayerController` 와 같은 규칙 — 의존이 하나도 안 바뀐
     소스는 이전 컬렉션 참조를 그대로 두어 뷰가 그 소스를 다시 그리지 않는다. */
  #content: MapContent = EMPTY_MAP_CONTENT;
  #selection: MapSelection | null = null;
  readonly #dependencies = new Map<string, readonly unknown[]>();

  constructor(options: NativeMapEngineOptions) {
    super();
    this.#surface = options.surface;
    this.#logger = options.logger.child('maplibre-native');
    this.#styleMode = options.styleMode;
    this.#terrain = options.terrain === true;
    this.#styleUrl = options.styleUrl ?? MAP_STYLE_URLS[options.styleMode];
    this.#emitter = new Emitter<MapEngineEvents>(this.#logger);
    this.#subscriptions = new DisposableStore(this.#logger);
    this.#baseMapOriginOverride = options.baseMapOriginOverride;
    this.#health = new BaseMapHealthMonitor({
      onChange: (health) => this.#emitter.emit('basemap-health', health),
      successQuietMs: NATIVE_SUCCESS_QUIET_MS,
    });

    /* 시점 스냅샷을 초기 카메라로 미리 채운다. `getCamera()` 는 동기이고
       (`MapRef.getViewState()` 는 비동기라 쓸 수 없다) 첫 조작이 지도 이벤트
       보다 먼저 들어올 수 있다. 표현 계층이 `<Camera initialViewState>` 로
       같은 값을 쓰므로 이 추정은 실제와 일치한다. */
    const initialView = options.initialView ?? INITIAL_VIEW;
    this.#pose = {
      center: options.launchSite,
      zoom: initialView.zoom,
      pitch: initialView.pitch,
      bearing: initialView.bearing,
    };

    this.#surface.publish({
      initialView: {
        center: [options.launchSite.lng, options.launchSite.lat],
        zoom: initialView.zoom,
        pitch: initialView.pitch,
        bearing: initialView.bearing,
      },
    });

    this.#camera = new NativeCameraController({
      surface: options.surface,
      logger: this.#logger,
      readPose: () => this.#pose,
    });
    this.#subscriptions.add(this.#camera);
  }

  override get state(): LifecycleState {
    return this.#state;
  }

  override get events(): EmitterView<MapEngineEvents> {
    return this.#emitter;
  }

  override async initialize(token: CancellationToken): Promise<VoidResult> {
    if (this.#state === 'ready') return ok();
    if (this.#state === 'disposed') {
      return err(new MapEngineError('map/not-initialized', '이미 정리된 엔진입니다.'));
    }
    this.#state = 'initializing';

    const style = await loadMapStyle(
      {
        styleUrl: this.#styleUrl,
        styleMode: this.#styleMode,
        terrain: this.#terrain,
        logger: this.#logger,
        ...(this.#baseMapOriginOverride === undefined
          ? {}
          : { baseMapOriginOverride: this.#baseMapOriginOverride }),
      },
      token,
    );
    if (!style.ok) {
      this.#state = token.cancelled ? 'idle' : 'failed';
      return style;
    }

    // 게시 전에 구독을 걸어 둔다 — 지도가 곧바로 스타일 로드를 끝낼 수 있다.
    this.#wireSurfaceEvents();
    /* 배치별 기준 레이어를 여기서 한 번 계산한다. 뷰는 이 값을 `beforeId` 로 넘길 뿐
       스타일을 훑지 않는다. web 의 `FeatureLayerController.install` 과 같은 함수·같은 규칙. */
    // 케이싱 색(V1 (c))은 첫 프레임부터 모드 값이어야 한다 — 스타일과 함께 게시한다. 그늘은 꺼짐.
    this.#valleyPaint = this.#valleyPaintFor(false);
    this.#surface.publish({
      style: style.value,
      placementLayerIds: toPlacementLayerIds(style.value),
      layerPaintOverrides: this.#mergedPaint(),
    });

    const loaded = await this.#awaitStyleLoaded(token);
    if (!loaded.ok) {
      this.#state = token.cancelled ? 'idle' : 'failed';
      this.#subscriptions.clear();
      this.#surface.publish({ style: null, placementLayerIds: EMPTY_PLACEMENT_LAYER_IDS });
      return loaded;
    }

    this.#state = 'ready';
    this.#emitter.emit('ready', undefined);
    this.#logger.info('지도 준비 완료');
    return ok();
  }

  override moveCamera(command: CameraCommand, token: CancellationToken): Promise<VoidResult> {
    return this.#camera.move(command, token);
  }

  override stopCamera(): void {
    this.#camera.stop();
  }

  override getCamera(): Result<CameraPose> {
    if (this.#state === 'disposed') {
      return err(new MapEngineError('map/not-initialized', '이미 정리된 엔진입니다.'));
    }
    return ok(this.#pose);
  }

  /**
   * 네이티브 SDK 는 투영을 바꾸는 통로를 열어 주지 않는다. 기본값인
   * mercator 요청만 성공으로 받고, 나머지는 능력 부족을 드러낸다.
   */
  override setProjection(mode: ProjectionMode): VoidResult {
    if (mode === 'mercator') return ok();
    return err(new CapabilityUnsupportedError('globeProjection', this.capabilities.engineName));
  }

  /**
   * 제스처 정책을 scene 에 게시한다. 네이티브에서 제스처는 `<Map>` 의
   * prop 이라 명령형으로 적용할 수 없고, 표현 계층이 이 값을 읽어 넘긴다.
   *
   * 래퍼는 web 과 달리 핀치 줌·회전·빠른 줌을 **각각** 받으므로 정책이
   * 1:1 로 옮겨진다(`MapGestures` 주석의 비대칭은 web 쪽에만 있다).
   */
  override setGestures(gestures: MapGestures): VoidResult {
    if (this.#state === 'disposed') {
      return err(new MapEngineError('map/not-initialized', '이미 정리된 엔진입니다.'));
    }
    this.#surface.publish({ gestures });
    return ok();
  }

  override renderContent(content: MapContent): VoidResult {
    if (this.#state === 'disposed') {
      return err(new MapEngineError('map/not-initialized', '이미 정리된 엔진입니다.'));
    }
    this.#content = content;
    this.#publishSources();
    this.#publishValleyPaint(isShadeVisible(content));
    return ok();
  }

  override setSelection(selection: MapSelection | null): VoidResult {
    if (this.#state === 'disposed') {
      return err(new MapEngineError('map/not-initialized', '이미 정리된 엔진입니다.'));
    }
    this.#selection = selection;
    // 구간·시설의 `selected` 속성은 소스 데이터에 실리므로 소스도 함께 본다.
    this.#publishSources({ selectedPin: toSelectedPin(selection) });
    return ok();
  }

  /**
   * 불꽃은 카메라 MVP 행렬을 받아 직접 그리는 커스텀 레이어를 전제로 한다.
   * 래퍼가 렌더 콜백과 행렬을 노출하지 않아 같은 방식이 성립하지 않는다
   * (`NativeMapCapabilities.ts` 주석). 조용히 아무 일도 하지 않는 대신
   * 실패를 돌려줘, 눌렸는데 반응 없는 버튼이 생기지 않게 한다.
   */
  override setFireworksEnabled(_enabled: boolean): VoidResult {
    return err(new CapabilityUnsupportedError('particleLayer', this.capabilities.engineName));
  }

  /**
   * 물줄기 흐름 on/off — 네이티브에는 rAF 가 없으니 타이머로 `line-dasharray` 를 밀어 게시한다.
   * 뷰는 `layerPaintOverrides` 를 점선 레이어 paint 위에 얹는다(web `setPaintProperty` 자리).
   * 끄면 첫 단계로 되돌려 정지 화면이 항상 같다. 같은 값은 no-op.
   */
  override setWaterFlowEnabled(enabled: boolean): VoidResult {
    if (this.#state === 'disposed') {
      return err(new MapEngineError('map/not-initialized', '이미 정리된 엔진입니다.'));
    }
    if (enabled === (this.#flowTimer !== null)) return ok();
    if (enabled) {
      this.#flowStep = 0;
      this.#flowTimer = setInterval(() => {
        this.#flowStep = (this.#flowStep + 1) % FLOW_DASH_SEQUENCE.length;
        this.#publishFlowStep(this.#flowStep);
      }, FLOW_FRAME_MS);
      this.#logger.debug('흐름 애니메이션 시작');
      return ok();
    }
    this.#stopFlow();
    this.#logger.debug('흐름 애니메이션 정지');
    return ok();
  }

  /**
   * 베이스맵 재시도(C7) — 네이티브 래퍼에는 소스별 reload 가 없다. 같은 내용의 스타일을 **새
   * 참조**로 게시하면 `<Map mapStyle>` 이 바뀐 것으로 보고 스타일을 다시 적용해 타일을 다시
   * 요청한다. GeoJSON 소스·핀·paint 는 스냅샷의 다른 필드라 그대로다. 헬스는 처음으로.
   */
  override retryBaseMap(): VoidResult {
    if (this.#state !== 'ready') return err(notReadyError('retryBaseMap'));
    const style = this.#surface.scene.getSnapshot().style;
    if (style === null) return err(notReadyError('retryBaseMap'));
    this.#surface.publish({ style: { ...style } });
    this.#health.reset();
    this.#logger.info('베이스맵 스타일 다시 적용');
    return ok();
  }

  override dispose(): void {
    if (this.#state === 'disposed') return;
    this.#state = 'disposed';
    this.#stopFlow();
    this.#health.dispose();
    this.#subscriptions.dispose();
    // 지도 뷰는 표현 계층이 소유한다. 그릴 것만 비워 다음 엔진이 깨끗한
    // 화면에서 시작하게 한다 — surface 자체는 정리하지 않는다.
    this.#surface.publish(EMPTY_MAP_SCENE);
    this.#dependencies.clear();
    this.#valleyPaint = EMPTY_LAYER_PAINT_OVERRIDES;
    this.#paintShadeVisible = undefined;
    this.#emitter.dispose();
  }

  // ── 내부 ──────────────────────────────────────────────────────

  /**
   * 현재 내용·선택으로 소스 데이터를 다시 만들어 게시한다. 의존 참조가 같은
   * 소스는 이전 컬렉션을 그대로 둔다(뷰의 `GeoJSONSource` 가 memo 라 참조가
   * 같으면 다시 그리지 않는다).
   */
  #publishSources(extra: { readonly selectedPin?: SelectedPin | null } = {}): void {
    const previous = this.#surface.scene.getSnapshot().sources;
    const next: Record<string, SceneSources[string]> = { ...previous };
    let changed = false;

    for (const set of MAP_LAYER_SETS) {
      const dependencies = set.dependencies(this.#content, this.#selection);
      if (sameDependencies(this.#dependencies.get(set.sourceId), dependencies)) continue;
      next[set.sourceId] = set.toFeatureCollection(this.#content, this.#selection);
      this.#dependencies.set(set.sourceId, dependencies);
      changed = true;
    }

    const patch = changed ? { sources: next, ...extra } : extra;
    if (Object.keys(patch).length > 0) this.#surface.publish(patch);
  }

  #publishFlowStep(step: number): void {
    this.#flowPaint = { [FLOW_DASH_LAYER_ID]: { 'line-dasharray': flowDashArray(step) } };
    this.#surface.publish({ layerPaintOverrides: this.#mergedPaint() });
  }

  #stopFlow(): void {
    if (this.#flowTimer !== null) clearInterval(this.#flowTimer);
    this.#flowTimer = null;
    this.#flowStep = 0;
    this.#flowPaint = EMPTY_LAYER_PAINT_OVERRIDES;
    this.#surface.publish({ layerPaintOverrides: this.#mergedPaint() });
  }

  /**
   * 계곡 paint(V1) — web 의 `#applyValleyPaint` 와 같은 함수·같은 값. 그늘 상태가 바뀔 때만 게시.
   * 음영기복 항목은 뷰가 그리지 않는다(스타일 JSON 레이어, iOS #4453) — `valleyPaint.ts` 주의.
   */
  #publishValleyPaint(shadeVisible: boolean): void {
    if (shadeVisible === this.#paintShadeVisible) return;
    this.#valleyPaint = this.#valleyPaintFor(shadeVisible);
    this.#surface.publish({ layerPaintOverrides: this.#mergedPaint() });
  }

  #valleyPaintFor(shadeVisible: boolean): PaintOverrides {
    this.#paintShadeVisible = shadeVisible;
    return valleyPaintOverrides(this.#styleMode, { shadeVisible });
  }

  /** 계곡 paint 위에 흐름 점선 — 둘은 레이어가 겹치지 않으므로 순서는 형식상이다. */
  #mergedPaint(): PaintOverrides {
    return mergePaintOverrides(this.#valleyPaint, this.#flowPaint);
  }

  #wireSurfaceEvents(): void {
    const events = this.#surface.events;

    this.#subscriptions.add(
      events.on('view-state', (state) => {
        const pose = toCameraPose(state);
        if (pose === null) return;
        this.#pose = pose;
        this.#emitter.emit('camera-change', pose);
      }),
    );

    this.#subscriptions.add(
      events.on('feature-press', ({ sourceId, featureId }) => {
        const set = findLayerSetBySource(sourceId);
        if (set === undefined) {
          // 뷰가 모르는 소스를 올렸다 — 배선 불일치이므로 삼키지 않고 남긴다.
          this.#logger.warn('알 수 없는 소스의 press 를 무시한다', { sourceId, featureId });
          return;
        }
        if (!isInteractiveLayerSet(set)) {
          /* 그늘처럼 히트 대상이 아닌 셋. 뷰가 `onPress` 를 달지 않으므로 보통 여기 오지
             않지만, 소스의 모든 피처에 발화하는 래퍼 특성상 방어선을 둔다. */
          this.#logger.debug('히트 대상이 아닌 소스의 press 를 무시한다', { sourceId });
          return;
        }
        this.#emitter.emit('feature-press', toMapFeatureRef(set.kind, featureId));
      }),
    );

    this.#subscriptions.add(
      events.on('background-press', () => this.#emitter.emit('background-press', undefined)),
    );

    this.#subscriptions.add(
      events.on('style-failed', () => {
        this.#emitter.emit(
          'recoverable-error',
          new MapEngineError('map/style-load-failed', '지도 리소스 로드가 실패했습니다.'),
        );
        /* ready 뒤의 `onDidFailLoadingMap` 은 타일·글리프 같은 리소스 실패다 — 베이스맵 헬스의 실패
           하나(C7). 초기화 중의 것은 `#awaitStyleLoaded` 가 스타일 실패로 처리한다. 네이티브는 어느
           URL 이 실패했는지 알려 주지 않으므로 호스트 판별 없이 센다(스타일의 원격 소스는 베이스맵뿐). */
        if (this.#state === 'ready') this.#health.failure();
      }),
    );

    this.#subscriptions.add(
      events.on('rendered', () => {
        if (this.#state === 'ready') this.#health.success();
      }),
    );
  }

  /** `onDidFinishLoadingStyle` 을 취소 가능한 await 로 바꾼다. */
  #awaitStyleLoaded(token: CancellationToken): Promise<VoidResult> {
    const store = new DisposableStore(this.#logger);
    let settle: (result: VoidResult) => void = () => {};

    const promise = new Promise<VoidResult>((resolve) => {
      settle = (result) => {
        store.dispose();
        resolve(result);
      };
    });

    store.add(this.#surface.events.once('style-loaded', () => settle(ok())));
    store.add(
      this.#surface.events.once('style-failed', () =>
        settle(
          err(
            new MapEngineError('map/style-load-failed', '지도가 스타일을 불러오지 못했습니다.', {
              context: { styleUrl: this.#styleUrl },
            }),
          ),
        ),
      ),
    );
    store.add(token.onCancel((reason) => settle(err(reason))));

    const timer = setTimeout(() => {
      this.#logger.warn('스타일 로드 완료 신호를 받지 못해 그대로 진행한다', {
        timeoutMs: STYLE_READY_TIMEOUT_MS,
      });
      settle(ok());
    }, STYLE_READY_TIMEOUT_MS);
    store.add(toDisposable(() => clearTimeout(timer)));

    return promise;
  }
}

/**
 * 선택 → 핀 한 개. 명당만 핀을 갖는다. 시설은 마커 자체가 물방울 핀이라(C5) 선택을 레이어의
 * `selected`(핀 확대 + 흰 링)로 보이고, 구간(선)은 `selected` 강조로 충분하므로 둘 다 `null`.
 * web 의 `SelectionPinController` 와 같은 규칙.
 */
function toSelectedPin(selection: MapSelection | null): SelectedPin | null {
  if (selection === null) return null;
  switch (selection.kind) {
    case 'spot':
      return {
        id: selection.spot.id,
        center: [selection.spot.position.lng, selection.spot.position.lat],
        color: selection.spot.color,
      };
    case 'facility':
    case 'segment':
      return null;
  }
}

function notReadyError(operation: string): MapEngineError {
  return new MapEngineError('map/not-initialized', '지도가 아직 준비되지 않았습니다.', {
    context: { operation },
  });
}

/** 모든 배치 이름에 대해 기준 레이어 id 를 한 번에 푼다. 기준이 없는 배치는 `null`(맨 위). */
function toPlacementLayerIds(style: StyleSpecification): PlacementLayerIds {
  const entries = LAYER_PLACEMENTS.map(
    (placement) => [placement, findPlacementLayerId(style, placement) ?? null] as const,
  );
  return Object.fromEntries(entries) as Record<LayerPlacement, string | null>;
}

/** 브리지를 건너온 시점 값을 도메인 값 객체로. 잘못된 좌표는 버린다. */
function toCameraPose(state: NativeViewState): CameraPose | null {
  const center = LngLat.create(state.center[0], state.center[1]);
  if (!center.ok) return null;
  return {
    center: center.value,
    zoom: state.zoom,
    pitch: state.pitch,
    bearing: state.bearing,
  };
}
