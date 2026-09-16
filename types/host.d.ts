/**
 * DOM 없는 패키지들이 호스트 런타임에 요구하는 최소 전역.
 *
 * 코어는 `lib: ["DOM"]` 을 켜지 않는다. 켜면 `document`·`window` 가 타입에
 * 잡혀, 플랫폼 무관 계층에 브라우저 API 가 슬그머니 섞여도 컴파일이 통과한다.
 * 대신 실제로 쓰는 전역만 여기에 선언한다 — web / android / ios 세 런타임이
 * 모두 제공하는 것들이다.
 *
 * `lib: ["DOM"]` 을 켜지 않는 패키지(core, map-style, adapter-native)의
 * tsconfig `include` 에만 들어간다. 코어를 소스로 가져다 쓰는 쪽(app,
 * adapter-web)은 자기 lib(DOM / react-native)로 같은 전역을 해석하므로
 * 중복 선언이 생기지 않는다.
 *
 * 세 패키지가 같은 파일을 가리키므로 선언이 갈라질 수 없다.
 */

interface HostConsole {
  log(message?: unknown, ...optional: unknown[]): void;
  info(message?: unknown, ...optional: unknown[]): void;
  warn(message?: unknown, ...optional: unknown[]): void;
  error(message?: unknown, ...optional: unknown[]): void;
}
declare const console: HostConsole;

/** 런타임마다 number(브라우저)와 객체(Node)로 갈리므로 불투명하게 둔다. */
type HostTimerHandle = unknown;
declare function setTimeout(handler: () => void, timeoutMs: number): HostTimerHandle;
declare function clearTimeout(handle: HostTimerHandle): void;
declare function setInterval(handler: () => void, periodMs: number): HostTimerHandle;
declare function clearInterval(handle: HostTimerHandle): void;

interface HostPerformance {
  now(): number;
}
declare const performance: HostPerformance;
