/**
 * 외부 지도 길찾기 URL.
 *
 * 세 플랫폼에서 같은 링크가 열려야 한다 — 구글 지도의 universal URL 은 web 에서
 * 새 탭, iOS/Android 에서 앱 또는 브라우저로 열린다. 국내 지도(카카오·네이버)의
 * 앱 스킴은 설치 여부에 따라 실패하므로 첫 버전에서는 쓰지 않는다.
 * 좌표 순서는 URL 규약대로 `lat,lng` 다(GeoJSON 의 반대).
 */
import type { LngLat } from '@modu-valley/core';

export function directionsUrl(destination: LngLat): string {
  const target = `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${target}&travelmode=driving`;
}
