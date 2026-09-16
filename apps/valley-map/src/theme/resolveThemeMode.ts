/**
 * 테마 선택(`light | dark | system`) → 팔레트(`light | dark`) (C9).
 *
 * `system` 은 기기 설정(`useColorScheme`)으로 푼다. 기기 설정을 모르는 환경(정적 렌더,
 * `null`/`'unspecified'`)은 라이트 — D1 기본과 같다. 순수 TS 라 vitest 가 RN 없이 검증한다.
 * `ThemeProvider` 의 결정 순서(세션 선택 → 저장값 → env → 라이트)는 그 파일 머리말에 있다.
 */
import type { ThemeMode as ThemePreference } from '@modu-valley/core';
import type { ThemeMode } from './tokens';

/** RN `ColorSchemeName` 과 같은 모양 — react-native 를 import 하지 않기 위해 여기서 적는다. */
export type DeviceColorScheme = 'light' | 'dark' | 'unspecified' | null | undefined;

export function resolveThemeMode(
  preference: ThemePreference,
  colorScheme: DeviceColorScheme,
): ThemeMode {
  if (preference === 'system') return colorScheme === 'dark' ? 'dark' : 'light';
  return preference;
}

/**
 * 선택 후보를 우선순위대로 받아 첫 번째 있는 것을 고른다 — `ThemeProvider` 의
 * "세션 선택 → 저장값 → env 기본" 줄 한 곳에서 쓴다.
 */
export function pickThemePreference(
  sessionPreference: ThemePreference | null,
  storedPreference: ThemePreference | null | undefined,
  fallback: ThemePreference,
): ThemePreference {
  return sessionPreference ?? storedPreference ?? fallback;
}
