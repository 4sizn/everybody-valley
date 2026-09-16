/**
 * 투영 모드.
 *
 * 데모는 `setProjection({type:'globe'})` 를 style.load 이후에 건다. 외부
 * 스타일 URL 을 쓰면 스타일에 projection 이 없어 mercator 로 초기화되기
 * 때문이다(데모 주석). 'globe' 는 적응형이라 멀리서는 구체, 가까이 가면
 * 메르카토르로 모핑한다.
 */
export const PROJECTION_MODES = ['mercator', 'globe', 'vertical-perspective'] as const;
export type ProjectionMode = (typeof PROJECTION_MODES)[number];
