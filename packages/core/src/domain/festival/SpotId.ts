/**
 * 명당 식별자. 브랜드 타입이라 일반 문자열이 섞여 들어오지 못한다.
 *
 * 원본 데모는 배열 인덱스(`data-i`, `properties.idx`)를 식별자로 쓴다.
 * 목록 순서가 바뀌면 지도 클릭과 상세가 어긋나므로 안정된 id 로 바꿨다.
 */
declare const SPOT_ID_BRAND: unique symbol;

export type SpotId = string & { readonly [SPOT_ID_BRAND]: 'SpotId' };

export function toSpotId(raw: string): SpotId {
  return raw as SpotId;
}
