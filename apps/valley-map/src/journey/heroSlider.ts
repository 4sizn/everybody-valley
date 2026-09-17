/**
 * 홈 히어로 슬라이더의 순수 계산 (사용자 요청 2026-09-17 "스와이프 + 자동 넘김").
 *
 * 슬라이드 이동은 CSS 스크롤 스냅이 맡는다 — 캐러셀 라이브러리를 넣지 않는 이유다. 손가락
 * 스와이프는 브라우저의 가로 스크롤 그대로이고, 자동 넘김만 다음 위치를 계산해 스크롤한다.
 */

/** 자동 넘김 간격(ms). */
export const HERO_ROTATE_MS = 6000;

/**
 * 다음 슬라이드의 스크롤 위치(px). 마지막 다음은 처음으로 돌아온다.
 *
 * 스크롤 위치가 슬라이드 경계에 딱 맞지 않아도(스냅 도중, 소수점 폭) 가장 가까운 슬라이드를
 * 현재로 본다.
 */
export function nextSlideLeft(scrollLeft: number, width: number, count: number): number {
  if (width <= 0 || count < 2) return 0;
  const current = Math.round(scrollLeft / width);
  return ((current + 1) % count) * width;
}

/** 이만큼 넘게 끌었으면 클릭이 아니라 슬라이드 넘김으로 본다(px). */
export const DRAG_SLOP_PX = 8;

/**
 * 가장 가까운 슬라이드 경계(px). 마우스로 끌면 스냅을 잠시 끄기 때문에, 손을 뗄 때 직접
 * 맞춰 줘야 한다.
 */
export function snappedLeft(scrollLeft: number, width: number): number {
  if (width <= 0) return 0;
  return Math.max(0, Math.round(scrollLeft / width) * width);
}
