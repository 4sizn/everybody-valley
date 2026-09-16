import { FACILITY_TYPES } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import {
  FACILITY_GLYPH_SELECTED_SIZE,
  FACILITY_GLYPH_SIZE,
  FACILITY_GLYPHS,
  FACILITY_ICON_SPECS,
  FACILITY_PIN_SELECTED_SIZE,
  FACILITY_PIN_SIZE,
  FACILITY_PIN_TIP_INSET,
  facilityIconId,
  facilityIconSvgById,
  facilityPinSvg,
  MARKER_ICON_PIXEL_RATIO,
  parseFacilityIconId,
} from '../src/facilityIcons';
import { FACILITY_COLORS, FACILITY_PIN_STROKE_COLOR } from '../src/palette';

describe('아이콘 ID 규약 — facility/<type>[/selected]', () => {
  it('10종 × 2상태 = 20개, 모드는 ID 에 없다(D2)', () => {
    expect(FACILITY_ICON_SPECS).toHaveLength(20);
    const ids = FACILITY_ICON_SPECS.map(({ type, selected }) => facilityIconId(type, selected));
    expect(new Set(ids).size).toBe(20);
    for (const id of ids) {
      expect(id).toMatch(/^facility\/[a-z]+(\/selected)?$/);
      expect(id).not.toMatch(/light|dark/);
    }
    expect(facilityIconId('parking')).toBe('facility/parking');
    expect(facilityIconId('parking', true)).toBe('facility/parking/selected');
  });

  it('parse 는 facilityIconId 의 역함수이고 규약 밖 ID 는 null', () => {
    for (const spec of FACILITY_ICON_SPECS) {
      expect(parseFacilityIconId(facilityIconId(spec.type, spec.selected))).toEqual(spec);
    }
    expect(parseFacilityIconId('facility/unknown')).toBeNull();
    expect(parseFacilityIconId('facility/')).toBeNull();
    expect(parseFacilityIconId('spot-pin')).toBeNull();
    expect(parseFacilityIconId('')).toBeNull();
    // openfreemap 스프라이트가 요청하는 ID 는 내 담당이 아니다 — 투명 폴백으로 간다.
    expect(facilityIconSvgById('poi_bus')).toBeNull();
  });
});

describe('facilityPinSvg — A2 물방울 핀', () => {
  it('10종 모두 SVG 를 만들고 유형색 채움 + 흰 테두리 2 + 흰 글리프다', () => {
    expect(Object.keys(FACILITY_GLYPHS).sort()).toEqual([...FACILITY_TYPES].sort());
    for (const type of FACILITY_TYPES) {
      const svg = facilityPinSvg(type);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).toContain(
        `fill="${FACILITY_COLORS[type]}" stroke="${FACILITY_PIN_STROKE_COLOR}" stroke-width="2"`,
      );
      // 글리프의 currentColor 는 모두 흰색으로 치환됐다.
      expect(svg).not.toContain('currentColor');
      expect(svg).toContain(`stroke="${FACILITY_PIN_STROKE_COLOR}"`);
      // 태그 짝이 맞는다(여는 <g> 와 </g>, <svg> 와 </svg>).
      expect(svg.match(/<g\b/g)?.length).toBe(svg.match(/<\/g>/g)?.length);
      expect(svg.match(/<svg\b/g)?.length).toBe(1);
    }
  });

  it('기본 28×36dp, 픽셀 비율 2 → 56×72, 글리프 17', () => {
    const svg = facilityPinSvg('parking');
    expect(FACILITY_PIN_SIZE).toEqual({ width: 28, height: 36 });
    expect(MARKER_ICON_PIXEL_RATIO).toBe(2);
    expect(svg).toContain('viewBox="0 0 28 36" width="56" height="72"');
    expect(FACILITY_GLYPH_SIZE).toBe(17);
    expect(svg).toContain(`translate(5.5 5) scale(${Math.round((17 / 24) * 1000) / 1000})`);
    expect(FACILITY_PIN_TIP_INSET.base).toBe(0);
  });

  it('선택은 34×44dp, 글리프 20, 흰 링(경로 3겹), 꼭짓점 보정값 ≈ 4.24', () => {
    const svg = facilityPinSvg('cafe', true);
    expect(FACILITY_PIN_SELECTED_SIZE).toEqual({ width: 34, height: 44 });
    expect(svg).toContain('viewBox="0 0 34 44" width="68" height="88"');
    expect(FACILITY_GLYPH_SELECTED_SIZE).toBe(20);
    expect(svg).toContain(`scale(${Math.round((20 / 24) * 1000) / 1000})`);
    // 링: 흰 8 → 유형색 4 → 채움 + 흰 2 — 같은 경로가 세 번.
    expect(svg.match(/<path d="M14 1C7 1/g)?.length).toBe(3);
    expect(svg).toContain(`stroke="${FACILITY_PIN_STROKE_COLOR}" stroke-width="8"`);
    expect(svg).toContain(`stroke="${FACILITY_COLORS.cafe}" stroke-width="4"`);
    expect(FACILITY_PIN_TIP_INSET.selected).toBeCloseTo(4.241, 3);
    // 기본 핀에는 링이 없다.
    expect(facilityPinSvg('cafe').match(/<path d="M14 1C7 1/g)?.length).toBe(1);
  });

  it('facilityIconSvgById 는 ID 로 같은 SVG 를 돌려준다', () => {
    expect(facilityIconSvgById('facility/station')).toBe(facilityPinSvg('station'));
    expect(facilityIconSvgById('facility/station/selected')).toBe(facilityPinSvg('station', true));
  });

  it(
    '10종 × 선택/비선택 전부 facilityIconSvgById 로 실제 SVG 가 나온다(X2 회귀 — ' +
      '레지스트리의 투명 1px 폴백은 이 경로가 null 을 돌려줄 때만 조용히 켜진다)',
    () => {
      for (const spec of FACILITY_ICON_SPECS) {
        const id = facilityIconId(spec.type, spec.selected);
        const svg = facilityIconSvgById(id);
        expect(svg, `${id} 는 null 이면 안 된다`).not.toBeNull();
        expect(svg?.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
        expect(svg?.endsWith('</svg>')).toBe(true);
      }
    },
  );

  it('20장 SVG 문자열 스냅샷 — 바뀌면 PNG 재빌드(pnpm icons:build) 가 필요하다', () => {
    const all = Object.fromEntries(
      FACILITY_ICON_SPECS.map(({ type, selected }) => [
        facilityIconId(type, selected),
        facilityPinSvg(type, selected),
      ]),
    );
    expect(all).toMatchSnapshot();
  });
});
