/**
 * 화면 하나에 대응하는 세션 파사드.
 *
 * 표현 계층이 아는 것은 이 클래스와 `SessionStore` 스냅샷뿐이다. 어떤 지도
 * 엔진인지, 유즈케이스가 몇 개인지, 취소를 어떻게 다루는지는 전부 안쪽에
 * 갇혀 있다. 그래서 web 화면과 네이티브 화면이 같은 파사드를 쓴다.
 *
 * 장면(scene)에 대하여 — festival(`/firework`)과 valley(`/`)는 별도 파사드가
 * 아니라 **같은 세션의 매개변수**다(F1 결정 (b)). 카메라 큐·플립·제스처·엔진
 * 배선·시트 상태는 공유하고, 적재(`LoadSessionUseCase`)·선택 유즈케이스·티커만
 * 장면으로 갈린다. 다른 장면의 의도 메서드를 부르면 조용히 무시된다
 * (데이터가 없어 `not-loaded` 취소로 끝난다).
 *
 * 생애: `new` → `initialize(token)` → 사용 → `dispose()`.
 * `dispose()` 하나로 엔진·타이머·큐·구독이 모두 정리된다.
 */

import { cameraCommand } from '../domain/camera/CameraPose';
import { VALLEY_DETAIL_ZOOM } from '../domain/camera/CameraPresets';
import { DEFAULT_MAP_GESTURES } from '../domain/camera/MapGestures';
import { viewportCenterOffset } from '../domain/camera/ViewportCameraOffset';
import type { SpotId } from '../domain/festival/SpotId';
import { reportTickerMessages, VALLEY_TICKER_FALLBACK_MESSAGES } from '../domain/report/ReportFeed';
import { lookupFacility, lookupSegment } from '../domain/valley/catalog';
import type { FilterChipKey } from '../domain/valley/filterChips';
import type { FacilityId, SegmentId } from '../domain/valley/ids';
import type { ShadeHourIndex } from '../domain/valley/Segment';
import { type CancellationToken, CancellationTokenSource } from '../shared/async/cancellation';
import type { AsyncInitializable, LifecycleState } from '../shared/async/lifecycle';
import { SerialTaskQueue } from '../shared/async/SerialTaskQueue';
import { DisposableStore } from '../shared/disposable';
import { type AppError, isCancelled } from '../shared/errors';
import type { Logger } from '../shared/logger/Logger';
import { ok, type VoidResult } from '../shared/result';
import { MapContentComposer } from './MapContentComposer';
import { NewsTickerController } from './NewsTickerController';
import type { ApiPort } from './ports/ApiPort';
import type { LandParcel } from './ports/LandOwnership';
import type { MapCapabilities } from './ports/MapCapabilities';
import type { MapFeatureRef } from './ports/MapContent';
import type { MapEnginePort } from './ports/MapEnginePort';
import type { StoragePort } from './ports/StoragePort';
import { revealSheet } from './revealSheet';
import { SheetFlipCoordinator } from './SheetFlipCoordinator';
import {
  type AppStateSeed,
  initialAppState,
  mapContentFilterOf,
  type NavTab,
  type Scene,
  type SpotLayout,
  selectedFeatureKind,
  type ThemeMode,
} from './state/AppState';
import { parseApiAlerts } from './state/parseApiAlert';
import { parseApiReports } from './state/parseApiReport';
import { SessionStore } from './state/SessionStore';
import type { SheetSnap } from './state/SheetSnap';
import type { ViewportInsets } from './state/ViewportInsets';
import { CameraControlUseCase } from './usecases/CameraControlUseCase';
import { ClearSelectionUseCase } from './usecases/ClearSelectionUseCase';
import { CloseReportUseCase } from './usecases/CloseReportUseCase';
import { CloseSettingsUseCase } from './usecases/CloseSettingsUseCase';
import { LoadSessionUseCase, type SceneSource } from './usecases/LoadSessionUseCase';
import { OpenSettingsUseCase } from './usecases/OpenSettingsUseCase';
import { SelectFacilityUseCase } from './usecases/SelectFacilityUseCase';
import { SelectReportUseCase } from './usecases/SelectReportUseCase';
import { SelectSegmentUseCase } from './usecases/SelectSegmentUseCase';
import { SelectSpotUseCase } from './usecases/SelectSpotUseCase';
import { SetShadeHourUseCase } from './usecases/SetShadeHourUseCase';
import { SetSpotLayoutUseCase } from './usecases/SetSpotLayoutUseCase';
import { SetThemeModeUseCase } from './usecases/SetThemeModeUseCase';
import { ToggleFilterChipUseCase } from './usecases/ToggleFilterChipUseCase';
import { ToggleFireworksUseCase } from './usecases/ToggleFireworksUseCase';
import { ToggleShadeUseCase } from './usecases/ToggleShadeUseCase';
import { TourSpotsUseCase } from './usecases/TourSpotsUseCase';
import { ValleyTickerController } from './ValleyTickerController';
import { WaterFlowCoordinator } from './WaterFlowCoordinator';

/** `/api/reports` 한 번에 가져오는 최대 개수 — 피드 3건과 24시간 티커 창을 함께 감당한다(서버 상한 50). */
const REPORT_QUERY_LIMIT = 50;

/**
 * 세션 의존. `scene` 이 어느 저장소를 요구하는지는 `SceneSource` 유니온이 정한다 —
 *   `{ scene: 'festival', repository }` 또는 `{ scene: 'valley', valleyRepository }`.
 */
export type MapSessionDeps = SceneSource & {
  readonly engine: MapEnginePort;
  readonly storage: StoragePort;
  readonly logger: Logger;
  /** 현재 시각. 시간 트랙의 기본 시각(F4 결정 (a))에 쓴다. 기본은 실제 시계, 테스트는 고정. */
  readonly now?: () => Date;
  /**
   * 앱이 이미 알고 있는 상태(C9). 테마가 바뀌면 표현 계층이 세션을 다시 만드는데, 새 세션이
   * 현재 테마 선택과 열려 있던 설정 면을 이어받아야 화면이 튀지 않는다. `AppStateSeed` 참고.
   */
  readonly seed?: AppStateSeed;
  /**
   * 서버 API(F3b). valley 장면에서만 쓴다 — 있으면 상류 강우 경보를 적재하고 SSE `alert`
   * 채널을 구독한다. 없으면(festival, 또는 서버 미배선) 경보는 계속 `null`(조용히 평시).
   */
  readonly api?: ApiPort;
  /** Field mode leaves selection only through the explicit exit action. */
  readonly preserveSelection?: boolean;
};

export class MapSession implements AsyncInitializable {
  readonly store: SessionStore;
  readonly scene: Scene;

  readonly #engine: MapEnginePort;
  readonly #preserveSelection: boolean;
  readonly #composer = new MapContentComposer();
  readonly #api: ApiPort | undefined;
  readonly #logger: Logger;
  readonly #lifetime = new CancellationTokenSource();
  readonly #subscriptions: DisposableStore;
  readonly #cameraQueue: SerialTaskQueue;
  readonly #flip: SheetFlipCoordinator;
  readonly #ticker: NewsTickerController;
  readonly #valleyTicker: ValleyTickerController;
  readonly #waterFlow: WaterFlowCoordinator;
  readonly #now: () => Date;

  readonly #loadSession: LoadSessionUseCase;
  readonly #selectSpot: SelectSpotUseCase;
  readonly #selectSegment: SelectSegmentUseCase;
  readonly #selectFacility: SelectFacilityUseCase;
  readonly #selectReport: SelectReportUseCase;
  readonly #clearSelection: ClearSelectionUseCase;
  readonly #closeReport: CloseReportUseCase;
  readonly #tourSpots: TourSpotsUseCase;
  readonly #cameraControl: CameraControlUseCase;
  readonly #toggleFireworks: ToggleFireworksUseCase;
  readonly #setSpotLayout: SetSpotLayoutUseCase;
  readonly #toggleShade: ToggleShadeUseCase;
  readonly #setShadeHour: SetShadeHourUseCase;
  readonly #toggleFilterChip: ToggleFilterChipUseCase;
  readonly #setThemeMode: SetThemeModeUseCase;
  readonly #openSettings: OpenSettingsUseCase;
  readonly #closeSettings: CloseSettingsUseCase;

  #disposed = false;

  constructor(deps: MapSessionDeps) {
    const logger = deps.logger.child('session');
    this.#engine = deps.engine;
    this.#preserveSelection = deps.preserveSelection ?? false;
    this.#api = deps.api;
    this.#logger = logger;
    this.scene = deps.scene;
    this.#now = deps.now ?? (() => new Date());
    this.store = new SessionStore(logger, initialAppState(deps.scene, this.#now, deps.seed));
    this.#subscriptions = new DisposableStore(logger);

    this.#cameraQueue = new SerialTaskQueue({
      name: 'camera',
      logger,
      parentToken: this.#lifetime.token,
    });
    this.#flip = new SheetFlipCoordinator({ store: this.store, logger });
    this.#ticker = new NewsTickerController({ store: this.store, logger });
    // 계곡 티커(F5c) — festival 것의 클론, 문구는 제보 피드에서 매 회전마다 다시 읽는다.
    this.#valleyTicker = new ValleyTickerController({
      store: this.store,
      logger,
      getMessages: () =>
        reportTickerMessages(
          this.store.state.reports ?? [],
          this.#now(),
          VALLEY_TICKER_FALLBACK_MESSAGES,
        ),
    });
    // 물줄기 흐름(C10c) — 상태(장면·ready·시트·전면)를 보고 엔진 애니메이션을 켜고 끈다.
    this.#waterFlow = new WaterFlowCoordinator({ engine: deps.engine, store: this.store, logger });

    // 계곡 지도 내용의 바탕 — 적재·그늘·선택·필터 유즈케이스가 같은 인스턴스를 본다.
    const composer = this.#composer;
    const shared = { engine: deps.engine, store: this.store, logger } as const;
    // N1 — 선택 유즈케이스도 composer 를 받는다(필터가 걸려 있으면 핀 고정 계곡이
    // 바뀐 뒤 지도를 다시 그려야 한다, `refreshFilteredMapContent`).
    const selecting = {
      ...shared,
      flip: this.#flip,
      cameraQueue: this.#cameraQueue,
      composer,
    } as const;

    this.#loadSession = new LoadSessionUseCase({
      ...shared,
      source: deps,
      storage: deps.storage,
      cameraQueue: this.#cameraQueue,
      composer,
    });
    this.#selectSpot = new SelectSpotUseCase(selecting);
    this.#selectSegment = new SelectSegmentUseCase(selecting);
    this.#selectFacility = new SelectFacilityUseCase(selecting);
    this.#selectReport = new SelectReportUseCase({ store: this.store, flip: this.#flip });
    this.#clearSelection = new ClearSelectionUseCase(selecting);
    this.#closeReport = new CloseReportUseCase({ store: this.store, flip: this.#flip });
    this.#tourSpots = new TourSpotsUseCase({
      engine: deps.engine,
      store: this.store,
      cameraQueue: this.#cameraQueue,
    });
    this.#cameraControl = new CameraControlUseCase({
      ...shared,
      cameraQueue: this.#cameraQueue,
    });
    this.#toggleFireworks = new ToggleFireworksUseCase(shared);
    this.#setSpotLayout = new SetSpotLayoutUseCase({
      storage: deps.storage,
      store: this.store,
      logger,
    });
    this.#toggleShade = new ToggleShadeUseCase({ ...shared, storage: deps.storage, composer });
    this.#setShadeHour = new SetShadeHourUseCase({ ...shared, composer });
    this.#toggleFilterChip = new ToggleFilterChipUseCase({ ...shared, composer });
    this.#setThemeMode = new SetThemeModeUseCase({
      storage: deps.storage,
      store: this.store,
      logger,
    });
    this.#openSettings = new OpenSettingsUseCase({
      store: this.store,
      flip: this.#flip,
      clearSelection: this.#clearSelection,
      logger,
    });
    this.#closeSettings = new CloseSettingsUseCase({ store: this.store, flip: this.#flip });

    this.#subscriptions.add(this.#cameraQueue);
    this.#subscriptions.add(this.#flip);
    this.#subscriptions.add(this.#ticker);
    this.#subscriptions.add(this.#valleyTicker);
    this.#subscriptions.add(this.#waterFlow);
  }

  get state(): LifecycleState {
    return this.store.state.status;
  }

  get capabilities(): MapCapabilities {
    return this.#engine.capabilities;
  }

  async initialize(token: CancellationToken): Promise<VoidResult> {
    if (this.#disposed) return ok();

    this.#wireEngineEvents();

    const engineReady = await this.#engine.initialize(token);
    if (!engineReady.ok) {
      this.store.setStatus('failed');
      this.store.setError(engineReady.error);
      this.#report('지도 엔진 초기화 실패', engineReady.error);
      return engineReady;
    }

    /* 제스처 정책을 여기서 한 번 내려보낸다 — web·android·ios 가 같은 값을
       받는 유일한 지점이다. 실패해도 지도는 살아 있어야 하므로 경고만 남긴다
       (조작이 SDK 기본값으로 남을 뿐이다). */
    const gestures = this.#engine.setGestures(DEFAULT_MAP_GESTURES);
    if (!gestures.ok) {
      this.#logger.warn('제스처 정책을 적용하지 못했다', { code: gestures.error.code });
    }

    const loaded = await this.#loadSession.execute(token);
    if (!loaded.ok) {
      // 호출부가 결과를 버려도 실패가 사라지지 않도록 여기서 남긴다.
      // 화면은 뜨지만 명당이 하나도 없는 상태가 조용히 지나가지 않게 하는 방어.
      this.#report('세션 데이터 준비 실패', loaded.error);
      return loaded;
    }

    // 소식 티커는 축제 연출이다. 계곡 티커(F5c)는 별도 컨트롤러(`ValleyTickerController`) —
    // 제보 피드가 아직 없어도(서버 미배선) 기본 문구로 돈다(빈 티커를 두지 않는다).
    if (this.scene === 'festival') this.#ticker.start();
    if (this.scene === 'valley') this.#valleyTicker.start();
    if (this.scene === 'valley' && this.#api) {
      this.#wireAlerts(this.#api);
      this.#wireReports(this.#api);
    }
    return ok();
  }

  // ── 사용자 의도 ───────────────────────────────────────────────
  //  표현 계층은 아래 메서드만 부른다. 반환값을 기다리지 않아도 되고,
  //  실패는 내부에서 로깅된다. 테스트는 await 해서 결과를 검사한다.

  // festival
  selectSpot(spotId: SpotId): Promise<VoidResult> {
    return this.#guard('select-spot', (token) => this.#selectSpot.execute(spotId, token));
  }

  // valley
  selectSegment(segmentId: SegmentId): Promise<VoidResult> {
    return this.#guard('select-segment', (token) => this.#selectSegment.execute(segmentId, token));
  }

  selectFacility(facilityId: FacilityId): Promise<VoidResult> {
    return this.#guard('select-facility', (token) =>
      this.#selectFacility.execute(facilityId, token),
    );
  }

  /** 제보 상세 열기(F5c) — 목록 면 "실시간 정보" 카드 탭. */
  selectReport(reportId: string): Promise<VoidResult> {
    return this.#guard('select-report', (token) => this.#selectReport.execute(reportId, token));
  }

  /** 제보 상세 닫기(F5c) — 상세 면 × 버튼. */
  closeReport(): Promise<VoidResult> {
    return this.#guard('close-report', (token) => this.#closeReport.execute(token));
  }

  /** 계곡 전체 보기로. valley 에서 "발사 지점으로" 버튼 자리에 놓인다. */
  recenterValley(): Promise<VoidResult> {
    return this.#guard('recenter-valley', () => this.#cameraControl.recenterValley());
  }

  /** Reposition the selected point inside the measured visible map area. */
  recenterSelection(): Promise<VoidResult> {
    const state = this.store.state;
    const valleys = state.valleys ?? [];
    const facility = state.selectedFacilityId
      ? lookupFacility(valleys, state.selectedFacilityId)
      : null;
    const segment = state.selectedSegmentId
      ? lookupSegment(valleys, state.selectedSegmentId)
      : null;
    const center = facility?.ok
      ? facility.value.facility.position
      : segment?.ok
        ? segment.value.segment.midpoint()
        : null;
    if (!center) return Promise.resolve(ok());
    return this.#guard('recenter-selection', () =>
      this.#cameraQueue.run(
        'camera:visible-selection',
        (token) =>
          this.#engine.moveCamera(
            cameraCommand(
              {
                center,
                // 상세 줌보다 멀리 있으면 상세 줌까지만 당긴다 — 15.5 로 박혀 있던 값이
                // `focusSegment`(14.2) 직후 다시 당겨 시설 핀·봉우리를 프레임 밖으로 밀었다(2026-09-23).
                zoom: Math.max(VALLEY_DETAIL_ZOOM, state.camera?.zoom ?? VALLEY_DETAIL_ZOOM),
                offset: viewportCenterOffset(state.viewportInsets),
              },
              { motion: 'ease', durationMs: 240 },
            ),
            token,
          ),
        'preempt',
      ),
    );
  }

  /** 조회한 토지 경계를 현재 지도에 반영한다. 저장하지 않는다. */
  setLandParcels(parcels: readonly LandParcel[]): void {
    this.#composer.landParcels = parcels;
    const state = this.store.state;
    const result = this.#engine.renderContent(
      this.#composer.content(state.shadeVisible, state.shadeHourIndex, mapContentFilterOf(state)),
    );
    if (!result.ok) this.#logger.warn('토지 경계 표시 실패', result.error.toLogPayload());
  }

  /** 그늘 보기 on/off. festival 장면에서는 조용히 무시된다(`not-loaded` 취소). */
  toggleShade(): Promise<VoidResult> {
    return this.#guard('toggle-shade', (token) => this.#toggleShade.execute(token));
  }

  /**
   * 조건 필터 칩 토글(N1, 결정 (c)). 동기다 — 저장하지 않고(세션 상태), 지도에 먼저
   * 반영한 뒤 상태를 바꾼다(`ToggleFilterChipUseCase`).
   */
  toggleFilterChip(key: FilterChipKey): VoidResult {
    if (this.#disposed) return ok();
    const result = this.#toggleFilterChip.execute(key);
    if (!result.ok && !isCancelled(result.error)) {
      this.#logger.error("'toggle-filter-chip' 실패", result.error);
      this.store.setError(result.error);
    }
    return result;
  }

  /** 시간 트랙의 시각. 동기다 — 저장하지 않고, 그늘이 켜져 있을 때만 지도를 다시 그린다. */
  setShadeHour(index: ShadeHourIndex): VoidResult {
    if (this.#disposed) return ok();
    const result = this.#setShadeHour.execute(index);
    if (!result.ok && !isCancelled(result.error)) {
      this.#logger.error("'set-shade-hour' 실패", result.error);
      this.store.setError(result.error);
    }
    return result;
  }

  // 공통
  clearSelection(): Promise<VoidResult> {
    return this.#guard('clear-selection', (token) => this.#clearSelection.execute(token));
  }

  startTour(): Promise<VoidResult> {
    return this.#guard('tour-spots', (token) => this.#tourSpots.execute(token));
  }

  alignNorth(): Promise<VoidResult> {
    return this.#guard('align-north', () => this.#cameraControl.alignNorth());
  }

  recenterLaunch(): Promise<VoidResult> {
    return this.#guard('recenter-launch', () => this.#cameraControl.recenterLaunch());
  }

  togglePitch(): Promise<VoidResult> {
    return this.#guard('toggle-pitch', () => this.#cameraControl.togglePitch());
  }

  zoomIn(): Promise<VoidResult> {
    return this.#guard('zoom-in', () => this.#cameraControl.zoomIn());
  }

  zoomOut(): Promise<VoidResult> {
    return this.#guard('zoom-out', () => this.#cameraControl.zoomOut());
  }

  toggleGlobe(): Promise<VoidResult> {
    return this.#guard('toggle-globe', () => this.#cameraControl.toggleGlobe());
  }

  inspectNearby(): Promise<VoidResult> {
    return this.#guard('inspect-nearby', () => this.#cameraControl.inspectNearby());
  }

  toggleFireworks(): VoidResult {
    return this.#toggleFireworks.execute();
  }

  setSpotLayout(layout: SpotLayout): Promise<VoidResult> {
    return this.#guard('set-spot-layout', (token) => this.#setSpotLayout.execute(layout, token));
  }

  /** 손잡이 탭(C8) — 다음 스냅으로 순환한다. */
  cycleSheetSnap(): void {
    this.store.cycleSheetSnap();
  }

  /** 손잡이 드래그를 놓았을 때(C8) 커밋할 스냅. */
  setSheetSnap(snap: SheetSnap): void {
    this.store.setSheetSnap(snap);
  }

  /**
   * 뷰포트 인셋(C8) — 표현 계층이 창 크기·안전 영역·지금 스냅을 재서 채운다. 카메라를
   * 이 값으로 옮기는 것은 이 메서드의 일이 아니다(C6, 결정 (f)).
   */
  setViewportInsets(insets: ViewportInsets): void {
    if (this.#disposed) return;
    this.store.setViewportInsets(insets);
  }

  /**
   * 내비 탭. 설정 탭은 설정 면을 열고, 설정 면이 열린 채 다른 탭을 누르면 닫으면서 그 탭으로
   * 간다(C9). 나머지 탭은 데모처럼 표시만 바꾼다.
   */
  setNavTab(tab: NavTab): void {
    if (this.#disposed) return;
    if (tab === 'settings') {
      void this.openSettings();
      return;
    }
    if (this.store.state.sheetFace === 'settings') {
      void this.#guard('close-settings', (token) => this.#closeSettings.execute(token, tab));
      return;
    }
    this.store.setNavTab(tab);
  }

  // 설정 (C9)
  /** 설정 면 열기. 상세가 열려 있으면 선택을 해제하며 곧장 설정 면으로. */
  openSettings(): Promise<VoidResult> {
    return this.#guard('open-settings', (token) => this.#openSettings.execute(token));
  }

  /** 설정 면 닫기 → 목록 면 + 홈 탭. 설정 면이 아니면 조용히 무시된다. */
  closeSettings(): Promise<VoidResult> {
    return this.#guard('close-settings', (token) => this.#closeSettings.execute(token));
  }

  /**
   * 테마 선택. 저장 뒤 상태가 바뀌고, 표현 계층은 그 변화를 보고 팔레트와 지도 스타일을
   * 바꾼다(지도는 세션 재생성 — 결정 (d)).
   */
  setThemeMode(mode: ThemeMode): Promise<VoidResult> {
    return this.#guard('set-theme-mode', (token) => this.#setThemeMode.execute(mode, token));
  }

  /**
   * 베이스맵 재시도(C7) — 장애 배너의 "다시 시도". 엔진이 베이스맵 소스만 다시 불러오고
   * 헬스를 처음으로 돌린다. 지도가 아직 없으면(`not-initialized`) 실패로 남지만 상태 오류로
   * 올리지는 않는다 — 스타일 실패 화면의 재시도는 세션 재생성(표현 계층)이 맡는다.
   */
  retryBaseMap(): VoidResult {
    if (this.#disposed) return ok();
    const result = this.#engine.retryBaseMap();
    if (!result.ok) this.#logger.warn('베이스맵 재시도 실패', result.error.toLogPayload());
    else this.#logger.info('베이스맵 소스 재시도');
    return result;
  }

  /** 앱 전면/배경. 표현 계층이 RN `AppState` 변화마다 부른다 — 배경에서는 흐름 애니메이션이 멈춘다. */
  setAppActive(active: boolean): void {
    if (this.#disposed) return;
    this.store.setAppActive(active);
  }

  /**
   * 검색어(SR1). 결과 조립(`searchCatalog`)과 선택은 표현 계층이 한다 — 선택하면 빈
   * 문자열로 다시 부른다(결정 5, "선택하면 검색어를 지운다").
   *
   * 검색어가 **생기면** 결과가 보이는 자리까지 시트를 데려온다(사용자 보고 2026-09-08
   * "긴고랑 검색했을 때 정보가 안 나옴"). 두 가지가 결과를 가리고 있었다.
   *   · 시트가 `peek` 이면 결과가 화면 아래에 그려진다 → `revealSheet`.
   *   · 결과는 **목록 면**에만 그려진다. 상세·설정 면이 열려 있으면 그 면이 계속 보여
   *     검색이 아무 일도 하지 않은 것처럼 보인다 → 목록 면으로 되돌린다.
   * 되돌리기는 이미 있는 유즈케이스를 쓴다(선택이 있으면 `clearSelection`, 설정 면이면
   * `closeSettings`). 첫 글자에서 한 번 일어나고, 그 뒤 타이핑은 이미 목록이라 무동작이다.
   */
  setSearchQuery(query: string): void {
    if (this.#disposed) return;
    this.store.setSearchQuery(query);
    if (query.length === 0) return;

    revealSheet(this.store);

    const face = this.store.state.sheetFace;
    if (face === 'detail') {
      void this.#guard('clear-selection', (token) => this.#clearSelection.execute(token));
    } else if (face === 'settings') {
      void this.#guard('close-settings', (token) => this.#closeSettings.execute(token));
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#lifetime.cancel('session-disposed');
    this.#subscriptions.dispose();
    this.#engine.dispose();
    this.store.setStatus('disposed');
    this.store.dispose();
    this.#lifetime.dispose();
  }

  /** 취소는 정상 흐름이므로 걸러 내고, 진짜 실패만 기록한다. */
  #report(message: string, error: AppError): void {
    if (isCancelled(error)) {
      this.#logger.debug(`${message} — 취소됨`, { code: error.code });
      return;
    }
    this.#logger.error(message, error);
  }

  #wireEngineEvents(): void {
    const events = this.#engine.events;
    this.#subscriptions.add(events.on('camera-change', (pose) => this.store.setCamera(pose)));
    this.#subscriptions.add(
      events.on('feature-press', (feature) => void this.#selectFeature(feature)),
    );
    this.#subscriptions.add(
      events.on('background-press', () => {
        if (this.#preserveSelection) return;
        if (selectedFeatureKind(this.store.state) === null) return;
        void this.clearSelection();
      }),
    );
    this.#subscriptions.add(
      events.on('recoverable-error', (error) => {
        // 데모 주석의 `_updateRetainedTiles` 경합처럼 렌더 루프에서 삼켜지는
        // 오류들. 화면에는 영향이 없지만 조용히 사라지게 두지 않는다.
        this.#logger.warn('지도 엔진의 복구 가능한 오류', error.toLogPayload());
      }),
    );
    this.#subscriptions.add(
      events.on('basemap-health', (health) => {
        // 판정은 어댑터의 모니터가 끝냈다. 여기서는 상태로 올리고 전이만 기록한다(C7).
        if (health.outage !== this.store.state.baseMapHealth.outage) {
          this.#logger.warn(health.outage ? '베이스맵 장애 판정' : '베이스맵 회복', {
            failures: health.failures,
          });
        }
        this.store.setBaseMapHealth(health);
      }),
    );
  }

  /**
   * 상류 강우 경보(F3b) — 최초 1회 적재 + SSE `alert` 채널 구독. 갱신마다 REST 를 다시
   * 부른다(payload 가 얇아 그게 더 단순하다 — hydro·aws 채널과 같은 규약). 구독은
   * `#subscriptions` 에 실려 `dispose()` 로 정리된다.
   */
  #wireAlerts(api: ApiPort): void {
    const refresh = async (): Promise<void> => {
      const result = await api.alerts();
      if (!result.ok) {
        this.#logger.warn('경보 조회 실패', result.error.toLogPayload());
        return;
      }
      this.store.setAlerts(parseApiAlerts(result.value));
    };
    void refresh();
    this.#subscriptions.add(api.subscribeEvents(['alert'], () => void refresh()));
  }

  /**
   * 제보 피드(F5c) — 최초 1회 적재 + SSE `report` 채널 구독. 계곡별로 나누지 않고 서버
   * 전체를 한 번에 받는다 — "실시간 정보" 섹션과 계곡 티커 둘 다 전체 계곡을 대상으로
   * 하기 때문이다(결정 (f)(g)). 새 제보가 오면 다시 REST 를 부른다 — payload 가 얇아
   * `#wireAlerts` 와 같은 규약이다.
   */
  #wireReports(api: ApiPort): void {
    const refresh = async (): Promise<void> => {
      const result = await api.reports({ limit: REPORT_QUERY_LIMIT });
      if (!result.ok) {
        this.#logger.warn('제보 조회 실패', result.error.toLogPayload());
        return;
      }
      this.store.setReports(parseApiReports(result.value.reports));
    };
    void refresh();
    this.#subscriptions.add(api.subscribeEvents(['report'], () => void refresh()));
  }

  /**
   * 지도 히트를 종류별 선택으로. 다른 장면의 피처(festival 에서 구간 등)는
   * 유즈케이스가 `not-loaded` 로 조용히 거절한다 — 여기서 장면을 다시 검사하지 않는다.
   */
  #selectFeature(feature: MapFeatureRef): Promise<VoidResult> {
    switch (feature.kind) {
      case 'spot':
        return this.selectSpot(feature.id);
      case 'segment':
        return this.selectSegment(feature.id);
      case 'facility':
        return this.selectFacility(feature.id);
    }
  }

  /** 세션 생애 토큰을 물려 주고, 취소가 아닌 실패만 상태에 남긴다. */
  async #guard(
    operation: string,
    run: (token: CancellationToken) => Promise<VoidResult>,
  ): Promise<VoidResult> {
    if (this.#disposed) return ok();
    const result = await run(this.#lifetime.token);
    if (!result.ok && !isCancelled(result.error)) {
      this.#logger.error(`'${operation}' 실패`, result.error);
      this.store.setError(result.error);
    }
    return result;
  }
}
