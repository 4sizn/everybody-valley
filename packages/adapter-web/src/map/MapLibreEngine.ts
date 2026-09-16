/**
 * maplibre-gl 기반 지도 엔진 어댑터 (web 전용).
 *
 * 원본 데모의 `new maplibregl.Map({...})` + `style.load` 콜백 전체가 이
 * 클래스 안으로 들어왔다. 밖에서 보이는 것은 `MapEnginePort` 뿐이다.
 *
 * 데모와 다른 점은 순서와 회수가 명시적이라는 것뿐이다.
 *   · 스타일 JSON 을 먼저 받아 `composeMapStyle`(팔레트 → 라벨 → 장식)로 완성한
 *     **객체**를 지도에 넘긴다. 데모처럼 URL 을 넘기고 로드 뒤에 `setSky` ·
 *     `setLayoutProperty` · `addLayer` 로 얹으면 첫 프레임에 원본 색이 한 번
 *     비치고 레이어가 깜빡이며 얹힌다 — 네이티브와 같은 경로로 맞춰 없앴다.
 *   · 스타일 로드를 콜백이 아니라 취소 가능한 await 로 기다린다.
 *   · 실패는 어느 단계에서든 `Result` 로 올라온다.
 *   · 중간에 취소되면 그 지점까지 만든 자원을 되돌린다.
 */
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
  isBaseMapUrl,
  type LifecycleState,
  type LngLat,
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
  type RandomSource,
  type Result,
  sourceUrlOf,
  toAppError,
  toDisposable,
  type VoidResult,
  waitForEvent,
} from '@modu-valley/core';
import {
  BASE_MAP_HOSTS,
  composeMapStyle,
  facilityIconSvgById,
  hostOfOrigin,
  isShadeVisible,
  isStyleSpecification,
  MAP_LAYER_SETS,
  MAP_STYLE_URLS,
  type MapStyleMode,
  overrideBaseMapOrigin,
  overrideOpenFreeMapUrl,
  type PaintOverrides,
  TERRAIN_DEM_SOURCE_ID,
  TERRAIN_EXAGGERATION,
  valleyPaintOverrides,
} from '@modu-valley/map-style';
import type {
  ErrorEvent as MapLibreErrorEvent,
  MapMouseEvent,
  MapSourceDataEvent,
  StyleSpecification,
} from 'maplibre-gl';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { FireworkLayer } from '../fireworks/index';
import { CameraController } from './CameraController';
import { FeatureLayerController } from './FeatureLayerController';
import { MarkerIconRegistry } from './MarkerIconRegistry';
import { toLngLatLike } from './mapStyle';
import { SelectionPinController } from './SelectionPinController';
import { WaterFlowController } from './WaterFlowController';

export const MAPLIBRE_CAPABILITIES: MapCapabilities = {
  engineName: 'maplibre-gl',
  globeProjection: true,
  extrudedBuildings: true,
  particleLayer: true,
  localizedLabels: true,
  cameraOffset: true,
  sky: true,
  // `NavigationControl` 이 +/− 버튼을 직접 얹는다(아래 `#createMap`).
  builtInZoomControls: true,
  // `setTerrain`(DEM 으로 지면을 들어 올림) — 계곡 장면에서 켠다(`#installTerrain`, C10b).
  terrain: true,
};

export type MapLibreEngineOptions = {
  readonly container: HTMLElement;
  /** 지도 최초 중심 + 불꽃 발사 원점. */
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
   * 개발용 강제 장애(C7) — openfreemap 오리진(스타일·TileJSON·타일·스프라이트·글리프)을 이
   * 오리진으로 바꾼다(로컬 프록시). 헬스 감시 호스트 목록에도 이 호스트가 더해진다. 정상 빌드는
   * `undefined`. 앱이 `EXPO_PUBLIC_BASEMAP_HOST_OVERRIDE` 로 넘긴다.
   */
  readonly baseMapOriginOverride?: string;
  /**
   * 지형을 켜는가 — 계곡 장면만 `true`. 스타일에 DEM 소스 + 고도색·음영기복을 얹고(C10a),
   * 같은 소스로 3D 지형(`setTerrain`, 배율 `TERRAIN_EXAGGERATION`)을 켠다(C10b).
   * festival(`/firework`)은 기본값 `false` 로 소스 하나도 늘지 않는다(CLAUDE.md 보존).
   * 장면 판단은 스타일 구성 시점에 한 번이다 — 레이어를 뒤에 명령형으로 얹지 않는다.
   */
  readonly terrain?: boolean;
  /** 초기 투영. 데모와 같은 적응형 globe 가 기본. */
  readonly projection?: ProjectionMode;
  /** 불꽃 난수원. 결정적 재현이 필요한 테스트에서 주입한다. */
  readonly random?: RandomSource;
  /**
   * maplibre-gl 워커 스크립트 URL.
   *
   * maplibre-gl 6 은 ESM 전용이고, 워커를 `import.meta.url` 기준 형제 파일
   * (`maplibre-gl-worker.mjs`)로 `{type:'module'}` 워커로 띄운다. Metro 는 그
   * 파일을 번들 산출물로 내보내지 않으므로 워커 요청이 404 가 되고, 워커가
   * 없으면 **타일 로딩과 GeoJSON 파싱이 통째로 멈춘다** — 지도는 떠 있고
   * 커스텀 레이어(불꽃)만 그려지는, 원인을 찾기 어려운 증상이 된다.
   *
   * 그래서 앱이 워커 파일을 정적 자산으로 배치하고 그 경로를 넘긴다.
   * 번들러를 아는 쪽이 앱이므로 이 결정은 앱에 둔다.
   */
  readonly workerUrl?: string;
};

export class MapLibreEngine extends MapEnginePort {
  override readonly capabilities = MAPLIBRE_CAPABILITIES;

  readonly #options: MapLibreEngineOptions;
  readonly #logger: Logger;
  readonly #emitter: Emitter<MapEngineEvents>;
  readonly #resources: DisposableStore;
  /** 베이스맵 헬스(C7) — 오류·타일 이벤트를 넣으면 8초 규칙으로 판정해 `'basemap-health'` 로 올린다. */
  readonly #health: BaseMapHealthMonitor;
  /** 헬스가 세는 호스트 — `BASE_MAP_HOSTS` + 개발용 오리진(있으면). */
  readonly #baseMapHosts: readonly string[];

  #state: LifecycleState = 'idle';
  #map: MapLibreMap | undefined;
  #camera: CameraController | undefined;
  /** `MAP_LAYER_SETS` 순서대로 하나씩. 설치·갱신·해제를 순회로 처리한다. */
  #layers: readonly FeatureLayerController[] = [];
  #pin: SelectionPinController | undefined;
  #fireworks: FireworkLayer | undefined;
  #waterFlow: WaterFlowController | undefined;

  /* 마지막으로 받은 내용과 선택. 선택이 바뀌면 `selected` 속성을 다시 주입해야
     하므로(구간·시설) 내용을 다시 받지 않고도 소스를 갱신할 수 있어야 한다. */
  #content: MapContent = EMPTY_MAP_CONTENT;
  #selection: MapSelection | null = null;
  /** 마지막으로 얹은 계곡 paint 의 그늘 상태(V1). `undefined` 는 아직 한 번도 얹지 않았다. */
  #paintShadeVisible: boolean | undefined;

  constructor(options: MapLibreEngineOptions) {
    super();
    this.#options = options;
    this.#logger = options.logger.child('maplibre');
    this.#emitter = new Emitter<MapEngineEvents>(this.#logger);
    // 지도 1회 생성분의 자원. 초기화 실패·재시도 때 이 store 만 비운다.
    // 에미터는 엔진 생애 전체를 살아야 하므로 여기 넣지 않는다.
    this.#resources = new DisposableStore(this.#logger);
    this.#health = new BaseMapHealthMonitor({
      onChange: (health) => this.#emitter.emit('basemap-health', health),
    });
    const override = options.baseMapOriginOverride;
    this.#baseMapHosts =
      override === undefined ? BASE_MAP_HOSTS : [...BASE_MAP_HOSTS, hostOfOrigin(override)];
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

    const style = await this.#loadStyle(token);
    if (!style.ok) {
      this.#state = token.cancelled ? 'idle' : 'failed';
      return style;
    }

    const created = this.#createMap(style.value);
    if (!created.ok) {
      this.#state = 'failed';
      return created;
    }
    const map = created.value;

    const styleLoaded = await this.#awaitStyle(map, token);
    if (!styleLoaded.ok) {
      this.#state = token.cancelled ? 'idle' : 'failed';
      this.#teardown();
      return styleLoaded;
    }

    const decorated = this.#decorateStyle(map);
    if (!decorated.ok) {
      this.#state = 'failed';
      this.#teardown();
      return decorated;
    }

    const guard = token.checkpoint('map-initialize');
    if (!guard.ok) {
      this.#state = 'idle';
      this.#teardown();
      return guard;
    }

    this.#wireMapEvents(map);
    this.#state = 'ready';
    this.#emitter.emit('ready', undefined);
    this.#logger.info('지도 준비 완료');
    return ok();
  }

  override async moveCamera(command: CameraCommand, token: CancellationToken): Promise<VoidResult> {
    const camera = this.#camera;
    if (camera === undefined) return err(notReady('moveCamera'));
    return camera.move(command, token);
  }

  override stopCamera(): void {
    this.#camera?.stop();
  }

  override getCamera(): Result<CameraPose> {
    const camera = this.#camera;
    if (camera === undefined) return err(notReady('getCamera'));
    return camera.getPose();
  }

  override setProjection(mode: ProjectionMode): VoidResult {
    const map = this.#map;
    if (map === undefined) return err(notReady('setProjection'));
    try {
      map.setProjection({ type: mode });
      return ok();
    } catch (thrown) {
      return err(
        new MapEngineError('map/style-load-failed', '투영 모드를 바꾸지 못했습니다.', {
          cause: thrown,
          context: { mode },
        }),
      );
    }
  }

  /**
   * 제스처 정책을 maplibre-gl 핸들러로 번역한다.
   *
   * 기본값에 맡기지 않고 켤 것과 끌 것을 모두 부른다 — 정책이 코드에
   * 드러나야 네이티브와 어긋났는지 비교할 수 있다.
   *
   * 한 가지가 1:1 로 대응하지 않는다. `touchZoomRotate` 하나가 **핀치 줌 +
   * 핀치 회전 + 더블탭-드래그 빠른 줌**을 함께 들고 있다. 그래서
   *   · 회전은 `disableRotation()` / `enableRotation()` 으로 따로 끊고,
   *   · 빠른 줌은 핀치와 분리할 수 없어 `pinchZoom` 을 따라간다.
   * 후자는 `MapGestures.quickZoom` 주석에 적어 둔 의도된 비대칭이다.
   *
   * `dragRotate`(마우스 우클릭 드래그 회전)는 데스크톱 전용 어포던스이고
   * 네이티브에 대응이 없어 공유 정책에 넣지 않았다. 핀치 회전 정책과 같은
   * 값을 쓴다 — 한 화면에서 회전을 막았는데 마우스로는 돌아가면 이상하다.
   */
  override setGestures(gestures: MapGestures): VoidResult {
    const map = this.#map;
    if (map === undefined) return err(notReady('setGestures'));
    try {
      setHandler(map.dragPan, gestures.pan);
      setHandler(map.touchPitch, gestures.dragPitch);
      setHandler(map.doubleClickZoom, gestures.doubleTapZoom);
      setHandler(map.dragRotate, gestures.pinchRotate);

      setHandler(map.touchZoomRotate, gestures.pinchZoom);
      if (gestures.pinchRotate) {
        map.touchZoomRotate.enableRotation();
      } else {
        map.touchZoomRotate.disableRotation();
      }
      return ok();
    } catch (thrown) {
      return err(
        new MapEngineError('map/initialization-failed', '제스처 설정에 실패했습니다.', {
          cause: thrown,
        }),
      );
    }
  }

  override renderContent(content: MapContent): VoidResult {
    if (this.#layers.length === 0) return err(notReady('renderContent'));
    this.#content = content;
    const synced = this.#syncLayers();
    if (!synced.ok) return synced;
    // 그늘이 켜지고 꺼질 때만 — 같은 상태면 스타일 diff 를 만들지 않는다.
    this.#applyValleyPaint(isShadeVisible(content));
    return ok();
  }

  override setSelection(selection: MapSelection | null): VoidResult {
    const pin = this.#pin;
    if (pin === undefined) return err(notReady('setSelection'));
    this.#selection = selection;

    // 핀과 `selected` 재주입은 독립이다. 둘 다 시도하고 첫 실패를 돌려준다.
    const pinned = pin.set(selection);
    const synced = this.#syncLayers();
    return pinned.ok ? synced : pinned;
  }

  /** 모든 레이어 셋에 현재 내용·선택을 흘려보낸다. 바뀐 소스만 실제로 다시 쓰인다. */
  #syncLayers(): VoidResult {
    for (const layer of this.#layers) {
      const updated = layer.update(this.#content, this.#selection);
      if (!updated.ok) return updated;
    }
    return ok();
  }

  override setFireworksEnabled(enabled: boolean): VoidResult {
    const layer = this.#fireworks;
    if (layer === undefined) {
      return err(new CapabilityUnsupportedError('particleLayer', this.capabilities.engineName));
    }
    layer.setEnabled(enabled);
    return ok();
  }

  /** 흐름 점선 rAF 루프 on/off. 레이어 셋 설치 전에는 준비 전 실패 — 코어가 다음 상태 변화에서 다시 부른다. */
  override setWaterFlowEnabled(enabled: boolean): VoidResult {
    const flow = this.#waterFlow;
    if (flow === undefined || this.#layers.length === 0)
      return err(notReady('setWaterFlowEnabled'));
    flow.setEnabled(enabled);
    return ok();
  }

  /**
   * 베이스맵 소스만 다시 불러온다(C7) — `setTiles`/`setUrl` 로 같은 값을 다시 넣으면 maplibre 가
   * 그 소스의 타일을 전부 버리고 다시 요청한다. 벡터·raster·raster-dem 중 베이스맵 호스트인
   * 것만이고 GeoJSON 은 건드리지 않는다(데이터는 이미 메모리에 있다). 헬스는 처음으로.
   */
  override retryBaseMap(): VoidResult {
    const map = this.#map;
    if (map === undefined) return err(notReady('retryBaseMap'));
    try {
      const sources = map.getStyle()?.sources ?? {};
      let reloaded = 0;
      for (const [id, source] of Object.entries(sources)) {
        const url = sourceUrlOf(source);
        if (url === null || !isBaseMapUrl(url, this.#baseMapHosts)) continue;
        const live = map.getSource(id) as
          | { setTiles?: (tiles: string[]) => unknown; setUrl?: (url: string) => unknown }
          | undefined;
        const spec = source as { url?: string; tiles?: string[] };
        if (spec.tiles !== undefined && live?.setTiles !== undefined) {
          live.setTiles([...spec.tiles]);
          reloaded += 1;
        } else if (spec.url !== undefined && live?.setUrl !== undefined) {
          live.setUrl(spec.url);
          reloaded += 1;
        }
      }
      map.triggerRepaint();
      this.#health.reset();
      this.#logger.info('베이스맵 소스 다시 불러오기', { reloaded });
      return ok();
    } catch (thrown) {
      return err(
        new MapEngineError('map/source-failed', '베이스맵 소스를 다시 불러오지 못했습니다.', {
          cause: thrown,
        }),
      );
    }
  }

  override dispose(): void {
    if (this.#state === 'disposed') return;
    this.#state = 'disposed';
    this.#teardown();
    this.#resources.dispose();
    this.#health.dispose();
    this.#emitter.dispose();
  }

  // ── 내부 ──────────────────────────────────────────────────────

  /**
   * 스타일 JSON 을 받아 `composeMapStyle` 로 완성한다. 네이티브 `loadMapStyle` 과
   * 같은 순서 — fetch → 검증 → 팔레트 → 라벨 → 장식.
   */
  async #loadStyle(token: CancellationToken): Promise<Result<StyleSpecification>> {
    const override = this.#options.baseMapOriginOverride;
    const baseUrl = this.#options.styleUrl ?? MAP_STYLE_URLS[this.#options.styleMode];
    const styleUrl = override === undefined ? baseUrl : overrideOpenFreeMapUrl(baseUrl, override);
    const guard = token.checkpoint('web-style-fetch');
    if (!guard.ok) return guard;

    let payload: unknown;
    try {
      const response = await fetch(styleUrl);
      if (!response.ok) {
        return err(
          new MapEngineError('map/style-load-failed', '지도 스타일을 받아오지 못했습니다.', {
            context: { styleUrl, status: response.status },
          }),
        );
      }
      payload = await response.json();
    } catch (thrown) {
      return err(
        new MapEngineError('map/style-load-failed', '지도 스타일 요청이 실패했습니다.', {
          cause: thrown,
          context: { styleUrl },
        }),
      );
    }

    const afterFetch = token.checkpoint('web-style-compose');
    if (!afterFetch.ok) return afterFetch;

    if (!isStyleSpecification(payload)) {
      return err(
        new MapEngineError('map/style-load-failed', '지도 스타일 형식이 예상과 다릅니다.', {
          context: { styleUrl },
        }),
      );
    }

    try {
      const composed = composeMapStyle(payload, this.#options.styleMode, {
        terrain: this.#options.terrain === true,
        // 봉우리 라벨을 지면에서 띄우는 `symbol-height-offset` — 3D 지형을 켤 때만 뜻이 있다.
        terrain3d: this.#options.terrain === true && this.capabilities.terrain,
      });
      this.#logger.debug('지도 스타일 구성', {
        mode: composed.mode,
        recolored: composed.recolored,
        unmatched: composed.unmatched,
        terrain: composed.terrain,
      });
      // 개발용 강제 장애(C7) — 정상 빌드는 이 분기를 타지 않아 스타일이 바이트 단위로 같다.
      const style =
        override === undefined ? composed.style : overrideBaseMapOrigin(composed.style, override);
      /* maplibre-gl 이 물고 있는 `@maplibre/maplibre-gl-style-spec` 과 map-style 의
         것은 마이너 버전이 달라 이름이 같아도 별개 타입이다. 값은 같은 JSON 명세이므로
         경계에서 한 번만 바꿔 준다(`placement.ts` 머리말과 같은 사정). */
      return ok(style as unknown as StyleSpecification);
    } catch (thrown) {
      return err(
        new MapEngineError('map/layer-failed', '지도 스타일 구성에 실패했습니다.', {
          cause: thrown,
        }),
      );
    }
  }

  #createMap(style: StyleSpecification): Result<MapLibreMap> {
    try {
      // 지도 생성 전에 걸어야 한다 — 첫 Map 이 워커 풀을 만든다.
      if (this.#options.workerUrl !== undefined) setWorkerUrl(this.#options.workerUrl);
      const initialView = this.#options.initialView ?? INITIAL_VIEW;

      const map = new MapLibreMap({
        container: this.#options.container,
        style,
        center: toLngLatLike(this.#options.launchSite),
        zoom: initialView.zoom,
        pitch: initialView.pitch,
        bearing: initialView.bearing,
        maxPitch: initialView.maxPitch,
        // fill-extrusion 모서리 계단현상 제거. MapLibre 6 에서 최상위
        // `antialias` 가 `canvasContextAttributes` 아래로 옮겨졌다
        // (데모는 v5 문법을 쓴다).
        canvasContextAttributes: { antialias: true },
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right');

      /* 스타일이 모르는 아이콘 ID 는 레지스트리가 푼다(C5) — 시설 핀 ID(`facility/<type>`)는
         `map-style` 의 SVG 팩토리로 그 자리에서 굽고, 어느 팩토리도 모르는 ID(openfreemap 스타일이
         스프라이트에 없는 아이콘을 참조하는 경우)는 C4 부터의 투명 1px 폴백이다. MapLibre 6 은
         `styleimagemissing` 이벤트가 사후 통보로 바뀌어 v6 의 지정된 통로인
         `setMissingStyleImageResolver` 를 쓴다 — 스타일 로드 중에 불리므로 지도 생성 직후에 건다.
         festival 장면은 시설 소스가 비어 있어 시설 ID 를 요청하지 않는다(`/firework` 불변). */
      const icons = this.#resources.add(new MarkerIconRegistry(map, this.#logger));
      this.#resources.add(icons.register(facilityIconSvgById));

      this.#map = map;
      this.#camera = this.#resources.add(new CameraController(map, this.#logger));
      this.#pin = this.#resources.add(new SelectionPinController(map, this.#logger));
      this.#waterFlow = this.#resources.add(new WaterFlowController(map, this.#logger));
      this.#layers = MAP_LAYER_SETS.map((set) =>
        this.#resources.add(new FeatureLayerController(map, set, this.#emitter, this.#logger)),
      );
      return ok(map);
    } catch (thrown) {
      return err(
        new MapEngineError('map/initialization-failed', '지도를 생성하지 못했습니다.', {
          cause: thrown,
        }),
      );
    }
  }

  /** `style.load` 를 취소 가능한 await 로 바꾼다. */
  async #awaitStyle(map: MapLibreMap, token: CancellationToken): Promise<VoidResult> {
    if (map.isStyleLoaded()) return ok();

    let failure: MapEngineError | undefined;
    const onError = (event: MapLibreErrorEvent): void => {
      failure ??= new MapEngineError('map/style-load-failed', '스타일을 불러오지 못했습니다.', {
        cause: event.error,
      });
    };
    map.once('error', onError);

    const settled = await waitForEvent(
      'style-load',
      (resolve) => {
        map.once('style.load', resolve);
        return toDisposable(() => map.off('style.load', resolve));
      },
      token,
    );

    map.off('error', onError);
    if (failure !== undefined) return err(failure);
    return settled;
  }

  /**
   * 로드된 스타일 위에 앱 레이어를 얹는다.
   * 순서가 중요하다 — 투영 → 3D 지형(계곡) → 피처 레이어 셋(구간·시설·명당) → 불꽃.
   * 하늘·한국어 라벨·3D 건물·음영기복은 이미 스타일 객체에 들어 있다(`#loadStyle`).
   */
  #decorateStyle(map: MapLibreMap): VoidResult {
    try {
      /* openfreemap 스타일에는 projection 이 없어 mercator 로 초기화된다.
         그래서 생성자가 아니라 style.load 이후에 건다.
         'globe' 는 적응형 — 멀리서는 구체, 가까이 가면 메르카토르로 모핑. */
      map.setProjection({ type: this.#options.projection ?? 'globe' });
    } catch (thrown) {
      return err(
        new MapEngineError('map/layer-failed', '지도 투영 설정에 실패했습니다.', {
          cause: thrown,
        }),
      );
    }

    if (this.#options.terrain === true) {
      const terrain = this.#installTerrain(map);
      if (!terrain.ok) return terrain;
    }

    // 레이어 셋은 목록 순서대로 — 구간 선 위에 시설 점, 그 위에 명당.
    for (const layer of this.#layers) {
      const installed = layer.install();
      if (!installed.ok) return installed;
    }
    // 모드별 케이싱 색(V1 (c)) — 레이어 명세는 라이트 값이라 다크는 여기서 덧쓴다. 그늘은 아직 꺼짐.
    this.#applyValleyPaint(false);
    // 빈 곳 클릭은 모든 피처 히트 핸들러 **뒤에** 걸어야 한다 — 피처 핸들러가
    // `preventDefault()` 로 표시한 클릭을 여기서 걸러 낸다(데모와 동일).
    this.#wireBackgroundPress(map);

    return this.#installFireworks(map);
  }

  /**
   * 계곡 장면의 상태 의존 paint(V1) — 케이싱 색·그늘 대비를 `valleyPaintOverrides` 값 그대로
   * `setPaintProperty` 로 얹는다. 네이티브는 같은 함수의 결과를 `layerPaintOverrides` 로 게시한다.
   * festival 은 구간·그늘 소스가 비어 있고 음영 레이어가 없어 화면이 바뀌지 않는다(`/firework`
   * 다크 diff 0 이 PR 게이트). 같은 그늘 상태면 no-op.
   */
  #applyValleyPaint(shadeVisible: boolean): void {
    const map = this.#map;
    if (map === undefined || shadeVisible === this.#paintShadeVisible) return;
    this.#paintShadeVisible = shadeVisible;
    const overrides: PaintOverrides = valleyPaintOverrides(this.#options.styleMode, {
      shadeVisible,
    });
    for (const [layerId, paint] of Object.entries(overrides)) {
      // 음영 레이어는 계곡 장면에만 있다 — 없는 레이어는 건너뛴다.
      if (map.getLayer(layerId) === undefined) continue;
      for (const [property, value] of Object.entries(paint)) {
        try {
          // 속성 이름은 레이어 종류별 유니온이라 값 표에서 온 문자열을 좁혀 넘긴다.
          map.setPaintProperty(layerId, property as never, value as never);
        } catch (thrown) {
          this.#logger.debug('계곡 paint 덧쓰기를 건너뛴다', {
            layerId,
            property,
            reason: String(thrown),
          });
        }
      }
    }
    this.#logger.debug('계곡 paint 적용', { shadeVisible, layers: Object.keys(overrides) });
  }

  /**
   * 3D 지형 — 스타일에 들어 있는 DEM 소스(`#loadStyle`, C10a)로 지면을 들어 올린다.
   * 구간 선·시설 점·그늘 fill 은 추가 작업 없이 지형에 드레이프된다.
   *
   * **중심 고도 보정**: 프로그램 카메라 이동(`flyTo`/`easeTo`) 뒤 MapLibre 는 지형 중심
   * 고도를 갱신하지 않아 장면이 화면 위로 밀린다(스파이크에서 확인). 이동이 끝나면
   * (`moveend`) 그리고 DEM 타일이 늦게 도착해 값이 바뀌었을 때(`idle`) 지형에서 중심 고도를
   * 읽어 다시 넣는다. 1m 안쪽 차이는 건너뛴다 — 값이 맞을 때는 아무 일도 없어야 사용자
   * 제스처와 싸우지 않는다. 원시 m 이며 과장 배율과 무관하다(`setCenterElevation` 규약).
   */
  #installTerrain(map: MapLibreMap): VoidResult {
    try {
      map.setTerrain({ source: TERRAIN_DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
    } catch (thrown) {
      return err(
        new MapEngineError('map/layer-failed', '3D 지형을 켜지 못했습니다.', {
          cause: thrown,
          context: { source: TERRAIN_DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION },
        }),
      );
    }

    const syncCenterElevation = (): void => {
      if (map.getTerrain() === null) return;
      const elevation = map.queryTerrainElevation(map.getCenter());
      if (elevation === null) return;
      const drift = elevation - map.getCenterElevation();
      if (Math.abs(drift) <= CENTER_ELEVATION_TOLERANCE_M) return;
      map.setCenterElevation(elevation);
      this.#logger.debug('지형 중심 고도 보정', { elevation: Math.round(elevation), drift });
    };
    map.on('moveend', syncCenterElevation);
    map.on('idle', syncCenterElevation);
    this.#resources.add(
      toDisposable(() => {
        map.off('moveend', syncCenterElevation);
        map.off('idle', syncCenterElevation);
      }),
    );
    this.#logger.debug('3D 지형 켬', { exaggeration: TERRAIN_EXAGGERATION });
    return ok();
  }

  #installFireworks(map: MapLibreMap): VoidResult {
    try {
      const layer = new FireworkLayer({
        launchSite: this.#options.launchSite,
        logger: this.#logger,
        ...(this.#options.random === undefined ? {} : { random: this.#options.random }),
      });
      map.addLayer(layer);
      this.#fireworks = layer;
      this.#resources.add(
        toDisposable(() => {
          try {
            if (map.getLayer(layer.id) !== undefined) map.removeLayer(layer.id);
          } catch (thrown) {
            this.#logger.debug('불꽃 레이어 제거를 건너뛴다', { reason: String(thrown) });
          }
          layer.dispose();
        }),
      );
      return ok();
    } catch (thrown) {
      // 불꽃은 연출이다. 실패해도 지도는 살아 있어야 하므로 경고만 남긴다.
      this.#logger.warn('불꽃 레이어를 얹지 못했다', {
        reason: toAppError(thrown, '불꽃 레이어 추가 실패').message,
      });
      return ok();
    }
  }

  #wireBackgroundPress(map: MapLibreMap): void {
    const onBackgroundClick = (event: MapMouseEvent): void => {
      if (event.defaultPrevented) return;
      this.#emitter.emit('background-press', undefined);
    };
    map.on('click', onBackgroundClick);
    this.#resources.add(toDisposable(() => map.off('click', onBackgroundClick)));
  }

  #wireMapEvents(map: MapLibreMap): void {
    const onMove = (): void => {
      const pose = this.#camera?.getPose();
      if (pose?.ok === true) this.#emitter.emit('camera-change', pose.value);
    };
    map.on('move', onMove);
    this.#resources.add(toDisposable(() => map.off('move', onMove)));

    /* 렌더 루프에서 삼켜지는 오류를 밖으로 흘려보낸다. 데모 주석이 적어 둔
       `_updateRetainedTiles` 의 "Cannot read properties of undefined
       (reading 'key')" 경합이 대표적이다 — 화면·상태에는 영향이 없고
       업스트림 레이스지만, 조용히 사라지게 두지 않는다. */
    const onError = (event: MapLibreErrorEvent): void => {
      this.#emitter.emit(
        'recoverable-error',
        toAppError(event.error, '지도 렌더 중 오류가 발생했습니다.'),
      );
      // 베이스맵 헬스(C7) — 우리 베이스맵 리소스의 오류만 센다.
      if (isBaseMapFailure(event, this.#baseMapHosts)) this.#health.failure();
    };
    map.on('error', onError);
    this.#resources.add(toDisposable(() => map.off('error', onError)));

    /* 타일이 실제로 들어온 이벤트(`tile` 이 실린 `sourcedata`)만 성공이다 — 메타데이터 로드나
       GeoJSON `setData` 는 베이스맵이 살아 있다는 증거가 아니다. */
    const onSourceData = (event: MapSourceDataEvent): void => {
      if (event.dataType !== 'source' || event.tile === undefined) return;
      const url = sourceUrlOf(event.source);
      if (url !== null && isBaseMapUrl(url, this.#baseMapHosts)) this.#health.success();
    };
    map.on('sourcedata', onSourceData);
    this.#resources.add(toDisposable(() => map.off('sourcedata', onSourceData)));

    onMove();
  }

  #teardown(): void {
    this.#resources.clear();
    // 지도가 사라지면 헬스도 처음으로 — 다음 지도는 깨끗한 상태에서 잰다.
    this.#health.reset();
    const map = this.#map;
    this.#fireworks = undefined;
    this.#waterFlow = undefined;
    this.#paintShadeVisible = undefined;
    this.#layers = [];
    this.#pin = undefined;
    this.#camera = undefined;
    this.#map = undefined;
    if (map === undefined) return;
    try {
      map.remove();
    } catch (thrown) {
      this.#logger.debug('지도 제거 중 예외를 무시한다', { reason: String(thrown) });
    }
  }
}

/** 지형 중심 고도가 이만큼 안에서 어긋난 것은 보정하지 않는다 — 제스처 중 맞는 값과 싸우지 않게. */
const CENTER_ELEVATION_TOLERANCE_M = 1;

/**
 * 오류 이벤트가 베이스맵 실패인가(C7). maplibre 는 소스·타일 오류에 `sourceId`·`source`(명세)를
 * 실어 올리고, 요청 실패(`AJAXError`)에는 `url`·`status` 가 있다. 소스 명세의 URL 을 먼저 보고,
 * 없으면 요청 URL 을 본다. 표현식 오류처럼 URL 이 없는 것과 404(없는 타일·글리프 범위 — 서버는
 * 살아 있다)는 세지 않는다. 404 타일은 maplibre 가 이미 오류로 올리지 않지만 다른 요청은 올린다.
 */
function isBaseMapFailure(event: MapLibreErrorEvent, hosts: readonly string[]): boolean {
  const detail = event as {
    readonly error?: { readonly url?: unknown; readonly status?: unknown };
    readonly source?: unknown;
  };
  if (detail.error?.status === 404) return false;
  const url =
    sourceUrlOf(detail.source) ?? (typeof detail.error?.url === 'string' ? detail.error.url : null);
  return url !== null && isBaseMapUrl(url, hosts);
}

/** maplibre-gl 핸들러는 모두 `enable()`/`disable()` 을 갖는다. */
function setHandler(handler: { enable(): void; disable(): void }, enabled: boolean): void {
  if (enabled) handler.enable();
  else handler.disable();
}

function notReady(operation: string): MapEngineError {
  return new MapEngineError('map/not-initialized', '지도가 아직 준비되지 않았습니다.', {
    context: { operation },
  });
}
