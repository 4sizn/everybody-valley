/**
 * `Theme` — 토큰을 한 객체로 묶은 것.
 *
 * `tokens.ts` 의 순수 값(팔레트·반경·치수)에 플랫폼에 따라 갈리는 것(폰트
 * 스택·네이티브 그림자 근사)을 더해 컴포넌트가 읽는 최종 형태를 만든다.
 * 테마별로 다른 것은 `colors`·`shadows` 뿐이고 나머지는 두 테마가 같은 객체를
 * 공유한다 — 레이아웃 수치는 테마와 무관하다.
 *
 * 컴포넌트는 이 파일을 직접 import 하지 않고 `useTheme()` 로 받는다
 * (`ThemeProvider.tsx`). 정적 `StyleSheet` 의 레이아웃 수치에는 `RADII`·
 * `SIZES`·`FONT_FAMILY` 상수를 그대로 써도 된다 — 테마가 바뀌어도 변하지 않는
 * 값이기 때문이다.
 */
import { Platform, type ViewStyle } from 'react-native';
import {
  PALETTES,
  RADII,
  SIZES,
  type ThemeMode,
  type ThemePalette,
  type ThemeRadii,
  type ThemeSizes,
} from './tokens';

export type Theme = ThemePalette & {
  readonly radii: ThemeRadii;
  readonly sizes: ThemeSizes;
  readonly fontFamily: string;
  readonly elevation: ThemeElevation;
};

export type ThemeElevation = {
  readonly card: ViewStyle;
};

/**
 * 폰트 스택. web 은 데모와 같은 Pretendard CDN 을 `+html.tsx` 에서 불러온다.
 * 네이티브는 아직 폰트 파일을 담지 않아 시스템 폰트로 떨어진다 — 그 사실을
 * 숨기지 않기 위해 플랫폼 분기를 여기 한 곳에만 둔다.
 */
export const FONT_FAMILY: string = Platform.select({
  web: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  default: 'System',
});

/**
 * 다층 그림자. 데모 `--shadow: rgba(0,0,0,.2) 0 1px 1px, rgba(0,0,0,.28) 0 4px 12px`.
 * RN 의 그림자 프로퍼티는 한 겹만 표현하므로 web 에서는 CSS 변수
 * (`ThemeShadows`)로, 네이티브에서는 근사값으로 간다.
 */
export const ELEVATION: ThemeElevation = {
  card: Platform.select<ViewStyle>({
    web: {},
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
  }),
};

function buildTheme(palette: ThemePalette): Theme {
  return {
    ...palette,
    radii: RADII,
    sizes: SIZES,
    fontFamily: FONT_FAMILY,
    elevation: ELEVATION,
  };
}

/** 모드별 테마. 객체 참조가 고정돼 있어 테마 단위 캐시 키로 쓸 수 있다. */
export const THEMES: Readonly<Record<ThemeMode, Theme>> = {
  light: buildTheme(PALETTES.light),
  dark: buildTheme(PALETTES.dark),
};
