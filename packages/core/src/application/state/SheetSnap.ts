/**
 * 시트 스냅 (C8).
 *
 * 데모(festival)의 시트는 접힘/펴짐 2단이었다(`sheetCollapsed: boolean`). 계곡 화면 요구로
 * 한 칸(85vh)이 늘어 3단이 됐고, 사용자 결정으로 festival 도 같은 3단을 쓴다(TODO C8 결정
 * (a)(b) — `/firework` 보존 규칙과 부딪히지만, 사용자가 그 충돌을 알고 고른 선택이다.
 * 그래도 기본 스냅(`peek`/`half`)과 정지 상태 화면은 그대로여야 한다 — 새 상태(`full`)는
 * 사용자가 손잡이를 끌어올릴 때만 생긴다).
 *
 * 라우트(scene)별로 상수를 나눈 이유 — 지금은 두 라우트가 같은 값을 쓰지만(결정 (a)(b)),
 * 하나만 바뀌어야 할 때(예: festival 파리티 재조정) 값을 공유하다 실수로 같이 바뀌는 일을
 * 막기 위해서다. `peekPx` 는 창 높이와 무관한 절대값(데모 원본), `halfRatio`/`fullRatio` 는
 * 창 높이에 곱하는 비율이다 — 실제 픽셀 변환은 표현 계층이 한다(창 높이를 재는 RN 훅은
 * core 가 모른다).
 */

import type { Scene } from './AppState';

export const SHEET_SNAPS = ['peek', 'half', 'full'] as const;
export type SheetSnap = (typeof SHEET_SNAPS)[number];

export function isSheetSnap(value: string | null | undefined): value is SheetSnap {
  return (
    value !== null && value !== undefined && (SHEET_SNAPS as readonly string[]).includes(value)
  );
}

/** 시트의 기본 스냅(반 펼침) — 세션의 첫 스냅이자 URL 기본값(결정 (d) 해석 2). */
export const DEFAULT_SHEET_SNAP: SheetSnap = 'half';

/** 손잡이 탭 — 다음 칸으로 순환한다(결정 (e) 해석 1). `peek → half → full → peek`. */
export function nextSheetSnap(current: SheetSnap): SheetSnap {
  const index = SHEET_SNAPS.indexOf(current);
  const next = SHEET_SNAPS[(index + 1) % SHEET_SNAPS.length];
  if (next === undefined) throw new Error('unreachable: SHEET_SNAPS 는 비어 있지 않다');
  return next;
}

export type SheetSnapMetrics = {
  /** 접힘에서 남는 높이(px). 데모 `SIZES.sheetCollapsedPeek` 와 같은 값(그대로 보존). */
  readonly peekPx: number;
  /** 중간 스냅 — 창 높이에 곱하는 비율. 데모 `SIZES.sheetHeightRatio` 와 같은 값(그대로 보존). */
  readonly halfRatio: number;
  /** 펼침 스냅(결정 (a), 신설) — 창 높이에 곱하는 비율. */
  readonly fullRatio: number;
};

/**
 * 결정 (a)(b) 의 수치. 접힘 68px·중간 45vh 는 지금 값 그대로다 — 앱의
 * `theme/tokens.ts` `SIZES.sheetCollapsedPeek`/`sheetHeightRatio` 가 같은 값을 들고
 * 있는 것은 우연이 아니라 그 값(데모 파리티가 얼려 둔 값)을 core 가 그대로 다시 쓰기
 * 때문이다. 펼침 85vh 가 이번에 늘어난 새 값이다.
 */
const BASE_SHEET_SNAP_METRICS: SheetSnapMetrics = { peekPx: 68, halfRatio: 0.45, fullRatio: 0.85 };

export const SHEET_SNAP_METRICS: Readonly<Record<Scene, SheetSnapMetrics>> = {
  festival: BASE_SHEET_SNAP_METRICS,
  valley: BASE_SHEET_SNAP_METRICS,
};

/** 스냅이 화면에 남기는 시트 높이(px). `windowHeight` 는 표현 계층이 잰다. */
export function sheetVisibleHeight(
  snap: SheetSnap,
  windowHeight: number,
  metrics: SheetSnapMetrics,
): number {
  switch (snap) {
    case 'peek':
      return metrics.peekPx;
    case 'half':
      return windowHeight * metrics.halfRatio;
    case 'full':
      return windowHeight * metrics.fullRatio;
  }
}

/**
 * 시트 컨테이너의 실제 높이 — **정지 상태 기준**. `peek`은 `half`의 컨테이너를 빌려
 * 쓴다(그 컨테이너 안에서 68px 만 보이게 `sheetTranslateY` 가 내린다) — 데모/`main` 이
 * 항상 `half` 높이 하나만 컨테이너로 썼던 것과 정확히 같다(회귀 고정). `full` 만 자기
 * 컨테이너(85vh)를 쓴다. 그래서 `peek`/`half` 는 컨테이너·translateY 가 지금과
 * 한 픽셀도 다르지 않다.
 *
 * `full` 과 `peek`/`half` 사이를 오가는 애니메이션 도중에는(컨테이너가 실제로 자라거나
 * 줄어드는 순간) 이 값만으로 부족하다 — 표현 계층(`useSheetTranslate`)이 애니메이션
 * 동안은 큰 쪽(`full`) 컨테이너를 임시로 빌리고 끝나면 이 "정지 상태" 값으로 되돌린다.
 * 그 보정이 없으면 컨테이너가 바뀌는 순간 시트가 순간이동해 보인다.
 */
export function sheetContainerHeight(
  snap: SheetSnap,
  windowHeight: number,
  metrics: SheetSnapMetrics,
): number {
  return windowHeight * (snap === 'full' ? metrics.fullRatio : metrics.halfRatio);
}

/**
 * 스냅 → translateY(정지 상태). `half`/`full` 은 컨테이너가 곧 그 스냅의 가시 높이라
 * 0 이다(main 의 `translateY(0)` 과 정확히 같다) — `peek` 만 `half` 컨테이너를 빌려
 * 쓰는 만큼 0 이 아니다(main 의 옛 `.sheet.down` 과 같은 값).
 */
export function sheetTranslateY(
  snap: SheetSnap,
  windowHeight: number,
  metrics: SheetSnapMetrics,
): number {
  const container = sheetContainerHeight(snap, windowHeight, metrics);
  const visible = sheetVisibleHeight(snap, windowHeight, metrics);
  return Math.max(0, container - visible);
}

/**
 * 드래그 중에 쓰는 translateY — 컨테이너를 **항상 `full` 기준**으로 고정하고 그 안에서
 * 스냅의 가시 높이만 보이게 계산한다. 드래그는 세 스냅을 자유롭게 오가야 하므로
 * 컨테이너가 매 순간 제일 큰 값이어야 한다(정지 상태의 `sheetContainerHeight` 는
 * 스냅마다 다른 값을 써서 이 용도에 맞지 않는다). 놓았을 때 `nearestSheetSnap` 이
 * 보는 좌표계도 이것이다.
 */
export function sheetDragTranslateY(
  snap: SheetSnap,
  windowHeight: number,
  metrics: SheetSnapMetrics,
): number {
  const container = sheetContainerHeight('full', windowHeight, metrics);
  const visible = sheetVisibleHeight(snap, windowHeight, metrics);
  return Math.max(0, container - visible);
}

/** 드래그를 놓은 위치(translateY, `full` 기준 좌표계)에서 가장 가까운 스냅으로 커밋한다(결정 (e)). */
export function nearestSheetSnap(
  translateY: number,
  windowHeight: number,
  metrics: SheetSnapMetrics,
): SheetSnap {
  let closest: SheetSnap = 'half';
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const snap of SHEET_SNAPS) {
    const distance = Math.abs(translateY - sheetDragTranslateY(snap, windowHeight, metrics));
    if (distance < closestDistance) {
      closest = snap;
      closestDistance = distance;
    }
  }
  return closest;
}

/** URL `?sheet=` 값 파싱. 잘못됐거나 없으면 기본 스냅으로 떨어진다(결정 (d)). */
export function parseSheetSnapParam(raw: string | null | undefined): SheetSnap {
  if (raw !== null && raw !== undefined && isSheetSnap(raw)) return raw;
  return DEFAULT_SHEET_SNAP;
}

/**
 * 스냅 → URL 값. 기본 스냅이면 `undefined` — 호출부가 파라미터를 아예 지운다
 * (해석 2, "기본 스냅일 때는 파라미터를 쓰지 않는다" — 기존 링크가 그대로 동작한다).
 */
export function sheetSnapToParam(snap: SheetSnap): string | undefined {
  return snap === DEFAULT_SHEET_SNAP ? undefined : snap;
}
