import { describe, expect, it } from 'vitest';
import { narrowOverlayStack } from '../src/components/shell/overlayStack';

const BASE = {
  controlsBottom: 16 + 337.6, // SIZES.gutter + visibleHeight(예시)
  visibleHeight: 337.6,
  rowHeight: 60, // SIZES.reportHeight(48) + CONTROL_ROW_GAP(12)
  tickerGap: 20, // SIZES.tickerGap
};

describe('narrowOverlayStack', () => {
  it('넓은 컬럼 — festival 파리티: 트랙은 컨트롤과 같은 행, 티커는 기본 간격', () => {
    const result = narrowOverlayStack({
      ...BASE,
      isNarrow: false,
      trackVisible: false,
    });
    expect(result.trackBottom).toBe(BASE.controlsBottom);
    expect(result.tickerBottom).toBe(BASE.visibleHeight + BASE.tickerGap);
  });

  it('넓은 컬럼 — 트랙이 켜져 있어도(계곡 데스크톱) 값이 바뀌지 않는다', () => {
    const result = narrowOverlayStack({
      ...BASE,
      isNarrow: false,
      trackVisible: true,
    });
    expect(result.trackBottom).toBe(BASE.controlsBottom);
    expect(result.tickerBottom).toBe(BASE.visibleHeight + BASE.tickerGap);
  });

  it('좁은 컬럼 · 트랙 꺼짐 — 티커만 컨트롤 위 한 행(예전 상수 계산과 같은 값)', () => {
    const result = narrowOverlayStack({
      ...BASE,
      isNarrow: true,
      trackVisible: false,
    });
    expect(result.trackBottom).toBe(BASE.controlsBottom);
    expect(result.tickerBottom).toBe(BASE.controlsBottom + BASE.rowHeight);
  });

  it('좁은 컬럼 · 트랙 켜짐 — X4 회귀 고정: 트랙과 티커가 서로 다른 행에 앉는다', () => {
    const result = narrowOverlayStack({
      ...BASE,
      isNarrow: true,
      trackVisible: true,
    });
    expect(result.trackBottom).toBe(BASE.controlsBottom + BASE.rowHeight);
    expect(result.tickerBottom).toBe(BASE.controlsBottom + 2 * BASE.rowHeight);
    // 핵심 불변 — 두 오버레이는 절대 같은 좌표에 앉지 않는다(X4 는 정확히 이 값이 같아서 났다).
    expect(result.tickerBottom).not.toBe(result.trackBottom);
    expect(result.tickerBottom - result.trackBottom).toBe(BASE.rowHeight);
  });
});
