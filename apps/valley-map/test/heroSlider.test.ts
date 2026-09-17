/** 홈 히어로 자동 넘김 위치 계산 — 마지막에서 처음으로 돌아오는지, 스냅 도중 값도 버티는지. */
import { describe, expect, it } from 'vitest';
import { nextSlideLeft, snappedLeft } from '../src/journey/heroSlider';

describe('nextSlideLeft', () => {
  it('다음 슬라이드로 폭만큼 이동한다', () => {
    expect(nextSlideLeft(0, 400, 3)).toBe(400);
    expect(nextSlideLeft(400, 400, 3)).toBe(800);
  });
  it('마지막 다음은 처음', () => {
    expect(nextSlideLeft(800, 400, 3)).toBe(0);
  });
  it('스냅 도중의 어중간한 위치도 가장 가까운 슬라이드 기준', () => {
    expect(nextSlideLeft(390, 400, 3)).toBe(800);
    expect(nextSlideLeft(410, 400, 3)).toBe(800);
  });
  it('슬라이드가 하나거나 폭을 모르면 움직이지 않는다', () => {
    expect(nextSlideLeft(0, 400, 1)).toBe(0);
    expect(nextSlideLeft(120, 0, 3)).toBe(0);
  });
});

describe('snappedLeft', () => {
  it('가장 가까운 슬라이드 경계로 맞춘다', () => {
    expect(snappedLeft(180, 400)).toBe(0);
    expect(snappedLeft(220, 400)).toBe(400);
    expect(snappedLeft(800, 400)).toBe(800);
  });
  it('왼쪽으로 끌어 음수가 되어도 0 아래로 가지 않는다', () => {
    expect(snappedLeft(-120, 400)).toBe(0);
  });
  it('폭을 모르면 0', () => {
    expect(snappedLeft(300, 0)).toBe(0);
  });
});
