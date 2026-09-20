/**
 * 계곡 하나의 단풍 상태 한 줄 — `GET /api/foliage` 를 시즌(9/15–11/30)에만 부른다.
 * 서버 판정(core `evaluateFoliage`)을 그대로 문장으로 옮길 뿐, 여기서 다시 판정하지 않는다.
 */
import { type ApiFoliage, foliageStageLabel } from '@modu-valley/core';
import { useEffect, useState } from 'react';
import { createApiClient } from '../api/createApiClient';

const api = createApiClient();

/** KST 기준 9/15 ~ 11/30. */
export function isFoliageSeason(now = new Date()): boolean {
  const kst = new Date(now.getTime() + 9 * 60 * 60_000);
  const md = (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
  return md >= 915 && md <= 1130;
}

const md = (day: string): string => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/** 화면 한 줄. `null` 은 자료 없음. */
export function foliageLine(f: ApiFoliage): string | null {
  if (f.confidence === 'none') return null;
  const tag = f.confidence === 'estimated' ? ' · 자료 적음' : '';
  switch (f.stage) {
    case 'green':
      return f.forecast.peak
        ? `${md(f.forecast.turning as string)} 물들기 · ${md(f.forecast.peak)} 절정 예상${tag}`
        : `${foliageStageLabel(f.stage)} · 예측 불가${tag}`;
    case 'turning':
      return `${foliageStageLabel(f.stage)}(${md(f.turningStart as string)}~) · ${md(f.forecast.peak as string)} 절정 예상${tag}`;
    case 'peak':
      return `${foliageStageLabel(f.stage)}(${md(f.peakStart as string)}~)${tag}`;
    case 'falling':
      return `${foliageStageLabel(f.stage)}(${md(f.fallingStart as string)}~)${tag}`;
    case 'dormant':
      return foliageStageLabel(f.stage);
  }
}

export function useFoliage(valleyId: string): { line: string | null; inSeason: boolean } {
  const inSeason = isFoliageSeason();
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    if (!inSeason || !valleyId) return;
    let active = true;
    void api.foliage().then((r) => {
      if (!active || !r.ok) return;
      const f = r.value.find((x) => x.valleyId === valleyId);
      setLine(f ? foliageLine(f) : null);
    });
    return () => {
      active = false;
    };
  }, [valleyId, inSeason]);
  return { line, inSeason };
}
