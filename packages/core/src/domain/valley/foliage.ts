/**
 * 단풍 단계 — **기상청 계절관측(국내 오픈 API) 관측일만으로** 판정한다. 자체 기온 모델·예측은 없다
 * (사용자 결정 2026-09-23: 물들임 정도는 국내 오픈 API 기준으로만).
 *
 * 재료는 서버가 계곡에 붙여 넘긴 그 해의 관측 이벤트들(API허브 `sfc_ssn.php`, 코드표 SSN_MD):
 *   301/501 단풍 시작 · 302/503 단풍 절정 · 303 단풍 끝 · 304 낙엽 시작 · 305 낙엽 끝
 * 오늘 이전에 관측된 가장 늦은 단계가 현재 단계다. 관측이 아직 없으면 `green`(단풍 전). 관측
 * 지점이 아예 없으면 호출자가 `confidence: 'none'` 으로 표시한다.
 *
 * "예상" 은 기상청 평년값(`sfc_ssn_norm.php`)이다 — 관측이 없을 때 "평년 첫단풍 10/20" 처럼 보인다.
 */

export const FOLIAGE_STAGES = ['green', 'turning', 'peak', 'falling', 'dormant'] as const;
export type FoliageStage = (typeof FOLIAGE_STAGES)[number];

const STAGE_LABELS: Readonly<Record<FoliageStage, string>> = {
  green: '단풍 전',
  turning: '물들기 시작',
  peak: '절정',
  falling: '낙엽',
  dormant: '시즌 종료',
};

export function foliageStageLabel(stage: FoliageStage): string {
  return STAGE_LABELS[stage];
}

/** 기상청 계절현상 코드(SSN_MD) → 단계. 표에 없는 코드는 무시. */
export const FOLIAGE_STAGE_BY_CODE: Readonly<Record<number, FoliageStage>> = {
  301: 'turning',
  501: 'turning',
  302: 'peak',
  503: 'peak',
  303: 'falling',
  304: 'falling',
  305: 'dormant',
};

const STAGE_RANK: Readonly<Record<FoliageStage, number>> = {
  green: 0,
  turning: 1,
  peak: 2,
  falling: 3,
  dormant: 4,
};

/** 관측 이벤트 하나. `day` 는 KST `YYYY-MM-DD`. */
export type FoliageObservation = {
  readonly day: string;
  /** SSN_MD. */
  readonly code: number;
};

/** 평년 단계별 월일(`MM-DD`). 관측이 없을 때 안내. */
export type FoliageNormals = Partial<Record<FoliageStage, string>>;

export type FoliageState = {
  readonly stage: FoliageStage;
  /** 단계를 정한 관측일. `green` 이면 `null`. */
  readonly observedAt: string | null;
  /** 지금까지 관측된 단계별 첫 관측일. */
  readonly dates: Partial<Record<FoliageStage, string>>;
  readonly normals: FoliageNormals;
};

export type EvaluateFoliageInput = {
  readonly observations: readonly FoliageObservation[];
  readonly normals?: FoliageNormals;
  /** KST `YYYY-MM-DD`. */
  readonly today: string;
};

export function evaluateFoliage(input: EvaluateFoliageInput): FoliageState {
  const dates: Partial<Record<FoliageStage, string>> = {};
  for (const o of input.observations) {
    const stage = FOLIAGE_STAGE_BY_CODE[o.code];
    if (!stage || o.day > input.today) continue;
    const prev = dates[stage];
    if (prev === undefined || o.day < prev) dates[stage] = o.day;
  }
  let stage: FoliageStage = 'green';
  for (const s of FOLIAGE_STAGES) {
    if (dates[s] !== undefined && STAGE_RANK[s] > STAGE_RANK[stage]) stage = s;
  }
  return {
    stage,
    observedAt: stage === 'green' ? null : (dates[stage] ?? null),
    dates,
    normals: input.normals ?? {},
  };
}
