/**
 * 화면 상태 스냅샷.
 *
 * 원본 데모의 상태는 DOM 클래스(`.down`, `.act`, `.on`)와 모듈 지역 변수
 * (`selected`, `layout`, `tour`, `busy`, `ti`, `window.__fwOn`)에 흩어져 있다.
 * 어디가 진실인지 알 수 없어 두 곳이 어긋나면 조용히 깨진다.
 * 여기서는 단일 불변 스냅샷 하나만 진실이고, DOM 은 그 투영이다.
 *
 * 두 장면(scene)이 한 스냅샷을 나눠 쓴다.
 *   · festival — `festival` + `selectedSpotId`. `/firework` 데모 화면(D2 보존).
 *   · valley   — `valleys` + `selectedSegmentId` / `selectedFacilityId`. `/` 계곡 화면.
 * 시트·플립·카메라·내비 같은 셸 상태는 공통이다. 장면별 필드를 유니온으로
 * 가르지 않은 이유: 컴포넌트가 `state.selectedSpotId` 처럼 필드 하나만 고르는
 * 선택자(`useAppState`)를 쓰므로, 다른 장면의 필드가 `null` 로 있는 것이
 * 좁히기(narrowing)보다 값싸고 festival 컴포넌트를 한 줄도 바꾸지 않는다.
 */

import { type BaseMapHealth, INITIAL_BASE_MAP_HEALTH } from '../../domain/basemap/BaseMapHealth';
import type { CameraPose } from '../../domain/camera/CameraPose';
import type { ProjectionMode } from '../../domain/camera/ProjectionMode';
import type { Festival } from '../../domain/festival/Festival';
import type { SpotId } from '../../domain/festival/SpotId';
import type { Report } from '../../domain/report/Report';
import { lookupFacility, lookupSegment } from '../../domain/valley/catalog';
import type { FilterChipKey } from '../../domain/valley/filterChips';
import type { FacilityId, SegmentId, ValleyId } from '../../domain/valley/ids';
import { SHADE_NOON_INDEX, type ShadeHourIndex } from '../../domain/valley/Segment';
import { defaultShadeHourIndex, type ValleyShade } from '../../domain/valley/Shade';
import type { Valley } from '../../domain/valley/Valley';
import type { DatasetMetadata } from '../../domain/valley/ValleyDataset';
import type { LifecycleState } from '../../shared/async/lifecycle';
import type { AppError } from '../../shared/errors';
import type { MapContentFilter, MapFeatureKind } from '../ports/MapContent';
import { DEFAULT_SHEET_SNAP, type SheetSnap } from './SheetSnap';
import type { ValleyAlertState } from './ValleyAlertState';
import { INITIAL_VIEWPORT_INSETS, type ViewportInsets } from './ViewportInsets';

/** 화면이 다루는 도메인. 라우트(`/firework`·`/`)가 정한다. */
export const SCENES = ['festival', 'valley'] as const;
export type Scene = (typeof SCENES)[number];

/** 명당 목록 배치. 데모의 `#spotList.rows` / `.tiles`. */
export const SPOT_LAYOUTS = ['rows', 'tiles'] as const;
export type SpotLayout = (typeof SPOT_LAYOUTS)[number];

/**
 * 시트에 보이는 면. 데모의 `#faceList` / `#faceDetail` + 설정 면(C9).
 * `settings` 는 장면과 무관한 셸의 면이다 — 내비 설정 탭으로 열고 ×로 목록에 돌아온다.
 */
export const SHEET_FACES = ['list', 'detail', 'settings'] as const;
export type SheetFace = (typeof SHEET_FACES)[number];

/**
 * 테마 선택(C9). `system` 은 기기 설정을 따른다 — 어느 팔레트로 풀리는지는 표현
 * 계층(`useColorScheme`)이 정하고, 코어는 선택값만 든다. 저장된다(`STORAGE_KEYS.themeMode`).
 */
export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** 저장소에서 읽은 문자열이 테마 선택인지. 모르는 값(옛 버전·손상)은 버린다. */
export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return (
    value !== null && value !== undefined && (THEME_MODES as readonly string[]).includes(value)
  );
}

/**
 * 플립 전환 단계. 데모는 높이가 다른 두 면을 다루려고 한 컨테이너를 180도
 * 돌리지 않고 0→90도 접기(220ms) → 내용 교체 → 90→0도 펴기(240ms)로 나눈다.
 * 그 두 구간이 각각 `folding` / `unfolding` 이다.
 */
export const FLIP_PHASES = ['idle', 'folding', 'unfolding'] as const;
export type FlipPhase = (typeof FLIP_PHASES)[number];

/** 하단 플로팅 내비 탭. 데모는 인덱스 정수로 다룬다(`setNav(2)`). */
export const NAV_TABS = ['video', 'home', 'spots', 'report', 'settings'] as const;
export type NavTab = (typeof NAV_TABS)[number];

export type AppState = {
  readonly status: LifecycleState;
  readonly scene: Scene;

  // ── festival ──
  readonly festival: Festival | null;
  readonly selectedSpotId: SpotId | null;

  // ── valley ──
  /** 적재된 계곡들. 계곡 순서는 데이터 파일 순, 구간은 상류→하류. */
  readonly valleys: readonly Valley[] | null;
  /** 데이터 파일 머리말. 시트 제목(`description`)과 출처 표기의 재료. */
  readonly valleyMetadata: DatasetMetadata | null;
  /** 구간 선택 — 상세 면이 열린다. */
  readonly selectedSegmentId: SegmentId | null;
  /** 시설 선택 — 핀 + 목록 면 최상단 미니 행. 구간 선택과 동시에 있지 않는다. */
  readonly selectedFacilityId: FacilityId | null;
  /** 계곡별 그늘 폴리곤·메타(F4). 적재 전 `null`, 합본이 없으면 빈 맵. 상세 시트 고지의 재료. */
  readonly valleyShade: ReadonlyMap<ValleyId, ValleyShade> | null;
  /** 그늘 보기 토글. 저장된다(`STORAGE_KEYS.shadeVisible`). 기본 꺼짐 — 첫 화면은 구간·시설이 주인공. */
  readonly shadeVisible: boolean;
  /** 시간 트랙의 시각. 그늘이 꺼져 있어도 값은 있다 — 켜면 이 시각으로 그린다. 저장하지 않는다. */
  readonly shadeHourIndex: ShadeHourIndex;
  /**
   * 계곡별 상류 강우 경보(F3b). 적재 전·서버 미연결이면 `null` — 배지·배너·타일은 이때
   * 아무것도 그리지 않는다(평시와 구분 없이 조용하다). `GET /api/alerts` + SSE `alert` 채널.
   */
  readonly alerts: ReadonlyMap<ValleyId, ValleyAlertState> | null;
  /**
   * 제보 피드(F5c) — 서버 전체(모든 계곡) 최신순. 적재 전·서버 미연결이면 `null` — "실시간
   * 정보" 섹션과 계곡 티커는 이때 아무것도 그리지 않는다(티커는 기본 문구로). `GET /api/reports`
   * + SSE `report` 채널.
   */
  readonly reports: readonly Report[] | null;
  /** 제보 상세 선택 — 시트 상세 면이 열린다(화면 결정 (e), 구간 상세와 같은 플립). */
  readonly selectedReportId: string | null;
  /** 계곡 티커(F5c, `ValleyTickerController` 전용) — festival `tickerIndex` 와는 분리된 필드다. */
  readonly valleyTickerIndex: number;
  /** 계곡 티커 문구 교체 중 페이드 아웃 상태. festival `tickerVisible` 과는 분리된 필드다. */
  readonly valleyTickerVisible: boolean;
  /**
   * 조건 필터 칩 선택(N1, 결정 (c) 다중 선택). 세션 상태 — 저장하지 않는다(앱을 다시 열면
   * 항상 빈 선택). 목록·지도 둘 다 이 값과 `selectedFeatureKind` 로 정해지는 핀 고정 계곡
   * (해석 4)을 같이 반영해야 한다 — `filterValleys`·`mapContentFilterOf` 참고.
   */
  readonly filterChips: ReadonlySet<FilterChipKey>;
  /**
   * 검색어(SR1). 세션 상태 — 저장하지 않는다(결정 8, 최근 검색어 없음). 값이 있으면
   * 시트가 검색 결과만 보여준다(결정 2) — `searchCatalog` 가 계곡·시설을 부분일치로
   * 찾는다. 필터 칩과 무관하다(결정 6).
   */
  readonly searchQuery: string;

  // ── 셸 (공통) ──
  readonly sheetFace: SheetFace;
  /**
   * 시트 스냅 3단(C8) — `peek`(데모의 `.sheet.down`, 접힘) · `half`(데모 기본, `.sheet.down`
   * 없음) · `full`(신설, 85vh). `sheetCollapsed: boolean` 을 대체한다 — 옛 `true` 는 `peek`,
   * `false` 는 `half` 였다.
   */
  readonly sheetSnap: SheetSnap;
  /**
   * 지도가 아닌 고정 UI(상단바·시트)가 가리는 여백(C8·C6 이 소비). 표현 계층이 창 크기·
   * 안전 영역·지금 스냅을 재서 `MapSession.setViewportInsets` 로 채운다 — 세션 시작
   * 직후에는 아직 측정 전이라 `INITIAL_VIEWPORT_INSETS`(0/0).
   */
  readonly viewportInsets: ViewportInsets;
  /** 플립 전환 단계. `idle` 이 아니면 재진입을 막는다. 데모의 `busy`. */
  readonly flipPhase: FlipPhase;
  readonly spotLayout: SpotLayout;
  /**
   * 앱이 전면에 있는가. 표현 계층이 RN `AppState`(web 은 문서 visibility)로 넘긴다.
   * 물줄기 흐름 같은 배터리를 쓰는 연출이 배경에서 멈추는 근거(C10c). 기본 참.
   */
  readonly appActive: boolean;

  readonly fireworksEnabled: boolean;
  readonly projection: ProjectionMode;
  readonly camera: CameraPose | null;

  readonly navTab: NavTab;
  /**
   * 테마 선택. 초기 `system`; 앱은 자기 기본(D1 라이트, 개발용 강제 env)을 씨앗으로 넘기고
   * `LoadSessionUseCase` 가 저장값이 있으면 덮어쓴다. 표현 계층이 팔레트·지도 스타일로 푼다.
   */
  readonly themeMode: ThemeMode;
  readonly tickerIndex: number;
  /** 문구 교체 중 페이드 아웃 상태. 데모의 opacity 0 구간. */
  readonly tickerVisible: boolean;

  /** 마지막으로 관측된 복구 불가 오류. 표현 계층이 배너로 쓴다. */
  readonly lastError: AppError | null;
  /**
   * 베이스맵 헬스(C7). 엔진의 `'basemap-health'` 이벤트가 그대로 실린다. 셸 배너는
   * `outage` 만 본다 — 첫 실패 뒤 8초 동안 타일이 하나도 안 오면 참, 타일이 오면 거짓.
   */
  readonly baseMapHealth: BaseMapHealth;
};

export const INITIAL_APP_STATE: AppState = {
  status: 'idle',
  scene: 'festival',
  festival: null,
  selectedSpotId: null,
  valleys: null,
  valleyMetadata: null,
  selectedSegmentId: null,
  selectedFacilityId: null,
  valleyShade: null,
  shadeVisible: false,
  shadeHourIndex: SHADE_NOON_INDEX,
  alerts: null,
  reports: null,
  selectedReportId: null,
  valleyTickerIndex: 0,
  valleyTickerVisible: true,
  filterChips: new Set(),
  searchQuery: '',
  sheetFace: 'list',
  sheetSnap: DEFAULT_SHEET_SNAP,
  viewportInsets: INITIAL_VIEWPORT_INSETS,
  flipPhase: 'idle',
  spotLayout: 'rows',
  appActive: true,
  fireworksEnabled: true,
  projection: 'globe',
  camera: null,
  navTab: 'home',
  themeMode: 'system',
  tickerIndex: 0,
  tickerVisible: true,
  lastError: null,
  baseMapHealth: INITIAL_BASE_MAP_HEALTH,
};

/**
 * 세션이 시작할 때 앱이 이미 알고 있는 것(C9). 테마가 바뀌면 세션이 다시 만들어지므로
 * (지도 스타일은 엔진 생성 시 고정) 새 세션은 빈 상태가 아니라 이 씨앗에서 출발한다 —
 * 그렇지 않으면 설정 면이 닫히고 선택 표시가 한 프레임 `system` 으로 튄다.
 */
export type AppStateSeed = {
  /** 앱의 현재 테마 선택. 없으면 `system`. `LoadSessionUseCase` 가 저장값으로 덮어쓸 수 있다. */
  readonly themeMode?: ThemeMode;
  /** 설정 면을 연 채로 시작한다(테마 전환 뒤 재생성). `detail` 은 선택이 없어 불가. */
  readonly sheetFace?: 'list' | 'settings';
};

/**
 * 장면별 초기 상태. festival 은 데모 그대로(`INITIAL_APP_STATE`). valley 는
 * 불꽃을 꺼서 시작하고 — 계곡 화면에 불꽃 연출은 없고, 버튼도 숨긴다 — 시간 트랙을
 * 지금 시각(KST, F4 결정 (a))에 맞춘다. `now` 를 주입받는 이유는 테스트가 시각을
 * 고정하기 위해서다. `seed` 는 재생성된 세션이 이어받는 값(위 참고).
 */
export function initialAppState(
  scene: Scene,
  now: () => Date = () => new Date(),
  seed: AppStateSeed = {},
): AppState {
  const base: AppState =
    scene === 'festival'
      ? INITIAL_APP_STATE
      : {
          ...INITIAL_APP_STATE,
          scene,
          fireworksEnabled: false,
          shadeHourIndex: defaultShadeHourIndex(now()),
        };
  const seeded: AppState =
    seed.themeMode === undefined ? base : { ...base, themeMode: seed.themeMode };
  return seed.sheetFace === 'settings'
    ? { ...seeded, sheetFace: 'settings', navTab: 'settings' }
    : seeded;
}

/**
 * 지금 선택된 피처의 종류. 세 선택 필드 중 하나만 채워지는 것이 불변식이고,
 * 이 함수가 "선택이 있는가"·"어떤 해제 절차를 밟나"를 판정하는 유일한 자리다.
 */
export function selectedFeatureKind(state: AppState): MapFeatureKind | null {
  if (state.selectedSpotId !== null) return 'spot';
  if (state.selectedSegmentId !== null) return 'segment';
  if (state.selectedFacilityId !== null) return 'facility';
  return null;
}

/**
 * `pinnedValleyId` 가 필요로 하는 조각만 — 표현 계층이 선택자로 따로 뽑은 원시값들로도
 * (전체 `AppState` 재구성 없이) 부를 수 있게 `Pick` 으로 최소화한다(`ShadeTagsInput` 과
 * 같은 태도).
 */
export type PinnedValleyLookup = Pick<
  AppState,
  'valleys' | 'selectedSegmentId' | 'selectedFacilityId'
>;

/**
 * 필터를 이기는 계곡 id(N1 해석 4) — 상세가 열린 구간, 또는 선택된 시설의 계곡.
 * 선택이 없거나(명당·아무것도) 계곡이 아직 없으면 `undefined` — `MapContentFilter.pinnedValleyId`
 * 는 optional 이라 그대로 생략할 수 있다.
 */
export function pinnedValleyId(state: PinnedValleyLookup): ValleyId | undefined {
  if (state.valleys === null) return undefined;
  if (state.selectedSegmentId !== null) {
    const found = lookupSegment(state.valleys, state.selectedSegmentId);
    if (found.ok) return found.value.valley.id;
  }
  if (state.selectedFacilityId !== null) {
    const found = lookupFacility(state.valleys, state.selectedFacilityId);
    if (found.ok) return found.value.valley.id;
  }
  return undefined;
}

/** `mapContentFilterOf` 가 필요로 하는 조각만 — `PinnedValleyLookup` + 칩 선택. */
export type MapContentFilterLookup = PinnedValleyLookup & Pick<AppState, 'filterChips'>;

/**
 * 상태 → 지도 필터(N1). `MapContentComposer.content` 가 이 값으로 구간·시설·그늘을
 * 계곡 단위로 함께 거른다. `selectedOverride` 는 아직 상태에 반영하기 전의 "만약 이
 * 칩을 더하면" 선택을 지도에 먼저 반영해 보는 유즈케이스(`ToggleFilterChipUseCase`)를
 * 위한 것 — 생략하면 지금 상태의 선택을 그대로 쓴다.
 */
export function mapContentFilterOf(
  state: MapContentFilterLookup,
  selectedOverride?: ReadonlySet<FilterChipKey>,
): MapContentFilter {
  const selected = selectedOverride ?? state.filterChips;
  const pinned = pinnedValleyId(state);
  return pinned === undefined ? { selected } : { selected, pinnedValleyId: pinned };
}
