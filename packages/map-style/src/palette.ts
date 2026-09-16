/**
 * 지도 팔레트 — valley-ds `tokens/map-palette.json` 반입.
 *
 * UI 토큰(`apps/valley-map/src/theme/tokens.ts`)과 **분리된** 팔레트다. 지도
 * 위 색은 UI 카드 색이 아니라 베이스맵의 명도와 어울려야 하므로 따로 산다.
 * 두 어댑터가 같은 값을 읽도록 이 패키지에 둔다.
 *
 * 반입하면서 정규화한 것(docs/TODO.md "valley-ds 내부 불일치")
 *   · `marker.facility.convenience` → `store` (매점·슈퍼·편의점을 모두 담는 이름)
 *   · `marker.status3.empty`        → `busy`  (`available` 의 반대말로 읽히는 혼동 제거)
 *
 * 반입하지 않은 것 — spotts.kr 전용 레이어의 값이라 openfreemap 스타일에 대응
 * 레이어가 없다: `krComplexFill`·`krComplexLabel`(아파트 단지), `subwayDotStroke`.
 *
 * `dark` 팔레트도 타입에 맞춰 들였지만 **다크 지도는 현재 openfreemap `dark` 의
 * 원본 paint 를 그대로 쓴다**(`composeMapStyle` 주석). 다크 UI 토큰이 그 지도
 * 위에서 맞춰졌고, 다크 회귀는 "기존과 동일"이 계약이기 때문이다. 다크 재색칠은
 * `applyMapPalette(style, 'dark')` 로 언제든 켤 수 있다.
 */

import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type {
  AlertLevel,
  CrowdStatus,
  FacilityType,
  HexColor,
  ReportType,
  ShadeAmount,
} from '@modu-valley/core';

/** 지도 팔레트 모드. 앱 테마 모드(`ThemeMode`)와 같은 리터럴이라 그대로 넘길 수 있다. */
export type MapStyleMode = 'light' | 'dark';

export const MAP_STYLE_MODES: readonly MapStyleMode[] = ['light', 'dark'];

/**
 * 베이스맵 한 벌의 색. `map-palette.json` 의 `dark`/`light` 블록과 키가 같다.
 * `landuseResidential` 만 두 값이다 — 원본은 줌 9 → 12 로 알파가 옅어지는 쌍.
 */
export type MapPalette = {
  readonly background: HexColor;
  readonly water: HexColor;
  readonly park: HexColor;
  readonly building: HexColor;
  /** `[z9, z12]` — 줌이 올라가면 옅어진다. */
  readonly landuseResidential: readonly [string, string];
  readonly roadCasing: HexColor;
  readonly roadMinor: HexColor;
  readonly roadPrimary: HexColor;
  readonly roadMotorway: HexColor;
  readonly railway: HexColor;
  readonly labelText: HexColor;
  readonly labelHalo: HexColor;
  readonly poiText: HexColor;
};

export const DARK_MAP_PALETTE: MapPalette = {
  background: '#242729',
  water: '#1e3143',
  park: '#232e1f',
  building: '#2b2f33',
  landuseResidential: ['hsla(0,0%,18%,0.4)', 'hsla(0,0%,18%,0.2)'],
  roadCasing: '#15181a',
  roadMinor: '#3e414c',
  roadPrimary: '#565963',
  roadMotorway: '#696e7f',
  railway: '#4a4e55',
  labelText: '#e3e7eb',
  labelHalo: '#1a1d1f',
  poiText: '#c5c6cb',
};

export const LIGHT_MAP_PALETTE: MapPalette = {
  background: '#f7f7f7',
  water: '#a5d1f2',
  // V1 (b): valley-ds `#d8ecc5` 에서 한 톤 차분한 회록 — 지형 고도색·음영 위에서 물줄기보다 앞서지 않게.
  park: '#cfe0c0',
  building: '#ffffff',
  landuseResidential: ['hsla(0,0%,93%,0.4)', 'hsla(0,0%,93%,0.2)'],
  roadCasing: '#ecd792',
  roadMinor: '#ffffff',
  roadPrimary: '#fdf0b5',
  roadMotorway: '#f8d39a',
  railway: '#a6a29e',
  labelText: '#333333',
  labelHalo: '#ffffff',
  poiText: '#575b66',
};

export const MAP_PALETTES: Readonly<Record<MapStyleMode, MapPalette>> = {
  light: LIGHT_MAP_PALETTE,
  dark: DARK_MAP_PALETTE,
};

// ── 계곡용 조정 ────────────────────────────────────────────────

/**
 * 공원·녹지·숲 불투명도. 원본(`parkOpacity`)은 도심 야경 기준으로 z9 0.5 → z12 0.2
 * 로 **줄어드는데**, 산·계곡이 주 무대인 이 앱에서는 가까이 갈수록 녹지가
 * 먼저 읽혀야 하므로 방향을 뒤집었다(README "지도 팔레트도 손봐야 합니다").
 *
 * V1 (b) 에서 상한을 0.75 → 0.55 로 내리고 숲(`landcover_wood`·`landcover_grass`)에도
 * 같은 곡선을 준다 — C10 지형 질감(음영 0.5·고도색 0.85) 위에 녹지 0.75 가 겹치면 화면
 * 전체가 올리브로 덮여 물줄기(주인공)가 가장 늦게 읽혔다. 값은 스파이크 B1 화면으로
 * 확정(docs/TODO.md V1 결정 확정).
 */
export const VALLEY_PARK_OPACITY: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  9,
  0.2,
  12,
  0.4,
  14,
  0.55,
];

/**
 * 물줄기(`waterway`: stream·river·canal) 선폭. 원본은 폭을 주지 않아 1px 고정이라
 * 계곡 줌에서 물줄기가 도로 아래로 사라진다. 줌에 따라 넓혀 "물이 먼저 읽히게"
 * 한다. 강(river) 은 폴리곤 `water` 로도 그려지므로 선폭은 개천 위주로 맞췄다.
 */
export const VALLEY_WATERWAY_WIDTH: ExpressionSpecification = [
  'interpolate',
  ['exponential', 1.3],
  ['zoom'],
  10,
  1,
  14,
  2.4,
  18,
  6,
];

// ── 마커 팔레트 (`map-palette.json` `marker` 절) ───────────────

/** 시설 종류별 마커 색. `marker.facility`. */
export const FACILITY_COLORS: Readonly<Record<FacilityType, HexColor>> = {
  station: '#1597d1',
  restroom: '#16a36a',
  food: '#e58b20',
  cafe: '#a66b3d',
  store: '#7b61ff',
  /** 정자·쉼터 — 나무 그늘의 올리브. 비어 있던 색상환 90도 자리(초록 152도 화장실과 갈라진다). */
  shelter: '#7a9e2f',
  parking: '#4b5563',
  access: '#6b5dd3',
  safety: '#d65a5a',
  etc: '#3d7ab8',
};

/** 혼잡 3단계 색. `marker.status3`. 여유 / 보통 / 혼잡. */
export const CROWD_STATUS_COLORS: Readonly<Record<CrowdStatus, HexColor>> = {
  available: '#2f9e64',
  low: '#e79b38',
  busy: '#d64545',
};

/** 혼잡 상태를 모르는 구간의 선 색 — 상태색과 겹치지 않는 accent. */
export const SEGMENT_UNKNOWN_COLOR: HexColor = '#297cff';

/**
 * 구간 선 케이싱(V1 (c)) — 상태색 선 바깥의 테두리. 라이트는 흰색으로 지형 질감에서 물줄기를
 * 떼어 내고, 다크는 지도 배경에 가까운 검정(`#0c0c0c`)으로 같은 역할을 한다. 레이어 명세는
 * 라이트 값을 들고, 다크는 어댑터가 `valleyPaintOverrides` 로 덧쓴다(레이어 셋은 모드를 모른다).
 */
export const SEGMENT_CASING_COLORS: Readonly<Record<MapStyleMode, HexColor>> = {
  light: '#ffffff',
  dark: '#0c0c0c',
};

/**
 * 시설 핀의 테두리·글리프 색(C5 (a)(d)) — 유형색 채움 위에 흰 테두리 2 + 흰 픽토그램. 다크도
 * 같은 값(D2). V1 (f) 의 흰 원 바탕(`FACILITY_DISC_COLOR`)이 이 이름으로 이어졌다.
 */
export const FACILITY_PIN_STROKE_COLOR: HexColor = '#ffffff';

/**
 * 상류 강우 경보 3단계 색(F3b) — 주의 호박 · 경보 주홍 · 대피 진홍. `theme/tokens.ts` 의
 * `ThemeColors` 는 데모 원본 값에 고정돼(파리티 테스트) 있어 새 의미의 색을 더할 자리가
 * 아니다 — 여기 두고 두 테마가 같은 값을 쓴다(경보색은 지시등이라 `live` 처럼 모드 불변).
 * 카드 배지·상세 타일·지도 배너가 같이 쓴다.
 */
export const ALERT_LEVEL_COLORS: Readonly<Record<AlertLevel, HexColor>> = {
  watch: '#d9822b',
  warning: '#c8401f',
  evacuate: '#a3123a',
};

/**
 * 그늘 양 3단계 색(N5, 결정 (e)) — 짙은 녹 · 중간 녹 · 황토. 지도 위 그늘 폴리곤
 * (`SHADE_COLORS`)과는 다른 자리다 — 이건 카드·시트의 **태그 칩** 색이고, 두 테마가
 * 같은 값을 쓴다(경보색과 같은 이유 — 의미색은 모드 불변).
 */
export const SHADE_AMOUNT_COLORS: Readonly<Record<ShadeAmount, HexColor>> = {
  many: '#1f5e3d',
  moderate: '#4f8f5b',
  few: '#a97e3e',
};

/**
 * 제보 유형 6색(F5, 화면 결정 확정 (a)). 유형마다 다른 색을 쓰기로 한 것이 `ALERT_LEVEL_COLORS`·
 * `SHADE_AMOUNT_COLORS` 의 "두 테마가 같은 값" 관례를 깨는 유일한 자리다 — 흰 배경(`#ffffff`) 4.5:1
 * 은 상대휘도 ≤0.117, `#202024` 4.5:1 은 ≥0.245 로 교집합이 없어 한 값으로는 두 테마를 다 만족시킬
 * 수 없다(`docs/TODO.md` F5 "화면 결정 확정 (a)"). 그래서 **테마별 2벌**을 둔다.
 *
 * 대비 실측(F5b, `test/reportTypeColors.test.ts` 가 회귀를 잡는다) — light 는 `#ffffff` 위,
 * dark 는 `#202024` 위 WCAG 상대휘도 대비. TODO 표의 값이 이미 전부 4.5:1 을 넘어 명도 조정
 * 없이 그대로 썼다.
 *
 *   유형                 | light 대비 | dark 대비
 *   -------------------- | ---------- | ---------
 *   illegal-property      | 5.92       | 6.58
 *   trash                 | 5.49       | 8.06
 *   emergency             | 5.82       | 7.06
 *   valley-info           | 6.25       | 7.74
 *   missing-person        | 6.73       | 7.24
 *   lost-item             | 6.32       | 7.58
 */
export const REPORT_TYPE_COLORS: Readonly<
  Record<MapStyleMode, Readonly<Record<ReportType, HexColor>>>
> = {
  light: {
    'illegal-property': '#a8452a',
    trash: '#5d7030',
    emergency: '#c02b1e',
    'valley-info': '#16697f',
    'missing-person': '#7b3fa8',
    'lost-item': '#2f5fa8',
  },
  dark: {
    'illegal-property': '#e2916f',
    trash: '#a9c069',
    emergency: '#ff8a72',
    'valley-info': '#5fc0d8',
    'missing-person': '#c99af0',
    'lost-item': '#86b4f0',
  },
};
