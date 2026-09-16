/**
 * 관리자가 숨김/복구한 뒤 계곡 화면의 제보 피드(`AppState.reports`)를 다시 채운다(OPS1).
 *
 * `MapSession` 은 SSE `report` 채널(새 제보 생성)에만 반응해 이 목록을 다시 부른다 —
 * 숨김·복구는 그 이벤트를 타지 않으므로(서버가 새 SSE 를 쏘지 않는다, 감사 로그만 남긴다)
 * 표현 계층이 직접 다시 물어야 한다. `MapSession#wireReports` 와 같은 한도(`limit`)를
 * 쓴다 — 그 값은 `MapSession` 내부에 갇혀 있어 여기서는 같은 수를 다시 적는다(임시 기능이라
 * core 를 더 넓히지 않는다).
 */
import { type ApiPort, type MapSession, parseApiReports } from '@modu-valley/core';

const REPORT_QUERY_LIMIT = 50;

export async function refreshValleyReports(session: MapSession, apiClient: ApiPort): Promise<void> {
  const result = await apiClient.reports({ limit: REPORT_QUERY_LIMIT });
  if (!result.ok) return;
  session.store.setReports(parseApiReports(result.value.reports));
}
