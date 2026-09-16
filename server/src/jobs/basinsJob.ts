/**
 * 표준유역 폴리곤 1회 적재(결정 (e)). 국토부 수자원관리도 WFS(data.go.kr 15057885, 공공누리 1유형)의 GetFeature
 * GeoJSON 을 `BASINS_WFS_URL` 로 받아 저장한다. URL 이 없거나 실패하면 저장하지 않고, `/api/basins` 는 브이월드
 * 조회 전용으로 동작한다(브이월드 응답은 절대 저장하지 않는다 — 약관 §19).
 *
 * 이미 적재돼 있으면(행 > 0) 건너뛴다. 다시 받으려면 `basins` 테이블을 비운다.
 */
import type { Logger } from '@modu-valley/core';
import type { Repos } from '../db/repos';
import type { Redactor } from '../logging/redact';
import type { BasinRecord } from '../records';
import { HttpError, type SourceHttp } from '../sources/http';

export const BASINS_SOURCE = 'molit-wamis-wfs-15057885';

export interface BasinsJobDeps {
  readonly wfsUrl: string | undefined;
  readonly http: SourceHttp;
  readonly repos: Repos;
  readonly logger: Logger;
  readonly redact: Redactor;
  readonly now?: () => number;
}

const pick = (props: Record<string, unknown>, ...names: string[]): string | null => {
  const lower = new Map(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]));
  for (const n of names) {
    const v = lower.get(n.toLowerCase());
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return null;
};

/** WFS GeoJSON FeatureCollection → BasinRecord. 속성 이름은 대소문자 무관(`SBSN_CD`·`sbsncd` 둘 다). */
export function basinsFromFeatureCollection(body: unknown, collectedAt: string): BasinRecord[] {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) throw new Error('수자원관리도 WFS: features 배열이 없다');
  const out: BasinRecord[] = [];
  for (const f of features) {
    const feature = f as { properties?: Record<string, unknown>; geometry?: unknown };
    const props = feature.properties ?? {};
    const sbsncd = pick(props, 'sbsncd', 'sbsn_cd', 'SBSN_CD', 'bsn_cd');
    if (!sbsncd || feature.geometry === undefined) continue;
    out.push({
      sbsncd,
      sbsnnm: pick(props, 'sbsnnm', 'sbsn_nm', 'bsn_nm'),
      mbsncd: pick(props, 'mbsncd', 'mbsn_cd'),
      bbsncd: pick(props, 'bbsncd', 'bbsn_cd'),
      geometry: feature.geometry,
      source: BASINS_SOURCE,
      collectedAt,
    });
  }
  return out;
}

export type BasinsLoadOutcome =
  | {
      readonly kind: 'skipped';
      readonly reason: 'already-loaded' | 'no-url';
      readonly count: number;
    }
  | { readonly kind: 'loaded'; readonly count: number }
  | { readonly kind: 'failed'; readonly error: string };

export async function loadBasinsOnce(deps: BasinsJobDeps): Promise<BasinsLoadOutcome> {
  const now = deps.now ?? Date.now;
  const existing = deps.repos.basins.count();
  if (existing > 0) return { kind: 'skipped', reason: 'already-loaded', count: existing };
  if (!deps.wfsUrl) {
    deps.logger.info('basins: BASINS_WFS_URL 없음 — 브이월드 조회 전용으로 동작');
    return { kind: 'skipped', reason: 'no-url', count: 0 };
  }
  const startedMs = now();
  const startedAt = new Date(startedMs).toISOString();
  try {
    const res = await deps.http.json(deps.wfsUrl);
    const records = basinsFromFeatureCollection(res.body, startedAt);
    const count = deps.repos.basins.replaceAll(records);
    const finishedMs = now();
    deps.repos.fetchLog.record({
      job: 'basins',
      startedAt,
      finishedAt: new Date(finishedMs).toISOString(),
      ok: true,
      status: res.status,
      rows: count,
      durationMs: finishedMs - startedMs,
      error: null,
    });
    deps.logger.info('basins loaded', { count, features: records.length });
    return { kind: 'loaded', count };
  } catch (error) {
    const finishedMs = now();
    const message = deps.redact(error instanceof Error ? error.message : String(error));
    deps.repos.fetchLog.record({
      job: 'basins',
      startedAt,
      finishedAt: new Date(finishedMs).toISOString(),
      ok: false,
      status: error instanceof HttpError ? error.status : null,
      rows: null,
      durationMs: finishedMs - startedMs,
      error: message,
    });
    deps.logger.warn('basins load failed — 브이월드 조회 전용으로 동작', { error: message });
    return { kind: 'failed', error: message };
  }
}
