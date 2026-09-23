/**
 * 시설 마커 아이콘 — 물방울 핀 SVG 팩토리 (C5).
 *
 * **아이콘 ID 가 곧 명세**다(valley-ds `lazy-marker-icons.ts` 패턴). 심볼 레이어는
 * `facility/<type>`(선택 `facility/<type>/selected`) 만 요청하고, 그 ID 를 받은 쪽이 이
 * 파일의 함수로 SVG 를 만들어 래스터화한다 — web 은 런타임 `createImageBitmap`
 * (`adapter-web` `MarkerIconRegistry`), 네이티브는 빌드 시 PNG(`scripts/icons`). 한 소스에서
 * 두 출력이 나오므로 파리티가 저절로 지켜진다.
 *
 * 이 파일은 DOM·지도 SDK 를 모르는 **순수 문자열 함수**다. 색은 `palette.ts`.
 *
 * 결정(docs/TODO.md C5, 2026-09-06 사용자 확정)
 *   (a) A2 물방울 핀 — 유형색 채움 + 흰 테두리 2 + 흰 글리프. 28×36dp, 꼭짓점이 좌표
 *       (`icon-anchor: bottom`). 선택 시 34×44 + 흰 링(핀 확대 + 링으로 구분, 별도 선택 핀 없음).
 *   (b) B1 자체 선 픽토그램 9종 — 24px 격자, stroke 2, 둥근 끝. 검토 페이지 경로를 다듬었다.
 *   (c) C1 28dp(선택 34), 글리프 17px(선택 20), 픽셀 비율 2.
 *   (d) D2 다크도 라이트와 같다 — ID 에 모드가 없다.
 *
 * 선택 핀의 링은 같은 경로를 세 번 그려 만든다(바깥 흰 8 → 유형색 4 → 채움 + 흰 테두리 2).
 * 결과는 테두리 2 · 유형색 틈 1 · 흰 링 2 다. 링까지 포함한 경로 상자(32×41.5)를 34×44 에
 * 맞추는 배율(≈1.06)로 핀을 키우면 꼭짓점은 캔버스 바닥에서 링 두께(≈4dp)만큼 위다 —
 * `FACILITY_PIN_TIP_INSET` 이 그 값이고, 심볼 레이어가 `icon-offset` 으로 되돌려 두 상태의
 * 꼭짓점이 같은 좌표에 놓인다.
 */
import { FACILITY_TYPES, type FacilityType } from '@modu-valley/core';
import { FACILITY_COLORS, FACILITY_PIN_STROKE_COLOR } from './palette';

/** 모든 시설 아이콘 ID 의 접두사. 레지스트리가 "내 담당인가" 를 이걸로 가른다. */
export const FACILITY_ICON_ID_PREFIX = 'facility/';
/** 선택 상태 접미사. */
export const FACILITY_ICON_SELECTED_SUFFIX = '/selected';

/** 래스터 배율 — dp 하나를 픽셀 둘로. web `addImage({ pixelRatio })`, PNG `@2x` 와 같은 값. */
export const MARKER_ICON_PIXEL_RATIO = 2;

export type IconSize = { readonly width: number; readonly height: number };

/** 기본 핀 크기(dp). 결정 (a)(c). */
export const FACILITY_PIN_SIZE: IconSize = { width: 28, height: 36 };
/** 선택 핀 크기(dp). */
export const FACILITY_PIN_SELECTED_SIZE: IconSize = { width: 34, height: 44 };
/** 글리프 한 변(dp) — 24px 격자를 이 크기로 놓는다. */
export const FACILITY_GLYPH_SIZE = 17;
export const FACILITY_GLYPH_SELECTED_SIZE = 20;

/** 핀 경로의 원 좌표계(28×36) — 검토 페이지 A2 와 같은 경로. 꼭짓점 (14, 34.5). */
const PIN_PATH = 'M14 1C7 1 2 6 2 12.5c0 8 12 22 12 22s12-14 12-22C26 6 21 1 14 1z';
/** 경로를 0.5 내려 테두리(2)의 끝이 캔버스 바닥(36)에 닿게 한다 — 꼭짓점이 곧 좌표. */
const PIN_SHIFT_Y = 0.5;
/** 핀 머리(원에 가까운 부분)의 중심 — 글리프가 여기 놓인다. */
const PIN_HEAD_CENTER = { x: 14, y: 13 + PIN_SHIFT_Y };
const PIN_STROKE_WIDTH = 2;

/** 선택 링 — 바깥 흰 선폭 8(경로 밖으로 4), 안쪽 유형색 선폭 4(밖으로 2). */
const RING_OUTER_STROKE = 8;
const RING_INNER_STROKE = 4;
const RING_REACH = RING_OUTER_STROKE / 2;
/** 기본 핀에서 경로(테두리 제외)의 상자 — x 2..26, y 1.5..35(꼭짓점). */
const PIN_PATH_BOX = { left: 2, right: 26, top: 1 + PIN_SHIFT_Y, bottom: 34.5 + PIN_SHIFT_Y };
/** 링까지 포함한 상자(32 × 41.5)를 34×44 안에 넣는 배율 — 높이가 먼저 닿는다(≈1.06). */
const SELECTED_SCALE = Math.min(
  FACILITY_PIN_SELECTED_SIZE.width / (PIN_PATH_BOX.right - PIN_PATH_BOX.left + 2 * RING_REACH),
  FACILITY_PIN_SELECTED_SIZE.height / (PIN_PATH_BOX.bottom - PIN_PATH_BOX.top + 2 * RING_REACH),
);
/** 경로 원점이 선택 캔버스에서 놓이는 곳 — 가로 가운데, 링 바닥이 캔버스 바닥. */
const SELECTED_OFFSET = {
  x:
    (FACILITY_PIN_SELECTED_SIZE.width -
      (PIN_PATH_BOX.right - PIN_PATH_BOX.left + 2 * RING_REACH) * SELECTED_SCALE) /
      2 +
    (RING_REACH - PIN_PATH_BOX.left) * SELECTED_SCALE,
  y: FACILITY_PIN_SELECTED_SIZE.height - (PIN_PATH_BOX.bottom + RING_REACH) * SELECTED_SCALE,
};

/**
 * 꼭짓점이 캔버스 바닥에서 얼마나 위인가(dp). 기본 핀은 0(테두리 끝이 바닥), 선택 핀은
 * 링 두께(4 × 배율 ≈ 4.2). 레이어의 `icon-offset` 이 이 값만큼 내려 두 상태의 꼭짓점을
 * 좌표에 맞춘다.
 */
export const FACILITY_PIN_TIP_INSET: Readonly<Record<'base' | 'selected', number>> = {
  base: 0,
  selected: round(RING_REACH * SELECTED_SCALE),
};

/**
 * 10종 픽토그램 — 24×24 격자, `currentColor`. 선은 stroke 2 둥근 끝, 면은 채움.
 * 검토 페이지(2026-09-06)의 경로를 출발점으로, 앱 아이콘(`apps/valley-map/src/icons`)과 같은
 * 결(1.8~2.4 선폭·round cap)로 다듬었다. 앱 목록의 `FacilityGlyph` 가 같은 도형을 그린다 —
 * 값을 바꾸면 두 곳을 함께 바꾼다(스냅샷 테스트가 이 문자열을 고정한다).
 */
export const FACILITY_GLYPHS: Readonly<Record<FacilityType, string>> = {
  // P
  parking:
    '<path d="M8 19V5h5.5a4 4 0 0 1 0 8H8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  // 사람(머리 + 몸통)
  restroom:
    '<circle cx="12" cy="5.5" r="2.2" fill="currentColor"/><path d="M8.5 10.5h7l-1.2 5H14v4h-4v-4H9.7z" fill="currentColor"/>',
  // 포크 + 나이프
  food: '<path d="M7 3v7M5 3v4.5a2 2 0 0 0 4 0V3M7 10v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17 3c-2 2-2.5 5-2.5 8h2.5v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  // 컵(손잡이 + 김)
  cafe: '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8.5 3.5v2.5M11.5 3.5v2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  // 바구니
  store:
    '<path d="M4.5 10h15l-1.5 9h-12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 10l3-6M16 10l-3-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.5 13.5v3M14.5 13.5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  // 정자(지붕 + 처마 + 기둥 둘 + 바닥)
  shelter:
    '<path d="M3.2 11.2L12 4.2l8.8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 11.2h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6.8 11.2v8.6M17.2 11.2v8.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4.8 20.2h14.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  // 쓰레기통(뚜껑 + 몸통 + 세로줄)
  bin: '<path d="M5 7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.5 7V5h5v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6.5 7l1 13h9l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 10.5v6.5M14 10.5v6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  // 그네(A 프레임 + 줄 + 앉는 판)
  playground:
    '<path d="M4 20L9.5 4h5L20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 4l1 11.5M14.5 4l-1 11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8.5 15.5h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  // 버스
  station:
    '<rect x="5" y="4" width="14" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 11h14" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="19.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="19.5" r="1.6" fill="currentColor"/>',
  // 발자국 길(점선 + 화살촉)
  access:
    '<path d="M6 20c2-3 1-6 3-8s5-1 6-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 2.5"/><path d="M15 4l4 2-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  // 원 + 십자
  safety:
    '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  // 점 3
  etc: '<circle cx="6.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="17.5" cy="12" r="1.9" fill="currentColor"/>',
};

/** 아이콘 ID 를 만든다 — `facility/parking`, `facility/parking/selected`. */
export function facilityIconId(type: FacilityType, selected = false): string {
  return `${FACILITY_ICON_ID_PREFIX}${type}${selected ? FACILITY_ICON_SELECTED_SUFFIX : ''}`;
}

export type FacilityIconSpec = {
  readonly type: FacilityType;
  readonly selected: boolean;
};

/** ID → 명세. 이 파일의 규약이 아니면 `null`(다른 아이콘은 내 담당이 아니다). */
export function parseFacilityIconId(id: string): FacilityIconSpec | null {
  if (!id.startsWith(FACILITY_ICON_ID_PREFIX)) return null;
  let rest = id.slice(FACILITY_ICON_ID_PREFIX.length);
  const selected = rest.endsWith(FACILITY_ICON_SELECTED_SUFFIX);
  if (selected) rest = rest.slice(0, -FACILITY_ICON_SELECTED_SUFFIX.length);
  const type = (FACILITY_TYPES as readonly string[]).includes(rest) ? (rest as FacilityType) : null;
  return type === null ? null : { type, selected };
}

/** 9종 × 2상태 = 18개 ID 전부. 네이티브 `<Images>` 등록과 PNG 빌드가 순회한다. */
export const FACILITY_ICON_SPECS: readonly FacilityIconSpec[] = FACILITY_TYPES.flatMap((type) => [
  { type, selected: false },
  { type, selected: true },
]);

export function facilityIconSize(selected: boolean): IconSize {
  return selected ? FACILITY_PIN_SELECTED_SIZE : FACILITY_PIN_SIZE;
}

/**
 * 핀 SVG 문자열. `width`/`height` 는 dp × `MARKER_ICON_PIXEL_RATIO`(28×36 → 56×72) — 그대로
 * 비트맵으로 만들어 `pixelRatio: 2` 로 넣으면 지도에서 28×36dp 다. PNG 빌더는 `viewBox` 만 쓰고
 * 배율을 따로 준다.
 */
export function facilityPinSvg(type: FacilityType, selected = false): string {
  const fill = FACILITY_COLORS[type];
  const stroke = FACILITY_PIN_STROKE_COLOR;
  const size = facilityIconSize(selected);
  const glyph = FACILITY_GLYPHS[type].replaceAll('currentColor', stroke);

  const pin = selected
    ? [
        `<g transform="translate(${fmt(SELECTED_OFFSET.x)} ${fmt(SELECTED_OFFSET.y)}) scale(${fmt(SELECTED_SCALE)}) translate(0 ${PIN_SHIFT_Y})">`,
        `<path d="${PIN_PATH}" fill="none" stroke="${stroke}" stroke-width="${RING_OUTER_STROKE}" stroke-linejoin="round"/>`,
        `<path d="${PIN_PATH}" fill="none" stroke="${fill}" stroke-width="${RING_INNER_STROKE}" stroke-linejoin="round"/>`,
        `<path d="${PIN_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="${PIN_STROKE_WIDTH}" stroke-linejoin="round"/>`,
        '</g>',
      ]
    : [
        `<g transform="translate(0 ${PIN_SHIFT_Y})">`,
        `<path d="${PIN_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="${PIN_STROKE_WIDTH}" stroke-linejoin="round"/>`,
        '</g>',
      ];

  const glyphSize = selected ? FACILITY_GLYPH_SELECTED_SIZE : FACILITY_GLYPH_SIZE;
  const head = selected
    ? {
        x: PIN_HEAD_CENTER.x * SELECTED_SCALE + SELECTED_OFFSET.x,
        y: PIN_HEAD_CENTER.y * SELECTED_SCALE + SELECTED_OFFSET.y,
      }
    : PIN_HEAD_CENTER;
  const glyphScale = glyphSize / 24;
  const glyphGroup = `<g transform="translate(${fmt(head.x - glyphSize / 2)} ${fmt(head.y - glyphSize / 2)}) scale(${fmt(glyphScale)})">${glyph}</g>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}"`,
    ` width="${size.width * MARKER_ICON_PIXEL_RATIO}" height="${size.height * MARKER_ICON_PIXEL_RATIO}">`,
    ...pin,
    glyphGroup,
    '</svg>',
  ].join('');
}

/** ID → SVG. 규약 밖 ID 는 `null`. 레지스트리·PNG 빌더가 쓰는 단일 진입점. */
export function facilityIconSvgById(id: string): string | null {
  const spec = parseFacilityIconId(id);
  return spec === null ? null : facilityPinSvg(spec.type, spec.selected);
}

/** 소수 셋째 자리까지 — SVG 가 짧고 스냅샷이 안정적이다. */
function fmt(value: number): string {
  return String(round(value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
