/**
 * 지도 밀도 제어 컬럼 — 데이터 생성 시점에 굽는 값.
 *
 * spotts 가 클러스터링 없이 수천 개 마커를 뿌리는 방식 그대로다.
 *   · `mapIconTier`  0 유명 계곡 / 1 지선 / 2 소규모 소(沼)·명소. 아이콘 노출 줌 단계
 *   · `mapLabelTier` 라벨 노출 줌 단계
 *   · `mapImportance` symbol-sort-key. 작을수록 위에 그린다
 *
 * 구간과 시설이 같은 컬럼을 쓰므로 여기 한 곳에 둔다.
 */
export const MAP_TIERS = [0, 1, 2] as const;
export type MapTier = (typeof MAP_TIERS)[number];

export function isMapTier(value: unknown): value is MapTier {
  return (MAP_TIERS as readonly unknown[]).includes(value);
}
