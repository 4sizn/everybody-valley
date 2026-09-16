/**
 * 테마 배선 — `ThemeProvider` 가 모드를 정하고, 컴포넌트는 `useTheme()` 로 읽는다.
 *
 * 모드 결정 순서 (C9)
 *   1. `mode` prop (테스트·스토리용) — 팔레트를 직접 고정한다
 *   2. 세션이 알려 준 **사용자 선택**(`AppState.themeMode`, 설정 면에서 바뀐다)
 *   3. 앱 시작 시 저장소에서 읽은 **저장된 선택**(`useStoredThemeMode`) — 세션이 생기기 전 첫 페인트용
 *   4. `EXPO_PUBLIC_THEME=light|dark` (개발용 강제 수단 — 파리티 검증은 저장값 없는 상태에서 다크를 강제한다)
 *   5. `DEFAULT_THEME_MODE` (D1: 라이트)
 * 2~5 는 `light | dark | system` 선택이고, `system` 은 `useColorScheme()`(기기 설정)으로 푼다.
 * 저장된 사용자 선택이 있으면 env 를 이긴다 — env 는 "선택이 없을 때의 기본"이다.
 *
 * 세션과의 관계 — 진실은 세션(`MapSession.setThemeMode` → 저장 → 상태)이고, 이 Provider 는
 * 세션 바깥에 있어 그 상태를 직접 구독할 수 없다. `SessionProvider` 가 세션의 `themeMode` 를
 * `useThemePreference().setPreference` 로 밀어 넣는 다리다. 선택이 바뀌어 팔레트가 갈리면
 * `SessionProvider` 의 `styleMode` 가 바뀌어 세션(지도)이 다시 만들어진다 — 결정 (d).
 *
 * web 에서는 문서 루트의 `data-theme` 를 같은 값으로 맞춘다 — `+html.tsx` 가
 * 테마별 CSS 변수 블록을 `:root[data-theme="…"]` 선택자로 내보내므로, RN 스타일
 * 밖의 CSS(그림자·hover·링)도 같은 팔레트를 본다. 정적 렌더 시점에는
 * `+html.tsx` 가 같은 env 로 초기값을 찍어 두고, 저장값이 있으면 인라인 스크립트가
 * 첫 페인트 전에 덮어 첫 프레임이 어긋나지 않는다.
 *
 * `createThemedStyles` 에 대하여 — 색은 `StyleSheet.create` 를 **통해서** 적용해야
 * 한다. react-native-web 은 `StyleSheet.create` 로 등록된 스타일만 CSS 클래스로
 * 내보내고 그 밖의 객체는 inline style 로 붙이는데, inline 은 `+html.tsx` 의
 * `[data-mv="…"]:hover { background-color }` 를 이겨 버려 hover 배경이 사라진다.
 * 그래서 테마별로 한 번씩만 `StyleSheet.create` 를 부르고 결과를 캐시한다.
 */
import { ConsoleLogger, type Logger, type ThemeMode as ThemePreference } from '@modu-valley/core';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { pickThemePreference, resolveThemeMode } from './resolveThemeMode';
import { THEMES, type Theme } from './theme';
import { ENV_THEME_MODE } from './themeMode';
import type { ThemeMode } from './tokens';
import { useStoredThemeMode } from './useStoredThemeMode';

const ThemeContext = createContext<Theme | null>(null);

const logger: Logger = new ConsoleLogger('valley').child('theme');

/** 사용자 선택(`light | dark | system`)과 그것을 바꾸는 손잡이. 세션 다리(`SessionProvider`)가 쓴다. */
export type ThemePreferenceHandle = {
  readonly preference: ThemePreference;
  readonly setPreference: (next: ThemePreference) => void;
  /**
   * 저장된 선택을 읽었는가. 읽기 전의 `preference` 는 env 기본이라 임시값이다 — 지도 엔진처럼
   * 만드는 비용이 큰 것은 이 값이 참이 된 뒤에 만든다(첫 프레임에 라이트 엔진을 만들고 바로
   * 버리는 낭비를 막는다). `mode` prop 이 있으면 항상 참.
   */
  readonly ready: boolean;
};

const ThemePreferenceContext = createContext<ThemePreferenceHandle | null>(null);

export type ThemeProviderProps = {
  /** 지정하면 선택·저장값·env 를 모두 무시하고 이 팔레트로 고정한다. */
  readonly mode?: ThemeMode;
  readonly children: ReactNode;
};

export function ThemeProvider({ mode, children }: ThemeProviderProps) {
  const stored = useStoredThemeMode();
  // 세션이 알려 준 선택. 세션이 아직 없거나 아무 말도 하지 않았으면 null.
  const [sessionPreference, setSessionPreference] = useState<ThemePreference | null>(null);
  const colorScheme = useColorScheme();

  const preference = pickThemePreference(sessionPreference, stored, ENV_THEME_MODE);
  const theme = THEMES[mode ?? resolveThemeMode(preference, colorScheme)];

  const ready = mode !== undefined || stored !== undefined;
  const handle = useMemo<ThemePreferenceHandle>(
    () => ({ preference, setPreference: setSessionPreference, ready }),
    [preference, ready],
  );

  // 해석 결과가 바뀔 때마다 한 줄 — 세션 재생성(결정 (d))의 원인을 로그에서 따라갈 수 있게.
  useEffect(() => {
    logger.debug('테마 해석', {
      resolved: theme.mode,
      preference,
      colorScheme: colorScheme ?? null,
      stored: stored ?? null,
      sessionPreference,
    });
  }, [theme.mode, preference, colorScheme, stored, sessionPreference]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme.mode;
  }, [theme.mode]);

  return (
    <ThemePreferenceContext.Provider value={handle}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </ThemePreferenceContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error('useTheme 은 ThemeProvider 안에서만 쓸 수 있다');
  }
  return theme;
}

/** 현재 선택과 그것을 바꾸는 손잡이. 화면은 `useAppState(s => s.themeMode)` 를 읽고, 이 훅은 세션 다리용이다. */
export function useThemePreference(): ThemePreferenceHandle {
  const handle = useContext(ThemePreferenceContext);
  if (handle === null) {
    throw new Error('useThemePreference 은 ThemeProvider 안에서만 쓸 수 있다');
  }
  return handle;
}

type NamedStyles<T> = { readonly [K in keyof T]: StyleSheet.NamedStyles<T>[K] };

/**
 * 테마에서 파생되는 스타일 훅을 만든다.
 *
 *   const useThemedStyles = createThemedStyles((theme) => ({
 *     sheet: { backgroundColor: theme.colors.bg },
 *   }));
 *   …
 *   const themed = useThemedStyles();
 *   <View style={[styles.sheet, themed.sheet]} />
 *
 * 레이아웃 수치는 정적 `StyleSheet` 에 그대로 두고, 여기에는 색만 담는다.
 * 팩토리는 테마마다 한 번만 불린다(모듈 상수인 테마 객체를 키로 캐시).
 */
export function createThemedStyles<T extends NamedStyles<T>>(
  factory: (theme: Theme) => T,
): () => T {
  const cache = new WeakMap<Theme, T>();
  return function useThemedStyles(): T {
    const theme = useTheme();
    const cached = cache.get(theme);
    if (cached !== undefined) return cached;
    const created = StyleSheet.create(factory(theme));
    cache.set(theme, created);
    return created;
  };
}
