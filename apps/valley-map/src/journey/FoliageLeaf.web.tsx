/**
 * 단풍 단계를 잎 색으로 — 단풍 전 초록, 물들기 노랑, 절정 빨강, 낙엽 갈색, 종료·자료 없음 회색.
 * UI 라이브러리 아이콘 세트에 잎이 없고 `Metric` 은 아이콘 색을 못 바꿔서, 같은 `mv-metric` 격자에
 * 잎 SVG 만 직접 그린다. 색은 단계 의미색이라 테마 토큰이 아니라 고정값이다(다크에서도 같은 뜻).
 */
import type { FoliageStage } from '@modu-valley/core';

export const FOLIAGE_LEAF_COLOR: Readonly<Record<FoliageStage | 'none', string>> = {
  green: '#2E7D32',
  turning: '#F2B705',
  peak: '#C62828',
  falling: '#8D5B2C',
  dormant: '#9E9E9E',
  none: '#9E9E9E',
};

export function FoliageLeaf({ stage, size = 20 }: { stage: FoliageStage | 'none'; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <path
        d="M20 4c-7 0-13 3.5-15 10-.8 2.5-.6 4.6 0 6 1.4-.6 3.5-.8 6 0 6.5-2 10-8 10-15 0-.4 0-.7-1-1z"
        fill={FOLIAGE_LEAF_COLOR[stage]}
      />
      <path d="M5 20c3-5 7-9 12-12" stroke="rgba(0,0,0,.35)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
