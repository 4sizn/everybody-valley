/**
 * 검색 — 계곡명·시설명 부분일치 (SR1, 사용자 결정 2026-09-08 `docs/TODO.md` "SR1" 절).
 *
 * 지오코딩·주소·초성 검색은 범위 밖이다(K1 회신 이후 별 항목). 대상은 계곡명 31 +
 * 시설명 332 뿐 — 공백을 지우고 소문자화한 뒤 부분일치로 견준다("긴고랑로" 같은
 * 서울 도로명은 이 데이터에 없어 결과 0 이 맞다).
 *
 * 필터 칩과 무관하다 — 이 함수는 `filterChips` 를 받지 않는다(결정 6, "검색은
 * 필터를 무시한다"). 필터가 걸려 있다는 안내는 표현 계층의 몫이다.
 *
 * 정렬(결정 3) — 계곡 매치가 시설 매치보다 위, 각 그룹 안에서는 접두사 매치
 * 우선 → 이름 순(`localeCompare('ko')`). 상한(결정 7)은 두 그룹을 이은 뒤 자른다 —
 * 계곡 매치만으로 20 을 넘는 일은 없지만(전체 30곳), 규칙은 전체 목록 기준이다.
 */
import type { Facility } from './Facility';
import type { SegmentId } from './ids';
import type { Valley } from './Valley';

/** 결과 상한(결정 7). */
export const SEARCH_RESULT_LIMIT = 20;

export type ValleySearchResult = {
  readonly kind: 'valley';
  readonly valley: Valley;
  /**
   * 선택 시 열 구간 — 가장 상류(정렬된 첫) 구간. `Valley` 는 구간이 하나 이상임을
   * 생성자가 보장하므로 항상 있다. 여러 구간 계곡도 하나를 골라야 `SelectSegmentUseCase`
   * 를 그대로 재사용할 수 있다(결정 5) — 계곡을 통째로 선택하는 유즈케이스는 없다.
   */
  readonly segmentId: SegmentId;
};

export type FacilitySearchResult = {
  readonly kind: 'facility';
  /** "계곡명 · 시설명 · 유형"(결정 4) 조립에 계곡명이 필요해 함께 든다. */
  readonly valley: Valley;
  readonly facility: Facility;
};

export type SearchResult = ValleySearchResult | FacilitySearchResult;

/** 공백 전부 제거 + 소문자화. 두 쪽(질의·이름) 모두 이 함수로 정규화해야 견줄 수 있다. */
function normalizeForSearch(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/** 접두사 매치가 위, 그 안에서는 이름 순(가나다). */
function compareByPrefixThenName<T>(
  nameOf: (item: T) => string,
  normalizedQuery: string,
): (a: T, b: T) => number {
  return (a, b) => {
    const aRank = normalizeForSearch(nameOf(a)).startsWith(normalizedQuery) ? 0 : 1;
    const bRank = normalizeForSearch(nameOf(b)).startsWith(normalizedQuery) ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return nameOf(a).localeCompare(nameOf(b), 'ko');
  };
}

/**
 * 계곡명·시설명 부분일치 검색. 빈 질의(공백만이어도)는 빈 배열 — 검색 모드가
 * 아니라는 판단은 표현 계층이 원본 문자열 길이로 한다("빈 질의는 검색 모드
 * 아님"), 이 함수는 정규화 후 실제로 견줄 것이 없으면 그냥 아무것도 찾지 않는다.
 */
export function searchCatalog(valleys: readonly Valley[], query: string): readonly SearchResult[] {
  const normalizedQuery = normalizeForSearch(query);
  if (normalizedQuery === '') return [];

  const valleyMatches: ValleySearchResult[] = [];
  const facilityMatches: FacilitySearchResult[] = [];

  for (const valley of valleys) {
    if (normalizeForSearch(valley.name).includes(normalizedQuery)) {
      const firstSegment = valley.segments[0];
      if (firstSegment !== undefined) {
        valleyMatches.push({ kind: 'valley', valley, segmentId: firstSegment.id });
      }
    }
    for (const facility of valley.facilities) {
      if (normalizeForSearch(facility.name).includes(normalizedQuery)) {
        facilityMatches.push({ kind: 'facility', valley, facility });
      }
    }
  }

  valleyMatches.sort(compareByPrefixThenName((match) => match.valley.name, normalizedQuery));
  facilityMatches.sort(compareByPrefixThenName((match) => match.facility.name, normalizedQuery));

  return [...valleyMatches, ...facilityMatches].slice(0, SEARCH_RESULT_LIMIT);
}
