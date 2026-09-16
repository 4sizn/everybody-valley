/**
 * 제보 유형색 대비 실측(F5, 화면 결정 확정 (a)) — `REPORT_TYPE_COLORS.light` 는 `#ffffff` 위,
 * `.dark` 는 `#202024` 위에서 WCAG 상대휘도 대비 4.5:1 을 지킨다. 값이 바뀌면 이 테스트가
 * 먼저 깨진다 — 팔레트 파일 주석의 실측표와 같은 계산이다.
 */
import { REPORT_TYPES } from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { REPORT_TYPE_COLORS } from '../src/palette';

function hexToRgb(hex: string): readonly [number, number, number] {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
  return [r ?? 0, g ?? 0, b ?? 0];
}

function linearize(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2 대비비 — (L1+0.05)/(L2+0.05), 밝은 쪽이 분자. */
function contrastRatio(a: string, b: string): number {
  const [lA, lB] = [relativeLuminance(a), relativeLuminance(b)];
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

const MIN_CONTRAST = 4.5;

describe('REPORT_TYPE_COLORS', () => {
  it('6종 전부 정의돼 있다', () => {
    for (const type of REPORT_TYPES) {
      expect(REPORT_TYPE_COLORS.light[type]).toMatch(/^#[0-9a-f]{6}$/);
      expect(REPORT_TYPE_COLORS.dark[type]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('light 는 #ffffff 위에서 4.5:1 이상', () => {
    for (const type of REPORT_TYPES) {
      const ratio = contrastRatio(REPORT_TYPE_COLORS.light[type], '#ffffff');
      expect(ratio, `${type} light ${REPORT_TYPE_COLORS.light[type]}`).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
    }
  });

  it('dark 는 #202024 위에서 4.5:1 이상', () => {
    for (const type of REPORT_TYPES) {
      const ratio = contrastRatio(REPORT_TYPE_COLORS.dark[type], '#202024');
      expect(ratio, `${type} dark ${REPORT_TYPE_COLORS.dark[type]}`).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
    }
  });
});
