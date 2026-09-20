/**
 * 단풍 판정 규칙 테스트 — `domain/valley/foliage.ts` 의 문턱(5℃·3/7일·10일 누적·14일·서리)을 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { addDays, evaluateFoliage, type FoliageDay } from '../src/domain/valley/foliage';

/** `start` 부터 하루씩 tmin 배열. */
function series(start: string, tmins: readonly number[]): FoliageDay[] {
  return tmins.map((tminC, i) => ({ day: addDays(start, i), tminC }));
}

describe('evaluateFoliage', () => {
  it('자료 없음 → green · confidence none', () => {
    const s = evaluateFoliage({ days: [], today: '2026-10-01' });
    expect(s).toMatchObject({ stage: 'green', confidence: 'none', lastDay: null });
  });

  it('따뜻하고 추세 없음 → green, 예측 없음', () => {
    const days = series('2026-09-10', new Array(14).fill(15));
    const s = evaluateFoliage({ days, today: '2026-09-23' });
    expect(s.stage).toBe('green');
    expect(s.forecast).toEqual({ turning: null, peak: null });
    expect(s.confidence).toBe('observed');
  });

  it('하루 0.5℃ 씩 내려가는 추세 → 5℃ 닿는 날을 첫 단풍으로 예측, 절정은 +14일', () => {
    // 15 → 8.5 (14일). 마지막 8.5 에서 5 까지 3.5/0.5 = 7일.
    const days = series(
      '2026-09-10',
      Array.from({ length: 14 }, (_, i) => 15 - i * 0.5),
    );
    const s = evaluateFoliage({ days, today: '2026-09-23' });
    expect(s.stage).toBe('green');
    expect(s.forecast.turning).toBe('2026-09-30');
    expect(s.forecast.peak).toBe('2026-10-14');
  });

  it('날이 빠진 시계열 — 3주 전 값은 14일 창 밖, 최근 3일만으로는 예측하지 않는다', () => {
    // 9/1~9/3(20℃대) + 9/19~9/21(14℃대). 인덱스로 재면 6칸에 6℃ 하락 → 며칠 뒤 5℃ 로 오판.
    const days = [
      ...series('2026-09-01', [21, 20.5, 20]),
      ...series('2026-09-19', [14.2, 13.9, 14]),
    ];
    const s = evaluateFoliage({ days, today: '2026-09-21' });
    expect(s.stage).toBe('green');
    expect(s.forecast).toEqual({ turning: null, peak: null });
  });

  it('창 안에 빠진 날이 있어도 날짜 차이로 기울기를 잰다', () => {
    // 하루 0.5℃ 하강인데 9/13·9/14 가 빠짐 — 결과는 빈 날 없을 때와 같아야 한다.
    const dense = series(
      '2026-09-10',
      Array.from({ length: 14 }, (_, i) => 15 - i * 0.5),
    );
    const sparse = dense.filter((d) => d.day !== '2026-09-13' && d.day !== '2026-09-14');
    expect(evaluateFoliage({ days: sparse, today: '2026-09-23' }).forecast).toEqual(
      evaluateFoliage({ days: dense, today: '2026-09-23' }).forecast,
    );
  });

  it('찬 날 하루짜리 한파는 첫 단풍이 아니다', () => {
    const days = series('2026-10-01', [12, 4, 12, 12, 12, 12, 12, 12]);
    expect(evaluateFoliage({ days, today: '2026-10-08' }).stage).toBe('green');
  });

  it('7일 창에 찬 날 3개 → turning, 첫 찬 날이 시작일, 절정 예측 +14', () => {
    const days = series('2026-10-01', [12, 4, 9, 4, 8, 3, 9, 9]);
    const s = evaluateFoliage({ days, today: '2026-10-08' });
    expect(s.stage).toBe('turning');
    expect(s.turningStart).toBe('2026-10-02');
    expect(s.forecast.peak).toBe('2026-10-16');
  });

  it('찬 날 누적 10일이면 14일 전이라도 peak', () => {
    const days = series('2026-10-01', new Array(10).fill(3));
    const s = evaluateFoliage({ days, today: '2026-10-10' });
    expect(s.stage).toBe('peak');
    expect(s.peakStart).toBe('2026-10-10');
  });

  it('누적이 안 차도 14일 지나면 peak', () => {
    const days = series('2026-10-01', [4, 4, 4, ...new Array(12).fill(8)]);
    const s = evaluateFoliage({ days, today: '2026-10-15' });
    expect(s.stage).toBe('peak');
    expect(s.peakStart).toBe('2026-10-15');
  });

  it('절정 뒤 서리 → falling, 14일 더 지나면 dormant', () => {
    const days = series('2026-10-01', [...new Array(10).fill(3), 2, -1, 2, 2]);
    expect(evaluateFoliage({ days, today: '2026-10-12' })).toMatchObject({
      stage: 'falling',
      fallingStart: '2026-10-12',
    });
    expect(evaluateFoliage({ days, today: '2026-10-26' }).stage).toBe('dormant');
  });

  it('관측 14일 미만은 estimated', () => {
    const days = series('2026-10-01', [3, 3, 3]);
    expect(evaluateFoliage({ days, today: '2026-10-03' }).confidence).toBe('estimated');
  });
});
