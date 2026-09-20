/**
 * 외부 지도 길찾기 URL.
 *
 * 사용자가 지도 앱을 고른다 — 네이버·카카오·구글. 셋 다 웹 URL 이므로 앱 설치
 * 여부와 관계없이 열린다. 앱이 설치돼 있으면 모바일에서 각 사가 자기 앱으로
 * 넘긴다. 좌표 순서는 각 URL 규약을 따른다(GeoJSON 의 lng,lat 과 다른 곳이 있다).
 */
import type { LngLat } from '@modu-valley/core';

type Destination = Pick<LngLat, 'lng' | 'lat'>;

export type DirectionsProvider = {
  id: 'naver' | 'kakao' | 'google';
  /** 버튼에 쓰는 짧은 이름. 좁은 화면에서 한 줄에 들어가야 한다. */
  label: string;
  /** 스크린 리더용 전체 이름. */
  name: string;
  url: (destination: Destination, name: string) => string;
};

/** 선택 화면이 없는 곳(보존된 네이티브 화면)의 기본 지도. */
export function directionsUrl(destination: Destination): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}&travelmode=driving`;
}

export const DIRECTIONS_PROVIDERS: DirectionsProvider[] = [
  {
    id: 'naver',
    label: '네이버',
    name: '네이버 지도',
    // /p/directions/{출발}/{도착}/{경유}/{수단}, 장소는 lng,lat,이름
    url: (destination, name) =>
      `https://map.naver.com/p/directions/-/${destination.lng.toFixed(6)},${destination.lat.toFixed(6)},${encodeURIComponent(name)}/-/car`,
  },
  {
    id: 'kakao',
    label: '카카오',
    name: '카카오맵',
    url: (destination, name) =>
      `https://map.kakao.com/link/to/${encodeURIComponent(name)},${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`,
  },
  {
    id: 'google',
    label: '구글',
    name: '구글 지도',
    url: (destination) => directionsUrl(destination),
  },
];
