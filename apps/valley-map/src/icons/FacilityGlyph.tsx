/**
 * 시설 픽토그램 — 지도 핀 안의 글리프를 목록에서 같은 도형으로 (C5).
 *
 * 도형의 진실은 `map-style` 의 `FACILITY_GLYPHS`(24px 격자 SVG 문자열)다. 지도 핀은 그 문자열을
 * 래스터화해 쓰고, 여기서는 `SvgXml` 로 그대로 그린다 — 두 곳이 한 문자열을 읽으므로 "지도의
 * 아이콘과 목록의 아이콘이 다르다" 가 생길 수 없다. `index.tsx` 의 다른 아이콘처럼 JSX 로 옮겨
 * 적으면 파리티를 손으로 지켜야 한다.
 *
 * 색 기본값은 유형색(`FACILITY_COLORS`) — 핀은 유형색 바탕에 흰 글리프이고, 흰 카드 위의 목록은
 * 그 반전이다. 호출부가 색을 주면 그 색으로.
 */
import type { FacilityType } from '@modu-valley/core';
import { FACILITY_COLORS, FACILITY_GLYPHS } from '@modu-valley/map-style';
import { SvgXml } from 'react-native-svg';

export type FacilityGlyphProps = {
  readonly type: FacilityType;
  readonly size?: number;
  readonly color?: string;
};

export function FacilityGlyph({ type, size = 16, color }: FacilityGlyphProps) {
  const xml = facilityGlyphXml(type, color ?? FACILITY_COLORS[type]);
  return <SvgXml xml={xml} width={size} height={size} />;
}

/** 24px 격자 글리프를 독립 SVG 문서로 — `currentColor` 를 실제 색으로 치환한다. */
export function facilityGlyphXml(type: FacilityType, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${FACILITY_GLYPHS[type].replaceAll('currentColor', color)}</svg>`;
}
