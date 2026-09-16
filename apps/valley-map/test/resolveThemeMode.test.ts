/**
 * 테마 선택 → 팔레트 (C9). `ThemeProvider` 의 결정 순서 중 순수한 부분을 고정한다 —
 * 저장된 사용자 선택이 env 를 이기고, `system` 은 기기 설정으로 풀리며, 모르면 라이트(D1).
 */
import { describe, expect, it } from 'vitest';
import { pickThemePreference, resolveThemeMode } from '../src/theme/resolveThemeMode';
import { parseThemeMode } from '../src/theme/tokens';

describe('resolveThemeMode', () => {
  it('라이트·다크는 그대로', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('system 은 기기 설정을 따르고, 모르면 라이트(D1)', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode('system', 'unspecified')).toBe('light');
    expect(resolveThemeMode('system', null)).toBe('light');
    expect(resolveThemeMode('system', undefined)).toBe('light');
  });
});

describe('pickThemePreference — 세션 선택 → 저장값 → 기본(env → 라이트)', () => {
  const envDark = parseThemeMode('dark');
  const envUnset = parseThemeMode(undefined);

  it('저장된 사용자 선택이 개발용 강제 env 를 이긴다', () => {
    expect(pickThemePreference(null, 'light', envDark)).toBe('light');
    expect(pickThemePreference(null, 'system', envDark)).toBe('system');
  });

  it('저장값이 없으면(파리티 검증 상태) env, env 도 없으면 라이트', () => {
    expect(pickThemePreference(null, null, envDark)).toBe('dark');
    expect(pickThemePreference(null, undefined, envDark)).toBe('dark');
    expect(pickThemePreference(null, null, envUnset)).toBe('light');
  });

  it('세션이 알려 준 선택(설정 면)이 시작 시 읽은 저장값보다 우선한다', () => {
    expect(pickThemePreference('dark', 'light', envUnset)).toBe('dark');
  });
});
