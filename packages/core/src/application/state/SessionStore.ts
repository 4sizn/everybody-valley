/**
 * 상태 저장소 — 상태를 바꾸는 유일한 문.
 *
 * 유즈케이스는 필드를 직접 쓰지 않고 의도 단위 메서드를 부른다. 덕분에
 * "상세를 열면 티커가 숨고 내비 탭이 명당으로 간다" 같은 불변식이 한 곳에
 * 모인다(데모에서는 `openSpot` 안에 흩어져 있다).
 */

import type { BaseMapHealth } from '../../domain/basemap/BaseMapHealth';
import type { CameraPose } from '../../domain/camera/CameraPose';
import type { ProjectionMode } from '../../domain/camera/ProjectionMode';
import type { Festival } from '../../domain/festival/Festival';
import type { SpotId } from '../../domain/festival/SpotId';
import type { Report } from '../../domain/report/Report';
import type { FilterChipKey } from '../../domain/valley/filterChips';
import type { FacilityId, SegmentId, ValleyId } from '../../domain/valley/ids';
import type { ShadeHourIndex } from '../../domain/valley/Segment';
import type { ValleyDataset } from '../../domain/valley/ValleyDataset';
import type { LifecycleState } from '../../shared/async/lifecycle';
import type { AppError } from '../../shared/errors';
import { ObservableStore } from '../../shared/events/ObservableStore';
import type { Logger } from '../../shared/logger/Logger';
import {
  type AppState,
  type FlipPhase,
  INITIAL_APP_STATE,
  type NavTab,
  type SheetFace,
  type SpotLayout,
  type ThemeMode,
} from './AppState';
import { nextSheetSnap, type SheetSnap } from './SheetSnap';
import type { ValleyAlertState } from './ValleyAlertState';
import type { ViewportInsets } from './ViewportInsets';

export class SessionStore extends ObservableStore<AppState> {
  constructor(logger?: Logger, initial: AppState = INITIAL_APP_STATE) {
    super(initial, logger);
  }

  get state(): AppState {
    return this.getSnapshot();
  }

  setStatus(status: LifecycleState): void {
    this.patch({ status });
  }

  setFestival(festival: Festival): void {
    this.patch({ festival });
  }

  /** 계곡 데이터셋 적재. 계곡 배열·머리말·그늘을 한 번에 — 한 저장소에서 함께 온다. */
  setValleys(dataset: ValleyDataset): void {
    this.patch({
      valleys: dataset.valleys,
      valleyMetadata: dataset.metadata,
      valleyShade: dataset.shade,
    });
  }

  setShadeVisible(shadeVisible: boolean): void {
    this.patch({ shadeVisible });
  }

  setShadeHour(shadeHourIndex: ShadeHourIndex): void {
    this.patch({ shadeHourIndex });
  }

  setCamera(camera: CameraPose): void {
    this.update((current) => {
      const previous = current.camera;
      if (
        previous !== null &&
        previous.zoom === camera.zoom &&
        previous.pitch === camera.pitch &&
        previous.bearing === camera.bearing &&
        previous.center.equals(camera.center)
      ) {
        return current;
      }
      return { ...current, camera };
    });
  }

  /** 명당 상세를 열 때의 상태 묶음 — 티커 숨김·내비 탭까지 한 번에 바꾼다. */
  beginSelection(spotId: SpotId): void {
    this.patch({
      selectedSpotId: spotId,
      selectedSegmentId: null,
      selectedFacilityId: null,
      selectedReportId: null,
      navTab: 'spots',
      tickerVisible: false,
    });
  }

  /** 구간 상세를 열 때. 명당 선택과 같은 셸 효과(내비 탭·티커) — 두 장면이 같은 시트를 쓴다. */
  beginSegmentSelection(segmentId: SegmentId): void {
    this.patch({
      selectedSegmentId: segmentId,
      selectedSpotId: null,
      selectedFacilityId: null,
      selectedReportId: null,
      navTab: 'spots',
      tickerVisible: false,
      valleyTickerVisible: false,
    });
  }

  /**
   * 시설 선택 — 핀과 미니 행뿐이라 상세 면을 열지 않고 내비 탭도 그대로 둔다.
   * 다른 선택은 지운다: 지도 선택(`MapSelection`)은 하나뿐이고 상태도 그것과 같아야 한다.
   */
  beginFacilitySelection(facilityId: FacilityId): void {
    this.patch({
      selectedFacilityId: facilityId,
      selectedSpotId: null,
      selectedSegmentId: null,
      selectedReportId: null,
    });
  }

  /**
   * 제보 상세를 열 때(F5c, 화면 결정 (e)) — 구간 상세와 같은 플립이지만 지도 선택과는
   * 무관하다(결정 (j), 지도에 제보를 그리지 않는다). 내비 탭은 건드리지 않는다 — 목록 면
   * 상단 "실시간 정보" 카드를 누른 자리(대개 홈 탭)로 되돌아와야 하기 때문이다.
   */
  beginReportSelection(reportId: string): void {
    this.patch({
      selectedReportId: reportId,
      selectedSpotId: null,
      selectedSegmentId: null,
      selectedFacilityId: null,
      valleyTickerVisible: false,
    });
  }

  /**
   * 어떤 종류든 선택 해제. 셸 상태(내비 탭·티커)도 되돌린다. 기본 복귀 탭은 홈이고,
   * 상세에서 곧장 설정 면으로 갈 때(C9)는 설정 탭이 켜진 채 해제된다.
   */
  endSelection(navTab: NavTab = 'home'): void {
    this.patch({
      selectedSpotId: null,
      selectedSegmentId: null,
      selectedFacilityId: null,
      selectedReportId: null,
      navTab,
      tickerVisible: true,
      valleyTickerVisible: true,
    });
  }

  /** 제보 상세 닫기(F5c) — `endSelection` 의 제보판. 내비 탭은 그대로 둔다(`beginReportSelection` 참고). */
  endReportSelection(): void {
    this.patch({ selectedReportId: null, valleyTickerVisible: true });
  }

  setSheetFace(sheetFace: SheetFace): void {
    this.patch({ sheetFace });
  }

  setFlipPhase(flipPhase: FlipPhase): void {
    this.patch({ flipPhase });
  }

  /** 손잡이 탭(C8, 결정 (e) 해석 1) — 다음 칸으로 순환한다. `peek → half → full → peek`. */
  cycleSheetSnap(): void {
    this.update((current) => ({ ...current, sheetSnap: nextSheetSnap(current.sheetSnap) }));
  }

  /** 손잡이 드래그 커밋, 또는 다른 유즈케이스가 스냅을 직접 정할 때(예: 설정 열기). */
  setSheetSnap(sheetSnap: SheetSnap): void {
    this.patch({ sheetSnap });
  }

  /** 표현 계층이 창 크기·안전 영역·지금 스냅에서 잰 값(C8). 카메라는 이 값을 쓰지 않는다(C6). */
  setViewportInsets(viewportInsets: ViewportInsets): void {
    this.patch({ viewportInsets });
  }

  setSpotLayout(spotLayout: SpotLayout): void {
    this.patch({ spotLayout });
  }

  setAppActive(appActive: boolean): void {
    this.patch({ appActive });
  }

  setFireworksEnabled(fireworksEnabled: boolean): void {
    this.patch({ fireworksEnabled });
  }

  setProjection(projection: ProjectionMode): void {
    this.patch({ projection });
  }

  setNavTab(navTab: NavTab): void {
    this.patch({ navTab });
  }

  setThemeMode(themeMode: ThemeMode): void {
    this.patch({ themeMode });
  }

  setTicker(tickerIndex: number, tickerVisible: boolean): void {
    this.patch({ tickerIndex, tickerVisible });
  }

  setTickerVisible(tickerVisible: boolean): void {
    this.patch({ tickerVisible });
  }

  setError(lastError: AppError | null): void {
    this.patch({ lastError });
  }

  /** 엔진의 베이스맵 헬스 이벤트를 그대로 올린다(C7). 같은 참조면 재렌더가 없다. */
  setBaseMapHealth(baseMapHealth: BaseMapHealth): void {
    this.patch({ baseMapHealth });
  }

  /** 서버 `/api/alerts` 갱신(F3b). SSE `alert` 채널이 오면 다시 부른다. */
  setAlerts(alerts: ReadonlyMap<ValleyId, ValleyAlertState>): void {
    this.patch({ alerts });
  }

  /** 서버 `/api/reports` 갱신(F5c). SSE `report` 채널이 오면 다시 부른다. */
  setReports(reports: readonly Report[]): void {
    this.patch({ reports });
  }

  /** 계곡 티커 회전(F5c, `ValleyTickerController` 전용) — 문구 색인과 페이드 상태를 함께 바꾼다. */
  setValleyTicker(valleyTickerIndex: number, valleyTickerVisible: boolean): void {
    this.patch({ valleyTickerIndex, valleyTickerVisible });
  }

  setValleyTickerVisible(valleyTickerVisible: boolean): void {
    this.patch({ valleyTickerVisible });
  }

  /** 조건 필터 칩 선택(N1). 세션 상태 — 저장하지 않는다. 항상 새 `Set` 참조로 받는다. */
  setFilterChips(filterChips: ReadonlySet<FilterChipKey>): void {
    this.patch({ filterChips });
  }

  /** 검색어(SR1). 세션 상태 — 저장하지 않는다. 선택하면 표현 계층이 빈 문자열로 되돌린다. */
  setSearchQuery(searchQuery: string): void {
    this.patch({ searchQuery });
  }
}
