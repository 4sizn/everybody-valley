/**
 * 디자인 토큰 — 원본 데모의 `:root` 커스텀 프로퍼티를 그대로 옮긴 것.
 *
 * 데모 주석: "getComputedStyle 로 뽑은 실제 값. 색·반경·타이포 모두 원본 그대로."
 * **다크** 값을 바꾸면 파리티가 깨진다(`test/tokens.parity.test.ts` 가 고정한다).
 * 바꿔야 할 때는 데모 HTML 과 함께 고친다.
 *
 * 이 파일은 순수 TS 다 — react-native 를 import 하지 않는다. 그래서
 *   · vitest 가 RN 없이 값을 검증할 수 있고,
 *   · web 문서 셸(`app/+html.tsx`)이 정적 렌더 시점에 CSS 변수를 생성할 수 있다.
 * 플랫폼에 따라 갈리는 것(폰트 스택·네이티브 그림자)은 `theme.ts` 에 있다.
 *
 * 이름은 데모의 이름을 그대로 둔다(`fg2 → secondary` 같은 개명 금지) —
 * `docs/PARITY.md` 와 대조가 쉽게 유지되도록.
 */

export type ThemeMode = 'light' | 'dark';

/** D1 — 기본은 라이트. 다크는 파리티 검증과 설정(C9)에서 고른다. */
export const DEFAULT_THEME_MODE: ThemeMode = 'light';

/**
 * 개발용 강제 수단 `EXPO_PUBLIC_THEME=light|dark` 의 파서. 알 수 없는 값은
 * 기본 모드로 떨어진다. 정식 설정 UI 는 C9.
 */
export function parseThemeMode(raw: string | undefined): ThemeMode {
  return raw === 'dark' || raw === 'light' ? raw : DEFAULT_THEME_MODE;
}

/**
 * 색 토큰. 데모 `:root` 의 6개 + 데모 CSS 본문에서 뽑은 파생색.
 *
 * 마지막 세 개(`dotRing`·`dotRingTiles`·`navActiveRing`)는 이전에 `+html.tsx`
 * 의 CSS 리터럴로만 있던 값이다. CSS 변수를 토큰에서 생성하기 위해 이름을
 * 얻었을 뿐, 값은 그대로다.
 */
export type ThemeColors = {
  /** 베이스 */
  readonly bg: string;
  /** 카드 */
  readonly surface: string;
  /** 본문 */
  readonly fg: string;
  /** 보조 */
  readonly fg2: string;
  /** 캡션 */
  readonly fg3: string;
  /** 블루 CTA. 15px/600 CTA 에만 — 흰 글자 대비 3.9:1 이라 소형 텍스트에는 쓰지 않는다 */
  readonly accent: string;
  readonly line: string;
  readonly line2: string;
  /** 상단바 반투명 배경 */
  readonly glass: string;
  /** 원형 컨트롤 hover 배경 */
  readonly ctrlHover: string;
  /** 명당 행 hover 배경 */
  readonly spotHover: string;
  /** 세그먼트·내비 활성 배경 */
  readonly segActive: string;
  /** 시트 손잡이 */
  readonly grab: string;
  /** 실시간 소식 점 */
  readonly live: string;
  /** 실시간 소식 머리글 */
  readonly liveText: string;
  /** 상세 패널 eyebrow — accent 를 12px 에 쓰는 자리 */
  readonly eyebrow: string;
  /** 지도 출처 표기 */
  readonly credit: string;
  /** 명당 점 주변 링 (행 배치) — web `box-shadow: 0 0 0 4px` 의 색 */
  readonly dotRing: string;
  /** 명당 점 주변 링 (타일 배치) — web `box-shadow: 0 0 0 5px` 의 색 */
  readonly dotRingTiles: string;
  /** 내비 활성 탭의 inset 링 색 */
  readonly navActiveRing: string;
  /**
   * 지도 위 글자 — 티커 문구. 시트·카드가 아니라 **지도** 위에 놓이므로 UI 테마가
   * 아니라 지도 팔레트의 명도를 따른다. 다크 지도(openfreemap dark, 배경 `#0c0c0c`)
   * 위에서는 다크 값, 라이트 지도(positron 재색칠, 배경 `#f7f7f7` —
   * `map-style` `LIGHT_MAP_PALETTE.background`) 위에서는 라이트 값(C2).
   * `liveText`·`credit`·`tickerTextShadow` 도 같은 묶음이다.
   */
  readonly mapFg: string;
  /** 지도 위 보조 글자 — 티커 배지 */
  readonly mapFg2: string;
  /** 나침반 바늘 꼬리(남쪽). 다크 `#e8eaed` 는 데모 아이콘 고유색 */
  readonly compassTail: string;
};

/**
 * web 전용 그림자. RN 은 다층 그림자를 표현하지 못해 CSS 로만 있다
 * (`+html.tsx` 가 CSS 변수로 내보낸다). 네이티브 근사는 `theme.ts` 의
 * `ELEVATION`.
 */
export type ThemeShadows = {
  /** 데모 `--shadow`. 상단바·컨트롤·둥근 버튼·캘린더 버튼 */
  readonly shadow: string;
  /** 데모 `.sheet` */
  readonly sheetShadow: string;
  /** 데모 `.nav` */
  readonly navShadow: string;
  /** 선택 핀 `filter: drop-shadow(...)` 의 인자 */
  readonly pinShadow: string;
  /** 티커 문구 `text-shadow` — 지도 위 글자의 후광 */
  readonly tickerTextShadow: string;
};

export type ThemePalette = {
  readonly mode: ThemeMode;
  readonly colors: ThemeColors;
  readonly shadows: ThemeShadows;
};

/**
 * 다크 — 데모 원본. 값 불변.
 */
export const DARK_COLORS: ThemeColors = {
  /** rgb(24,24,28) 베이스 */
  bg: '#18181c',
  /** rgb(32,32,36) 카드 */
  surface: '#202024',
  /** rgb(242,244,246) 본문 */
  fg: '#f2f4f6',
  /** rgb(158,164,173) 보조 */
  fg2: '#9ea4ad',
  /** rgb(110,116,127) 캡션 */
  fg3: '#6e747f',
  /** rgb(41,124,255) 블루 CTA */
  accent: '#297cff',
  line: 'rgba(46,46,52,.9)',
  line2: 'rgba(57,57,64,.7)',
  glass: 'rgba(24,24,28,.8)',
  ctrlHover: '#242429',
  spotHover: '#26262b',
  segActive: 'rgba(242,244,246,.10)',
  grab: '#3a3a41',
  live: '#ff3b3b',
  liveText: '#ff5b5b',
  eyebrow: '#4d94ff',
  credit: 'rgba(255,255,255,.35)',
  dotRing: 'rgba(255,255,255,.06)',
  dotRingTiles: 'rgba(255,255,255,.07)',
  navActiveRing: 'rgba(242,244,246,.5)',
  /** = fg. 데모 `.ticker` 는 `--fg` 를 쓴다 */
  mapFg: '#f2f4f6',
  /** = fg2. 데모 `.ticker .badge` */
  mapFg2: '#9ea4ad',
  compassTail: '#e8eaed',
};

export const DARK_SHADOWS: ThemeShadows = {
  shadow: 'rgba(0,0,0,.2) 0 1px 1px, rgba(0,0,0,.28) 0 4px 12px',
  sheetShadow: 'rgba(0,0,0,.24) 0 -1px 4px, rgba(0,0,0,.4) 0 -10px 30px',
  navShadow: 'rgba(46,46,52,.55) 0 0 2px 1px, rgba(0,0,0,.45) 0 6px 20px',
  pinShadow: '0 4px 10px rgba(0,0,0,.6)',
  tickerTextShadow: '0 1px 6px rgba(0,0,0,.9)',
};

export const DARK_PALETTE: ThemePalette = {
  mode: 'dark',
  colors: DARK_COLORS,
  shadows: DARK_SHADOWS,
};

/**
 * 라이트 — **초안** (C1, 2026-09-03). 다크에서 역할 단위로 대응해 만들었다.
 *
 * 규칙
 *   · 역할이 같으면 밝은 배경에서 같은 대비 순서를 갖는다 — fg > fg2 > fg3,
 *     surface 는 bg 보다 한 단계 떠 있다(다크에서 surface 가 bg 보다 밝은 것과 같은 방향).
 *   · 채도 낮은 차가운 회색만 쓴다. 기준 잉크는 `#1a1b1f`(fg) 이고, 반투명
 *     토큰은 모두 이 잉크의 알파로 만든다(다크가 `#f2f4f6`·흰색의 알파를 쓰는 것과 대칭).
 *   · `accent #297cff` 는 유지(흰 글자 대비 3.9:1 — 15px/500 CTA 에만).
 *     accent 를 12px 에 쓰는 `eyebrow` 는 한 단계 어두운 `#1d5fd0`(bg 대비 5.4:1).
 *   · 소형 텍스트(fg2·fg3·eyebrow)는 bg 위에서 4.5:1 이상.
 *     다크의 fg3 는 3.8:1 이지만 데모 원본이라 그대로 두었다.
 *   · **지도 위 요소**(`mapFg`·`mapFg2`·`liveText`·`credit`·`tickerTextShadow`)는
 *     UI 테마가 아니라 지도의 명도를 따른다. C2 부터 라이트 테마는 라이트 지도
 *     (positron 재색칠, 배경 `#f7f7f7`)를 쓰므로 그 배경 기준으로 값을 정했다 —
 *     아래 각 토큰 주석의 대비 비율은 `#f7f7f7` 위 값이다. 지도 위 글자는 물·공원·
 *     도로 위에도 놓이므로 배경 대비만으로는 부족하고, 후광(`tickerTextShadow`)이
 *     그 차이를 메운다.
 *
 * 대응표(대비 비율 포함)는 PR 본문과 `test/tokens.parity.test.ts` 에 있다.
 * 사용자가 PR 스크린샷으로 확인하고 값을 조정한 뒤 확정한다.
 */
export const LIGHT_COLORS: ThemeColors = {
  /** rgb(245,246,248) 베이스 — 차가운 아주 밝은 회색 */
  bg: '#f5f6f8',
  /** rgb(255,255,255) 카드 — 베이스 위로 한 단계 */
  surface: '#ffffff',
  /** rgb(26,27,31) 본문 — 다크 bg 와 같은 색조의 잉크 */
  fg: '#1a1b1f',
  /** rgb(75,82,92) 보조. bg 대비 7.3:1 — 설명·요약 15px 본문이라 fg3 와 위계를 벌렸다 */
  fg2: '#4b525c',
  /** rgb(102,109,120) 캡션 */
  fg3: '#666d78',
  /** 다크와 같다 */
  accent: '#297cff',
  line: 'rgba(26,27,31,.10)',
  line2: 'rgba(26,27,31,.16)',
  /** bg 의 .8 — 다크 glass 가 bg 의 .8 인 것과 같다 */
  glass: 'rgba(245,246,248,.8)',
  /** bg 를 한 단계 어둡게 — 다크 ctrlHover 가 bg 를 한 단계 밝힌 것과 같은 방향 */
  ctrlHover: '#e9ebef',
  /** surface 를 한 단계 어둡게 */
  spotHover: '#f3f4f7',
  /** fg 의 .08 — 다크 segActive 가 fg 의 .10 */
  segActive: 'rgba(26,27,31,.08)',
  grab: '#c9ccd3',
  /** 지시등 — 두 테마 같다(텍스트가 아니다) */
  live: '#ff3b3b',
  /** 지도 위 실시간 머리글. 다크 `#ff5b5b` 는 `#f7f7f7` 위 2.8:1 이라 어둡게 — 5.1:1 */
  liveText: '#c92a2a',
  /** accent 한 단계 어둡게. bg 대비 5.4:1 */
  eyebrow: '#1d5fd0',
  /** 지도 출처 표기 — 잉크의 알파. `#f7f7f7` 위 합성색 `#727375`, 4.4:1 (다크는 3.2:1) */
  credit: 'rgba(26,27,31,.6)',
  dotRing: 'rgba(26,27,31,.06)',
  dotRingTiles: 'rgba(26,27,31,.07)',
  navActiveRing: 'rgba(26,27,31,.22)',
  /** 지도 위 티커 문구 = fg. `#f7f7f7` 위 16.1:1 */
  mapFg: '#1a1b1f',
  /** 지도 위 티커 배지 = fg2. `#f7f7f7` 위 7.4:1 */
  mapFg2: '#4b525c',
  /** 나침반 꼬리 — 컨트롤(surface `#ffffff`) 위 회색. 그래픽이라 3:1 근처면 충분 — 3.4:1 */
  compassTail: '#7d838d',
};

/** 밝은 배경에서 같은 기하(offset·blur)에 알파만 낮췄다. */
export const LIGHT_SHADOWS: ThemeShadows = {
  shadow: 'rgba(0,0,0,.06) 0 1px 1px, rgba(0,0,0,.10) 0 4px 12px',
  sheetShadow: 'rgba(0,0,0,.06) 0 -1px 4px, rgba(0,0,0,.12) 0 -10px 30px',
  navShadow: 'rgba(26,27,31,.12) 0 0 2px 1px, rgba(0,0,0,.14) 0 6px 20px',
  pinShadow: '0 4px 10px rgba(0,0,0,.35)',
  /** 지도 위 글자의 후광 — 어두운 글자(mapFg)를 밝은 지도에서 띄우는 흰 후광. 기하는 다크와 같다 */
  tickerTextShadow: '0 1px 6px rgba(255,255,255,.9)',
};

export const LIGHT_PALETTE: ThemePalette = {
  mode: 'light',
  colors: LIGHT_COLORS,
  shadows: LIGHT_SHADOWS,
};

export const PALETTES: Readonly<Record<ThemeMode, ThemePalette>> = {
  light: LIGHT_PALETTE,
  dark: DARK_PALETTE,
};

export const RADII = {
  /** 데모의 `9999px` — 완전한 pill */
  pill: 9999,
  card: 12,
  info: 8,
  sheet: 16,
} as const;

export type ThemeRadii = typeof RADII;

export const SIZES = {
  /** 중앙 컬럼 폭. 시트·컨트롤 정렬 기준. 데모 `--col:560px`. */
  column: 560,
  /** 컬럼 좌우 여백. 데모 `calc(100% - 32px)` 의 32px. */
  gutter: 16,
  /** 시트 높이. 데모 `--sheet-h:45vh`. */
  sheetHeightRatio: 0.45,
  /** 접힌 시트에서 남는 높이. 데모 `translateY(calc(100% - 68px))`. */
  sheetCollapsedPeek: 68,
  /** 티커를 시트 위로 띄우는 기본 높이. 데모 `bottom: calc(var(--sheet-h) + 20px)`. */
  tickerGap: 20,
  topbarHeight: 48,
  controlSize: 44,
  reportHeight: 48,
  navHeight: 50,
  navButton: 50,
} as const;

export type ThemeSizes = typeof SIZES;

/**
 * 알약형 2단계(DS3, 분석 2026-09-08) — `docs/TODO.md` "DS3" 절의 확정 규격.
 * 항목별로 눈으로 맞춘 값(좌우패딩 5가지·테두리 2가지·높이 두 갈래)을 이 두 값으로
 * 대체한다. `badge`·`chip` 은 `components/valley/Pill.tsx` 의 공유 컴포넌트가 쓴다 —
 * 새 알약을 만들 때 이 값을 다시 베끼지 말고 그 컴포넌트를 쓴다.
 */
export const PILL = {
  /** 읽는 것(상태) — 배지. 색은 호출부가 넘긴다(경보·그늘·유형색은 의미가 있는 색). */
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    gap: 4,
  },
  /** 누르는 것(조작) — 칩. 높이는 내용이 아니라 고정값이다. */
  chip: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
    height: 32,
    borderWidth: 1,
    gap: 7,
  },
} as const;

export type ThemePill = typeof PILL;

/** 카드 패딩 통일값(DS3). 반경·테두리·배경은 DS1 이라 여기 없다. */
export const CARD = {
  padding: 13,
} as const;

export type ThemeCard = typeof CARD;
