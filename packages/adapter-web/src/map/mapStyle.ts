/**
 * web 쪽 스타일 경계.
 *
 * 스타일 상수 자체는 `@modu-valley/map-style` 에 있다 — 네이티브와 **같은
 * 값**을 읽어야 파리티가 갈라지지 않는다. 이 파일에는 maplibre-gl 타입으로
 * 건너오는 변환만 남긴다.
 */
import type { LngLat } from '@modu-valley/core';

/**
 * 도메인 `LngLat` → maplibre 의 `LngLatLike`.
 *
 * 코어의 튜플은 readonly 다(값 객체가 밖에서 변형되지 않게). maplibre 는
 * 가변 배열을 요구하므로 경계에서 사본을 만든다. 이 변환이 한 군데에만
 * 있어야 "코어 타입이 왜 여기서 풀리는가"를 추적할 수 있다.
 */
export function toLngLatLike(position: LngLat): [number, number] {
  return [position.lng, position.lat];
}
