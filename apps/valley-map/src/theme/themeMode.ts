/**
 * 빌드 시점에 정해지는 테마 모드 — **사용자 선택이 없을 때의 기본**.
 *
 * `EXPO_PUBLIC_THEME=light|dark` 는 개발용 강제 수단이다(파리티 검증은 저장값이 없는
 * 상태에서 다크를 강제해 수행한다). 저장된 사용자 선택(C9, `STORAGE_KEYS.themeMode`)이
 * 있으면 그것이 이긴다 — `ThemeProvider` 의 결정 순서 참고. babel-preset-expo 가 `EXPO_PUBLIC_*` 를 번들에 인라인하므로
 * 모듈 상수로 한 번만 읽는다. `ThemeProvider` 와 web 문서 셸(`+html.tsx`)이 같은
 * 값을 보게 하는 것이 이 파일의 유일한 목적이다 — 둘이 어긋나면 첫 페인트의
 * CSS 변수와 RN 스타일이 다른 팔레트를 그린다.
 *
 * 순수 TS 다(react-native import 없음) — 정적 렌더의 Node 컨텍스트에서도 읽힌다.
 */
import { parseThemeMode, type ThemeMode } from './tokens';

export const ENV_THEME_MODE: ThemeMode = parseThemeMode(process.env.EXPO_PUBLIC_THEME);
