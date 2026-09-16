/**
 * TS 토큰 → CSS 커스텀 프로퍼티.
 *
 * web 문서 셸(`app/+html.tsx`)의 전역 CSS 는 RN 스타일로 표현할 수 없는 것
 * (다층 그림자·hover·inset 링·후광)만 담는데, 그 안의 색이 토큰과 따로 살면
 * 진실이 둘이 된다. 여기서 팔레트를 `--mv-*` 변수 블록으로 내보내고 CSS 는
 * 변수만 참조한다.
 *
 * 변수 이름은 토큰 키의 kebab-case 다: `ctrlHover → --mv-ctrl-hover`,
 * `shadow → --mv-shadow`(이전 리터럴과 같은 이름).
 *
 * 순수 TS — 정적 렌더(Node)와 vitest 양쪽에서 실행된다.
 */
import {
  DEFAULT_THEME_MODE,
  PALETTES,
  type ThemeColors,
  type ThemeMode,
  type ThemePalette,
  type ThemeShadows,
} from './tokens';

export type CssToken = keyof ThemeColors | keyof ThemeShadows;

const PREFIX = '--mv-';

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`);
}

/** `--mv-ctrl-hover` */
export function cssVarName(token: CssToken): string {
  return `${PREFIX}${kebab(token)}`;
}

/** `var(--mv-ctrl-hover)` — CSS 본문에서 쓰는 참조. */
export function cssVar(token: CssToken): string {
  return `var(${cssVarName(token)})`;
}

/** 팔레트 하나의 선언 목록. `--mv-bg:#18181c;` 형태의 줄들. */
export function paletteCssDeclarations(palette: ThemePalette): string {
  const entries: Array<[string, string]> = [
    ...Object.entries(palette.colors),
    ...Object.entries(palette.shadows),
  ];
  return entries.map(([token, value]) => `  ${PREFIX}${kebab(token)}:${value};`).join('\n');
}

/**
 * 테마별 `:root` 블록.
 *
 *   :root { …기본 모드… }
 *   :root[data-theme="light"] { … }
 *   :root[data-theme="dark"] { … }
 *
 * `data-theme` 는 `+html.tsx` 가 빌드 시점 모드로 찍고 `ThemeProvider` 가 런타임에
 * 같은 값으로 유지한다. 속성 선택자가 없는 `:root` 블록은 속성이 빠진 경우의
 * 안전망이다.
 */
export function themeCssVariableBlocks(): string {
  const modes: readonly ThemeMode[] = ['light', 'dark'];
  const base = `:root{\n${paletteCssDeclarations(PALETTES[DEFAULT_THEME_MODE])}\n}`;
  const perMode = modes.map(
    (mode) => `:root[data-theme="${mode}"]{\n${paletteCssDeclarations(PALETTES[mode])}\n}`,
  );
  return [base, ...perMode].join('\n');
}
