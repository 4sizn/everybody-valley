/**
 * 기상청 계절관측(단풍) 폴러 — 하루 몇 번 `sfc_ssn.php` 로 올해 단풍나무(302)·유명산(501) 관측을
 * 전 지점 받아 `season_obs` 에 넣고, 하루 한 번 평년값(`sfc_ssn_norm.php`)을 `season_norm` 에
 * 넣는다. 관측은 연 자료라 하루 6번이면 충분하다(호출 4건/틱). 단풍 단계는 이 표만 본다.
 */
import type { Repos } from '../db/repos';
import type { SourceHttp } from '../sources/http';
import {
  parseSeasonNorm,
  parseSeasonObs,
  SSN_IDS,
  seasonNormUrl,
  seasonObsUrl,
} from '../sources/kmaSeason';
import { toKstYmdhm } from '../time';
import type { JobRunResult } from './PollJob';

export const SEASON_INTERVAL_MS = 4 * 60 * 60_000;

export interface SeasonJobDeps {
  readonly key: string;
  readonly http: SourceHttp;
  readonly repos: Repos;
  readonly now?: () => number;
}

export function createSeasonRun(deps: SeasonJobDeps): () => Promise<JobRunResult> {
  const now = deps.now ?? Date.now;
  let normFetchedOnDay = '';
  return async () => {
    const nowMs = now();
    const nowIso = new Date(nowMs).toISOString();
    const kst = toKstYmdhm(nowMs);
    const year = kst.slice(0, 4);
    const today = kst.slice(0, 8);
    let rows = 0;
    let norms = 0;
    let status = 200;
    const errors: string[] = [];
    // 호출 4건 중 하나가 늦거나(API허브 504) 실패해도 나머지는 살린다 — 연 자료라 다음 틱에 메워진다.
    for (const ssn of SSN_IDS) {
      try {
        const res = await deps.http.text(seasonObsUrl(deps.key, `${year}0101`, today, ssn));
        status = Math.max(status, res.status);
        rows += deps.repos.seasonObs.upsertMany(parseSeasonObs(res.body), nowIso);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (normFetchedOnDay !== today) {
      let normOk = true;
      for (const ssn of SSN_IDS) {
        try {
          const res = await deps.http.text(seasonNormUrl(deps.key, ssn));
          status = Math.max(status, res.status);
          norms += deps.repos.seasonNorm.upsertMany(parseSeasonNorm(res.body), nowIso);
        } catch (error) {
          normOk = false;
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (normOk) normFetchedOnDay = today;
    }
    if (errors.length === SSN_IDS.length * 2 || (errors.length > 0 && rows + norms === 0)) {
      throw new Error(errors.join(' | '));
    }
    return { rows, status, detail: { year, norms, partialErrors: errors.length } };
  };
}
