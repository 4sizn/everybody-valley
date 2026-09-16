/**
 * 관측소 제원 갱신(하루 1회 + 시작 시). HRFCO 수위·강우 `info.json`(도분초 → 십진도) + AWS `stn_inf.php`(EUC-KR).
 * 어느 소스에 키가 없으면 그 소스는 건너뛴다.
 */
import type { Repos } from '../db/repos';
import { hrfcoUrl, parseHrfcoStations } from '../sources/hrfco';
import type { SourceHttp } from '../sources/http';
import { awsStationsUrl, parseAwsStations } from '../sources/kmaAws';
import { toKstYmdhm } from '../time';
import type { JobRunResult } from './PollJob';

export const STATIONS_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface StationsJobDeps {
  readonly hrfcoKey: string | undefined;
  readonly kmaKey: string | undefined;
  readonly http: SourceHttp;
  readonly repos: Repos;
  readonly now?: () => number;
}

export function createStationsRun(deps: StationsJobDeps): () => Promise<JobRunResult> {
  const now = deps.now ?? Date.now;
  return async () => {
    const nowMs = now();
    const nowIso = new Date(nowMs).toISOString();
    const counts: Record<string, number> = {};
    let status = 200;
    if (deps.hrfcoKey) {
      const [wl, rf] = await Promise.all([
        deps.http.json(hrfcoUrl(deps.hrfcoKey, 'waterlevel', 'info')),
        deps.http.json(hrfcoUrl(deps.hrfcoKey, 'rainfall', 'info')),
      ]);
      counts['hrfco-waterlevel'] = deps.repos.stations.upsertMany(
        parseHrfcoStations('waterlevel', wl.body),
        nowIso,
      );
      counts['hrfco-rainfall'] = deps.repos.stations.upsertMany(
        parseHrfcoStations('rainfall', rf.body),
        nowIso,
      );
      status = Math.max(status, wl.status, rf.status);
    }
    if (deps.kmaKey) {
      const res = await deps.http.text(awsStationsUrl(deps.kmaKey, toKstYmdhm(nowMs)), 'euc-kr');
      counts['aws'] = deps.repos.stations.upsertMany(parseAwsStations(res.body), nowIso);
      status = Math.max(status, res.status);
    }
    const rows = Object.values(counts).reduce((a, b) => a + b, 0);
    return { rows, status, detail: counts };
  };
}
