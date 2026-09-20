import { describe, expect, it } from 'vitest';
import { DIRECTIONS_PROVIDERS } from '../src/components/valley/directions';

const destination = { lng: 126.979728, lat: 35.161959 };

describe('DIRECTIONS_PROVIDERS', () => {
  it('네이버는 lng,lat 순서로 도착지를 넣는다', () => {
    const url = DIRECTIONS_PROVIDERS.find((p) => p.id === 'naver')?.url(destination, '문정휴게소');
    expect(url).toBe(
      'https://map.naver.com/p/directions/-/126.979728,35.161959,%EB%AC%B8%EC%A0%95%ED%9C%B4%EA%B2%8C%EC%86%8C/-/car',
    );
  });

  it('카카오는 이름,lat,lng 순서로 도착지를 넣는다', () => {
    const url = DIRECTIONS_PROVIDERS.find((p) => p.id === 'kakao')?.url(destination, '문정휴게소');
    expect(url).toBe(
      'https://map.kakao.com/link/to/%EB%AC%B8%EC%A0%95%ED%9C%B4%EA%B2%8C%EC%86%8C,35.161959,126.979728',
    );
  });

  it('구글은 lat,lng 좌표만 쓴다', () => {
    const url = DIRECTIONS_PROVIDERS.find((p) => p.id === 'google')?.url(destination, '문정휴게소');
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=35.161959,126.979728&travelmode=driving',
    );
  });
});
