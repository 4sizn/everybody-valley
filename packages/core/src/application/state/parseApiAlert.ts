/**
 * `ApiAlert`(`ApiPort.alerts()` DTO — 서버 `GET /api/alerts` 를 그대로 옮긴 것) → 도메인.
 * `ApiPort` 는 DTO 만 안다(포트 자신의 문서 참고) — 도메인 객체(`UpstreamAlert`)로 바꾸는
 * 일은 그 DTO 를 쓰는 이 계층(application)이 한다.
 *
 * `level` 이 없으면 평시(활성 경보 없음) — `alert: null` 이고 `stale`·`lastObservedAt` 만
 * 의미가 있다(자료 없음 회색 타일의 재료).
 */
import { toStationCode, toValleyId, type ValleyId } from '../../domain/valley/ids';
import { UpstreamAlert } from '../../domain/valley/UpstreamAlert';
import type { ApiAlert } from '../ports/ApiPort';
import type { ValleyAlertState } from './ValleyAlertState';

export function parseApiAlert(raw: ApiAlert): ValleyAlertState {
  if (
    raw.level === null ||
    raw.source === undefined ||
    raw.confidence === undefined ||
    raw.observedAt === undefined ||
    raw.issuedAt === undefined
  ) {
    return { alert: null, stale: raw.stale, lastObservedAt: raw.lastObservedAt };
  }
  const alert = new UpstreamAlert({
    valleyId: toValleyId(raw.valleyId),
    level: raw.level,
    source: raw.source,
    confidence: raw.confidence,
    observedAt: raw.observedAt,
    issuedAt: raw.issuedAt,
    ...(raw.stationCode ? { stationCode: toStationCode(raw.stationCode) } : {}),
    ...(typeof raw.rainfall10mMm === 'number' ? { rainfall10mMm: raw.rainfall10mMm } : {}),
    ...(typeof raw.rainfall1hMm === 'number' ? { rainfall1hMm: raw.rainfall1hMm } : {}),
    ...(typeof raw.rainfall3hMm === 'number' ? { rainfall3hMm: raw.rainfall3hMm } : {}),
    ...(typeof raw.basinRainMmPerH === 'number' ? { basinRainMmPerH: raw.basinRainMmPerH } : {}),
    ...(raw.waterLevelStage ? { waterLevelStage: raw.waterLevelStage } : {}),
    ...(typeof raw.waterLevelDeltaM === 'number' ? { waterLevelDeltaM: raw.waterLevelDeltaM } : {}),
    ...(typeof raw.leadTimeMin === 'number' ? { leadTimeMin: raw.leadTimeMin } : {}),
  });
  return { alert, stale: raw.stale, lastObservedAt: raw.lastObservedAt };
}

/** 계곡 30개(응답이 낸 만큼) → `ValleyId` 별 상태. */
export function parseApiAlerts(raws: readonly ApiAlert[]): ReadonlyMap<ValleyId, ValleyAlertState> {
  return new Map(raws.map((raw) => [toValleyId(raw.valleyId), parseApiAlert(raw)]));
}
