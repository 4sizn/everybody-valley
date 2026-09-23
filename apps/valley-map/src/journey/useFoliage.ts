/**
 * 계곡 하나의 단풍 한 줄 — `GET /api/foliage`(기상청 계절관측만 근거)를 시즌(9/15–11/30)에만 부른다.
 * 서버 판정을 문장으로 옮길 뿐 다시 판정하지 않는다.
 */
import { type ApiFoliage, type FoliageStage, foliageStageLabel } from '@modu-valley/core';
import { useEffect, useState } from 'react';
import { createApiClient } from '../api/createApiClient';

const api = createApiClient();

/** KST 기준 9/15 ~ 11/30. */
export function isFoliageSeason(now = new Date()): boolean {
  const kst = new Date(now.getTime() + 9 * 60 * 60_000);
  const md = (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
  return md >= 915 && md <= 1130;
}

/** `YYYY-MM-DD` 또는 `MM-DD` → `M/D`. */
const md = (day: string): string => {
  const [m, d] = day.split('-').slice(-2);
  return `${Number(m)}/${Number(d)}`;
};

/** 화면 한 줄. `null` 은 관측 지점 없음. */
export function foliageLine(f: ApiFoliage): string | null {
  if (f.confidence === 'none') return null;
  const where = f.stations[0]?.name ? ` · ${f.stations[0].name} 관측` : '';
  if (f.stage === 'green') {
    const normal = f.normals.turning
      ? `평년 첫단풍 ${md(f.normals.turning)}${f.normals.peak ? ` · 절정 ${md(f.normals.peak)}` : ''}`
      : '평년값 없음';
    return `${foliageStageLabel(f.stage)} · ${normal}${where}`;
  }
  const since = f.observedAt ? `(${md(f.observedAt)}~)` : '';
  const next = f.stage === 'turning' && f.normals.peak ? ` · 평년 절정 ${md(f.normals.peak)}` : '';
  return `${foliageStageLabel(f.stage)}${since}${next}${where}`;
}

export function useFoliage(valleyId: string): {
  line: string | null;
  /** 잎 색. 관측 지점 없으면 `none`. */
  stage: FoliageStage | 'none';
  inSeason: boolean;
} {
  const inSeason = isFoliageSeason();
  const [state, setState] = useState<ApiFoliage | null>(null);
  useEffect(() => {
    if (!inSeason || !valleyId) return;
    let active = true;
    void api.foliage().then((r) => {
      if (!active || !r.ok) return;
      setState(r.value.find((x) => x.valleyId === valleyId) ?? null);
    });
    return () => {
      active = false;
    };
  }, [valleyId, inSeason]);
  const line = state ? foliageLine(state) : null;
  return { line, stage: state && state.confidence !== 'none' ? state.stage : 'none', inSeason };
}

/**
 * 계곡 전부의 잎 색 — 목록·지도용. 시즌 밖이면 빈 맵(잎을 그리지 않는다). 관측 지점 없는 계곡은 `none`.
 * `/api/foliage` 한 번으로 33곳을 받는다(서버 캐시 300 s).
 */
export function useFoliageStages(): ReadonlyMap<string, FoliageStage | 'none'> {
  const inSeason = isFoliageSeason();
  const [stages, setStages] = useState<ReadonlyMap<string, FoliageStage | 'none'>>(new Map());
  useEffect(() => {
    if (!inSeason) return;
    let active = true;
    void api.foliage().then((r) => {
      if (!active || !r.ok) return;
      setStages(
        new Map(r.value.map((f) => [f.valleyId, f.confidence === 'none' ? 'none' : f.stage])),
      );
    });
    return () => {
      active = false;
    };
  }, [inSeason]);
  return stages;
}
