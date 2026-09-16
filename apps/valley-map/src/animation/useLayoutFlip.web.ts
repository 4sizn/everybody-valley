/**
 * 목록 배치 전환 — FLIP 기법 (web).
 *
 * 데모 주석 그대로:
 *   First  : 바꾸기 전 각 항목의 좌표를 잰다
 *   Last   : 클래스를 바꾼 직후 좌표를 다시 잰다
 *   Invert : 차이만큼 되돌려 놓아 "안 움직인 것처럼" 만들고
 *   Play   : 0 으로 풀면서 실제 이동을 재생한다
 *
 * 중간 지점의 `rotateY(-72deg)` 는 거의 옆면이 되는 순간 폭·높이가 바뀌게
 * 해서 크기 변화가 눈에 걸리지 않게 하는 장치다(scale 로 늘리면 글자가
 * 찌그러진다). 이징을 effect 전체가 아니라 **키프레임마다** 거는 것도
 * 데모와 같다 — 전체에 걸면 접힘이 앞쪽 95ms 에 몰린다.
 *
 * 진행 중 전환은 플래그가 아니라 `cancel()` 로 걷어낸다. 데모 주석의 경고
 * 대로, 취소된 애니메이션은 finish 이벤트를 주지 않아 플래그를 쓰면 토글이
 * 영구히 죽는다.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { LayoutFlipController, LayoutFlipNode } from './useLayoutFlip';

const DURATION_MS = 560;
const STEP_DELAY_MS = 48;
const MID_OFFSET = 0.46;
const MID_SCALE = 0.45;
const MID_ROTATION_DEG = -72;
const MID_OPACITY = 0.18;

type Rect = { readonly left: number; readonly top: number };

export function useLayoutFlip(): LayoutFlipController {
  const nodes = useRef(new Map<string, HTMLElement>()).current;
  const first = useRef(new Map<string, Rect>()).current;
  const running = useRef<Animation[]>([]);

  const cancel = useCallback(() => {
    for (const animation of running.current) {
      try {
        animation.cancel();
      } catch {
        // 이미 끝난 애니메이션의 cancel 은 무해하다.
      }
    }
    running.current = [];
  }, []);

  const registerItem = useCallback(
    (key: string, node: LayoutFlipNode | null) => {
      if (node === null) {
        nodes.delete(key);
        return;
      }
      nodes.set(key, node as HTMLElement);
    },
    [nodes],
  );

  const capture = useCallback(() => {
    cancel();
    first.clear();
    for (const [key, node] of nodes) {
      const rect = node.getBoundingClientRect();
      first.set(key, { left: rect.left, top: rect.top });
    }
  }, [cancel, first, nodes]);

  const play = useCallback(() => {
    if (first.size === 0) return;

    const animations: Animation[] = [];
    let index = 0;
    for (const [key, node] of nodes) {
      const before = first.get(key);
      index += 1;
      if (before === undefined) continue;

      const after = node.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;

      animations.push(
        node.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px) rotateY(0deg)`,
              opacity: 1,
              offset: 0,
              easing: 'cubic-bezier(.55,0,1,.45)',
            },
            {
              transform: `translate(${dx * MID_SCALE}px, ${dy * MID_SCALE}px) rotateY(${MID_ROTATION_DEG}deg)`,
              opacity: MID_OPACITY,
              offset: MID_OFFSET,
              easing: 'cubic-bezier(0,.55,.45,1)',
            },
            { transform: 'translate(0,0) rotateY(0deg)', opacity: 1, offset: 1 },
          ],
          {
            duration: DURATION_MS,
            delay: (index - 1) * STEP_DELAY_MS,
            fill: 'both',
            easing: 'linear',
          },
        ),
      );
    }

    running.current = animations;
    first.clear();

    // `finished` 는 cancel 시 reject 되므로 allSettled 로 받아야 중간에 끊겨도
    // 잔여 transform 이 남지 않는다.
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      for (const animation of animations) {
        try {
          if (animation.playState === 'finished') animation.cancel();
        } catch {
          // 무해
        }
      }
    });
  }, [first, nodes]);

  useEffect(() => cancel, [cancel]);

  return useMemo(
    () => ({ registerItem, capture, play, cancel }),
    [registerItem, capture, play, cancel],
  );
}
