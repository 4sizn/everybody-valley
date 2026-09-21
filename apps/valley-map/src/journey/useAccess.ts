/**
 * 계곡 하나의 출입 통제 한 줄 — `GET /api/access`. 서버 판정(core `evaluateAccess`)을 문장으로
 * 옮길 뿐 다시 판정하지 않는다. 통제·개방 기록이 없고 다가오는 통제도 없으면 줄을 감춘다 —
 * 여름 내내 "통제 정보 없음" 을 보여 주는 건 소음이다. 산불조심기간(2/1~5/15 · 11/1~12/15)엔
 * 정보가 없어도 "통제 정보 없음 · 관할 확인" 을 보여 준다.
 */
import { type ApiAccess, accessStatusLabel } from '@modu-valley/core';
import { useEffect, useState } from 'react';
import { createApiClient } from '../api/createApiClient';

const api = createApiClient();

/** KST 기준 산불조심기간 — 봄 2/1~5/15, 가을 11/1~12/15. */
export function isWildfireSeason(now = new Date()): boolean {
  const kst = new Date(now.getTime() + 9 * 60 * 60_000);
  const md = (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
  return (md >= 201 && md <= 515) || (md >= 1101 && md <= 1215);
}

const md = (day: string): string => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/** 화면 한 줄. `null` 은 숨김. */
export function accessLine(a: ApiAccess, inSeason: boolean): string | null {
  if (a.control) {
    return `${accessStatusLabel(a.status)} ${md(a.control.from)}~${md(a.control.to)} · ${a.control.agency}`;
  }
  if (a.upcoming) {
    return `${md(a.upcoming.from)}부터 ${accessStatusLabel(a.upcoming.kind === 'trail-open' ? 'trail-open' : 'closed')} 예정 · ${a.upcoming.agency}`;
  }
  return inSeason ? `${accessStatusLabel('unknown')} · 관할 확인` : null;
}

export function useAccess(valleyId: string): { line: string | null; status: ApiAccess['status'] } {
  const [state, setState] = useState<ApiAccess | null>(null);
  useEffect(() => {
    if (!valleyId) return;
    let active = true;
    void api.access().then((r) => {
      if (!active || !r.ok) return;
      setState(r.value.find((x) => x.valleyId === valleyId) ?? null);
    });
    return () => {
      active = false;
    };
  }, [valleyId]);
  return {
    line: state ? accessLine(state, isWildfireSeason()) : null,
    status: state?.status ?? 'unknown',
  };
}
