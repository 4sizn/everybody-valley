/**
 * `AlertRecord`(DB 행) ↔ core `UpstreamAlert`. 행은 core 가 쓴 값의 왕복이라(외부 입력이
 * 아니다) enum 문자열을 그대로 캐스팅한다 — 스키마 검증은 여기서 하지 않는다.
 */
import {
  type AlertConfidence,
  type AlertLevel,
  type AlertSource,
  toStationCode,
  toValleyId,
  UpstreamAlert,
  type WaterLevelStage,
} from '@modu-valley/core';
import type { AlertRecord } from '../records';

export function recordToAlert(record: AlertRecord): UpstreamAlert {
  return new UpstreamAlert({
    valleyId: toValleyId(record.valleyId),
    level: record.level as AlertLevel,
    source: record.source as AlertSource,
    confidence: record.confidence as AlertConfidence,
    observedAt: record.observedAt,
    issuedAt: record.issuedAt,
    ...(record.stationCode === null ? {} : { stationCode: toStationCode(record.stationCode) }),
    ...(record.rainfall10mMm === null ? {} : { rainfall10mMm: record.rainfall10mMm }),
    ...(record.rainfall1hMm === null ? {} : { rainfall1hMm: record.rainfall1hMm }),
    ...(record.rainfall3hMm === null ? {} : { rainfall3hMm: record.rainfall3hMm }),
    ...(record.basinRainMmPerH === null ? {} : { basinRainMmPerH: record.basinRainMmPerH }),
    ...(record.waterLevelStage === null
      ? {}
      : { waterLevelStage: record.waterLevelStage as WaterLevelStage }),
    ...(record.waterLevelDeltaM === null ? {} : { waterLevelDeltaM: record.waterLevelDeltaM }),
    ...(record.leadTimeMin === null ? {} : { leadTimeMin: record.leadTimeMin }),
    clearedAt: record.clearedAt,
    verified: record.verified,
  });
}

export function alertToRecord(valleyId: string, alert: UpstreamAlert): AlertRecord {
  return {
    valleyId,
    level: alert.level,
    source: alert.source,
    confidence: alert.confidence,
    observedAt: alert.observedAt,
    issuedAt: alert.issuedAt,
    stationCode: alert.stationCode ?? null,
    rainfall10mMm: alert.rainfall10mMm ?? null,
    rainfall1hMm: alert.rainfall1hMm ?? null,
    rainfall3hMm: alert.rainfall3hMm ?? null,
    basinRainMmPerH: alert.basinRainMmPerH ?? null,
    waterLevelStage: alert.waterLevelStage ?? null,
    waterLevelDeltaM: alert.waterLevelDeltaM ?? null,
    leadTimeMin: alert.leadTimeMin ?? null,
    clearedAt: alert.clearedAt,
    verified: alert.verified,
  };
}
