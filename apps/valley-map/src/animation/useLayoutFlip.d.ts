/**
 * 목록 배치 전환(행 ↔ 타일) 애니메이션의 공용 계약.
 *
 * web 구현은 FLIP 기법 + Web Animations API 로 데모를 그대로 옮기고,
 * 네이티브 구현은 아직 없다(즉시 전환). 어느 쪽이든 호출부 코드는 같다.
 */

/** 항목 하나의 DOM/네이티브 노드. 플랫폼에 따라 실체가 다르다. */
export type LayoutFlipNode = unknown;

export type LayoutFlipController = {
  /** 항목 노드를 등록한다. 언마운트 시 `null` 로 해제한다. */
  readonly registerItem: (key: string, node: LayoutFlipNode | null) => void;
  /** 배치를 바꾸기 **직전** 위치를 잰다 (FLIP 의 First). */
  readonly capture: () => void;
  /** 배치가 반영된 **직후** 부른다. 차이를 되돌린 뒤 재생한다 (Last/Invert/Play). */
  readonly play: () => void;
  /** 진행 중인 전환을 걷어낸다. */
  readonly cancel: () => void;
};

export declare function useLayoutFlip(): LayoutFlipController;
