/**
 * 접혀 있는 시트를 사람이 읽을 수 있는 높이로 올린다.
 *
 * **왜 필요한가.** 검색 결과도 구간·시설 상세도 **시트 안에만** 그려진다. 시트가
 * `peek` 이면 그 내용이 화면 아래로 밀려 있어, 사용자가 보기에는 "검색해도 아무 일도
 * 없고, 핀을 눌러도 정보가 안 나온다"(사용자 보고 2026-09-08, iOS 시뮬레이터). 상태는
 * 정상이고 화면만 접혀 있는 상태라 오류도 로그도 남지 않는다 — 조용히 실패하는 종류다.
 *
 * 그래서 **결과를 보여 주려는 동작**(검색어 입력, 계곡·시설·제보 선택, 설정 열기)은
 * 시트를 최소 `half` 까지 올린다. 이미 `half`·`full` 이면 그대로 둔다 — 사용자가 넓혀 둔
 * 것을 좁히지 않는다.
 *
 * festival(`/firework`)의 명당 선택은 이 규칙을 쓰지 않는다(CLAUDE.md 보존 — 데모의
 * 조작 결과를 바꾸지 않는다).
 */

import type { SessionStore } from './state/SessionStore';

export function revealSheet(store: SessionStore): void {
  if (store.state.sheetSnap === 'peek') store.setSheetSnap('half');
}
