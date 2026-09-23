/**
 * 단풍 단계 — 기상청 계절관측 코드(SSN_MD)만으로. 가장 늦은 단계, 미래 관측 무시, 평년값 전달.
 */
import { describe, expect, it } from 'vitest';
import { evaluateFoliage } from '../src/domain/valley/foliage';

describe('evaluateFoliage — 계절관측 코드', () => {
  it('관측 없음 → 단풍 전, 평년값은 그대로 넘긴다', () => {
    const s = evaluateFoliage({
      observations: [],
      normals: { turning: '10-20', peak: '10-31' },
      today: '2026-10-01',
    });
    expect(s.stage).toBe('green');
    expect(s.observedAt).toBeNull();
    expect(s.normals).toEqual({ turning: '10-20', peak: '10-31' });
  });

  it('301 시작 → turning, 302 절정 → peak (유명산 501/503 도 같다)', () => {
    expect(
      evaluateFoliage({ observations: [{ day: '2026-10-18', code: 301 }], today: '2026-10-25' }),
    ).toMatchObject({ stage: 'turning', observedAt: '2026-10-18' });
    expect(
      evaluateFoliage({
        observations: [
          { day: '2026-10-18', code: 501 },
          { day: '2026-10-29', code: 503 },
        ],
        today: '2026-11-02',
      }),
    ).toMatchObject({ stage: 'peak', observedAt: '2026-10-29', dates: { turning: '2026-10-18' } });
  });

  it('오늘 이후 관측(입력 순서 무관)은 아직 아니다', () => {
    const s = evaluateFoliage({
      observations: [
        { day: '2026-10-29', code: 302 },
        { day: '2026-10-18', code: 301 },
      ],
      today: '2026-10-20',
    });
    expect(s.stage).toBe('turning');
  });

  it('낙엽 시작(304)·끝(305) → falling·dormant, 모르는 코드는 무시', () => {
    expect(
      evaluateFoliage({
        observations: [
          { day: '2026-10-29', code: 302 },
          { day: '2026-11-08', code: 304 },
          { day: '2026-11-09', code: 999 },
        ],
        today: '2026-11-10',
      }).stage,
    ).toBe('falling');
    expect(
      evaluateFoliage({ observations: [{ day: '2026-11-20', code: 305 }], today: '2026-11-21' })
        .stage,
    ).toBe('dormant');
  });
});
