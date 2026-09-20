/**
 * 기상청 AWS 매분 폴러. 전체 지점 10분 창 1 호출(= 분당 1건, 일 1,440건 < 20,000 한도) → latest 갱신 +
 * 10분 격자 행만 observations 적재 → SSE `aws`. `#7777END` 가 없으면 잘린 응답이라 실패로 본다(백오프 재시도).
 */
import { kstDayOf, type Repos } from '../db/repos';
import type { EventHub } from '../events/EventHub';
import type { SourceHttp } from '../sources/http';
import { awsMinutesUrl, parseAwsMinutes } from '../sources/kmaAws';
import { isTenMinuteMark, toKstYmdhm } from '../time';
import type { JobRunResult } from './PollJob';

export const AWS_WINDOW_MS = 10 * 60_000;
/** 일 기온은 한 시즌 본다(단풍: 9월 초 → 11월 말). */
export const DAILY_TEMPS_RETENTION_MS = 120 * 24 * 60 * 60_000;

export interface AwsJobDeps {
  readonly key: string;
  readonly http: SourceHttp;
  readonly repos: Repos;
  readonly hub: EventHub;
  readonly now?: () => number;
  /** 폴링 주기 — 정시 근처 틱 하나에서만 오래된 일 기온을 지운다. */
  readonly intervalMs?: number;
}

export function createAwsRun(deps: AwsJobDeps): () => Promise<JobRunResult> {
  const now = deps.now ?? Date.now;
  const intervalMs = deps.intervalMs ?? 60_000;
  return async () => {
    const nowMs = now();
    const url = awsMinutesUrl(deps.key, toKstYmdhm(nowMs - AWS_WINDOW_MS), toKstYmdhm(nowMs));
    const res = await deps.http.text(url);
    const parsed = parseAwsMinutes(res.body);
    if (!parsed.complete) {
      throw new Error(
        `AWS 매분자료가 잘려 왔다(${res.body.length} B, ${parsed.rows.length} 행, #7777END 없음)`,
      );
    }
    const nowIso = new Date(nowMs).toISOString();
    const changed = deps.repos.latest.upsertMany(parsed.rows, nowIso);
    // 단풍 판정 재료 — 같은 응답의 기온(TA)을 KST 일 최저·최고로 접는다. 추가 호출 없음.
    deps.repos.dailyTemps.fold(parsed.rows, nowIso);
    if (nowMs % (60 * 60_000) < intervalMs) {
      deps.repos.dailyTemps.prune(
        kstDayOf(new Date(nowMs - DAILY_TEMPS_RETENTION_MS).toISOString()),
      );
    }
    const grid = parsed.rows.filter((r) => isTenMinuteMark(r.observedAt));
    deps.repos.observations.upsertMany(grid, nowIso);
    const observedAt = deps.repos.latest.maxObservedAt(['aws']);
    const stations = new Set(parsed.rows.map((r) => r.code)).size;
    deps.hub.publish('aws', { observedAt, stations, changed });
    return {
      rows: parsed.rows.length,
      status: res.status,
      detail: { observedAt, stations, gridRows: grid.length, changed },
    };
  };
}
