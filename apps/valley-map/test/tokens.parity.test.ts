/**
 * 토큰 파리티 — 다크 `Theme` 의 모든 색·반경·치수가 C1 이전의
 * `COLORS`/`RADII`/`SIZES` 값(= 데모 `:root` + 데모 CSS 본문)과 같음을 고정한다.
 *
 * 아래 스냅샷은 C1 착수 직전 `tokens.ts`(커밋 8f5660b)와 `+html.tsx` 의 CSS
 * 리터럴을 그대로 옮긴 것이다. 이 테스트가 깨지면 파리티가 깨진 것이다 —
 * 값을 바꿔야 한다면 데모 HTML·`docs/PARITY.md` 와 함께 고친다.
 */
import { LIGHT_MAP_PALETTE } from '@modu-valley/map-style';
import { describe, expect, it } from 'vitest';
import {
  cssVar,
  cssVarName,
  paletteCssDeclarations,
  themeCssVariableBlocks,
} from '../src/theme/cssVariables';
import {
  DARK_COLORS,
  DARK_PALETTE,
  DARK_SHADOWS,
  DEFAULT_THEME_MODE,
  LIGHT_COLORS,
  LIGHT_PALETTE,
  LIGHT_SHADOWS,
  parseThemeMode,
  RADII,
  SIZES,
} from '../src/theme/tokens';

/** C1 이전 `COLORS` (apps/valley-map/src/theme/tokens.ts @ 8f5660b). */
const LEGACY_COLORS = {
  bg: '#18181c',
  surface: '#202024',
  fg: '#f2f4f6',
  fg2: '#9ea4ad',
  fg3: '#6e747f',
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
} as const;

/** C1 이전 `+html.tsx` 의 CSS 리터럴 중 토큰 이름을 새로 얻은 색. */
const LEGACY_CSS_COLORS = {
  dotRing: 'rgba(255,255,255,.06)',
  dotRingTiles: 'rgba(255,255,255,.07)',
  navActiveRing: 'rgba(242,244,246,.5)',
} as const;

/**
 * 역할을 분리해 이름을 새로 얻은 색. 값은 이전에 그 자리에 그려지던 것과 같다 —
 * 티커 문구는 `COLORS.fg`/`fg2`, 나침반 꼬리는 아이콘 리터럴 `#e8eaed`.
 */
const LEGACY_SPLIT_COLORS = {
  mapFg: LEGACY_COLORS.fg,
  mapFg2: LEGACY_COLORS.fg2,
  compassTail: '#e8eaed',
} as const;

/** C1 이전 `+html.tsx` 의 그림자 리터럴. */
const LEGACY_CSS_SHADOWS = {
  shadow: 'rgba(0,0,0,.2) 0 1px 1px, rgba(0,0,0,.28) 0 4px 12px',
  sheetShadow: 'rgba(0,0,0,.24) 0 -1px 4px, rgba(0,0,0,.4) 0 -10px 30px',
  navShadow: 'rgba(46,46,52,.55) 0 0 2px 1px, rgba(0,0,0,.45) 0 6px 20px',
  pinShadow: '0 4px 10px rgba(0,0,0,.6)',
  tickerTextShadow: '0 1px 6px rgba(0,0,0,.9)',
} as const;

const LEGACY_RADII = { pill: 9999, card: 12, info: 8, sheet: 16 } as const;

const LEGACY_SIZES = {
  column: 560,
  gutter: 16,
  sheetHeightRatio: 0.45,
  sheetCollapsedPeek: 68,
  tickerGap: 20,
  topbarHeight: 48,
  controlSize: 44,
  reportHeight: 48,
  navHeight: 50,
  navButton: 50,
} as const;

describe('다크 테마 — 데모 값 불변', () => {
  it('색은 이전 COLORS 와 한 글자도 다르지 않다', () => {
    expect(DARK_COLORS).toEqual({ ...LEGACY_COLORS, ...LEGACY_CSS_COLORS, ...LEGACY_SPLIT_COLORS });
  });

  it('web 그림자는 이전 +html.tsx 리터럴과 같다', () => {
    expect(DARK_SHADOWS).toEqual(LEGACY_CSS_SHADOWS);
  });

  it('반경·치수는 이전 RADII/SIZES 와 같다', () => {
    expect(RADII).toEqual(LEGACY_RADII);
    expect(SIZES).toEqual(LEGACY_SIZES);
  });

  it('팔레트 객체는 모드 표식과 함께 같은 참조를 든다', () => {
    expect(DARK_PALETTE).toEqual({ mode: 'dark', colors: DARK_COLORS, shadows: DARK_SHADOWS });
  });
});

describe('라이트 테마 — 초안의 구조적 규칙', () => {
  it('다크와 같은 토큰 집합을 갖는다 (역할 단위 대응)', () => {
    expect(Object.keys(LIGHT_COLORS).sort()).toEqual(Object.keys(DARK_COLORS).sort());
    expect(Object.keys(LIGHT_SHADOWS).sort()).toEqual(Object.keys(DARK_SHADOWS).sort());
    expect(LIGHT_PALETTE.mode).toBe('light');
  });

  it('accent 는 두 테마가 같다', () => {
    expect(LIGHT_COLORS.accent).toBe(DARK_COLORS.accent);
  });

  it('bg 위 본문·보조·캡션의 대비 순서는 fg > fg2 > fg3 이고, 소형 텍스트는 4.5:1 이상', () => {
    const on = (fg: string) => contrastRatio(fg, LIGHT_COLORS.bg);
    expect(on(LIGHT_COLORS.fg)).toBeGreaterThan(on(LIGHT_COLORS.fg2));
    expect(on(LIGHT_COLORS.fg2)).toBeGreaterThan(on(LIGHT_COLORS.fg3));
    expect(on(LIGHT_COLORS.fg)).toBeGreaterThanOrEqual(7);
    expect(on(LIGHT_COLORS.fg2)).toBeGreaterThanOrEqual(4.5);
    expect(on(LIGHT_COLORS.fg3)).toBeGreaterThanOrEqual(4.5);
  });

  it('지도 위 토큰은 라이트 지도 배경(#f7f7f7) 위에서 읽힌다 (C2)', () => {
    const on = (fg: string) => contrastRatio(fg, LIGHT_MAP_PALETTE.background);
    expect(on(LIGHT_COLORS.mapFg)).toBeGreaterThanOrEqual(7);
    expect(on(LIGHT_COLORS.mapFg2)).toBeGreaterThanOrEqual(4.5);
    expect(on(LIGHT_COLORS.liveText)).toBeGreaterThanOrEqual(4.5);
    // credit 은 잉크의 알파 — 배경에 합성한 색으로 잰다.
    expect(on(composite(LIGHT_COLORS.credit, LIGHT_MAP_PALETTE.background))).toBeGreaterThanOrEqual(
      3,
    );
    // 후광은 글자와 반대 명도 — 어두운 글자에 흰 후광.
    expect(LIGHT_SHADOWS.tickerTextShadow).toContain('rgba(255,255,255');
    expect(DARK_SHADOWS.tickerTextShadow).toContain('rgba(0,0,0');
    // 다크 지도 위 토큰은 데모 값 그대로다(위 '다크 테마' 블록이 고정).
    expect(DARK_COLORS.mapFg).toBe(DARK_COLORS.fg);
  });

  it('나침반 꼬리는 라이트 컨트롤 배경 위에서 보인다 (3:1 이상)', () => {
    expect(contrastRatio(LIGHT_COLORS.compassTail, LIGHT_COLORS.bg)).toBeGreaterThanOrEqual(3);
  });

  it('eyebrow(12px 에 쓰는 accent) 는 accent 보다 어둡고 bg 대비 4.5:1 이상', () => {
    expect(luminance(LIGHT_COLORS.eyebrow)).toBeLessThan(luminance(LIGHT_COLORS.accent));
    expect(contrastRatio(LIGHT_COLORS.eyebrow, LIGHT_COLORS.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('surface 는 bg 보다 밝다 — 다크에서 surface 가 bg 보다 밝은 것과 같은 방향', () => {
    expect(luminance(LIGHT_COLORS.surface)).toBeGreaterThan(luminance(LIGHT_COLORS.bg));
    expect(luminance(DARK_COLORS.surface)).toBeGreaterThan(luminance(DARK_COLORS.bg));
  });
});

describe('CSS 변수 생성', () => {
  it('변수 이름은 토큰 키의 kebab-case 이고 --mv-shadow 는 이전 이름 그대로', () => {
    expect(cssVarName('bg')).toBe('--mv-bg');
    expect(cssVarName('fg2')).toBe('--mv-fg2');
    expect(cssVarName('ctrlHover')).toBe('--mv-ctrl-hover');
    expect(cssVarName('dotRingTiles')).toBe('--mv-dot-ring-tiles');
    expect(cssVarName('shadow')).toBe('--mv-shadow');
    expect(cssVarName('tickerTextShadow')).toBe('--mv-ticker-text-shadow');
    expect(cssVar('accent')).toBe('var(--mv-accent)');
  });

  it('다크 선언은 이전 +html.tsx 리터럴을 그대로 담는다', () => {
    const css = paletteCssDeclarations(DARK_PALETTE);
    expect(css).toContain('--mv-bg:#18181c;');
    expect(css).toContain('--mv-ctrl-hover:#242429;');
    expect(css).toContain('--mv-spot-hover:#26262b;');
    expect(css).toContain('--mv-shadow:rgba(0,0,0,.2) 0 1px 1px, rgba(0,0,0,.28) 0 4px 12px;');
    expect(css).toContain('--mv-nav-active-ring:rgba(242,244,246,.5);');
    // 색 17 + CSS 파생 3 + 역할 분리 3 + 그림자 5
    expect(css.split('\n')).toHaveLength(28);
  });

  it('테마 블록은 기본(라이트) :root 와 모드별 :root[data-theme] 를 낸다', () => {
    const blocks = themeCssVariableBlocks();
    expect(DEFAULT_THEME_MODE).toBe('light');
    expect(blocks.startsWith(`:root{\n${paletteCssDeclarations(LIGHT_PALETTE)}\n}`)).toBe(true);
    expect(blocks).toContain(
      `:root[data-theme="dark"]{\n${paletteCssDeclarations(DARK_PALETTE)}\n}`,
    );
    expect(blocks).toContain(
      `:root[data-theme="light"]{\n${paletteCssDeclarations(LIGHT_PALETTE)}\n}`,
    );
  });
});

describe('EXPO_PUBLIC_THEME 파서', () => {
  it('light|dark 만 받고 나머지는 기본 모드', () => {
    expect(parseThemeMode('dark')).toBe('dark');
    expect(parseThemeMode('light')).toBe('light');
    expect(parseThemeMode(undefined)).toBe(DEFAULT_THEME_MODE);
    expect(parseThemeMode('DARK')).toBe(DEFAULT_THEME_MODE);
    expect(parseThemeMode('')).toBe(DEFAULT_THEME_MODE);
  });
});

// ── WCAG 2.x 상대 명도·대비 (불투명 hex 전용) ─────────────────────────

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** `rgba(r,g,b,a)` 를 불투명 배경(hex) 위에 합성한 hex. */
function composite(rgba: string, bgHex: string): string {
  const match = /rgba\((\d+),(\d+),(\d+),(\.?\d*\.?\d+)\)/.exec(rgba.replace(/\s/g, ''));
  if (match === null) throw new Error(`rgba 가 아니다: ${rgba}`);
  const alpha = Number.parseFloat(match[4] ?? '1');
  const channel = (index: number, offset: number) => {
    const fg = Number.parseInt(match[index] ?? '0', 10);
    const bg = Number.parseInt(bgHex.slice(offset, offset + 2), 16);
    return Math.round(fg * alpha + bg * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1, 1)}${channel(2, 3)}${channel(3, 5)}`;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
