/**
 * 조건 필터 칩 (N1) — 목록·지도에서 계곡을 거르는 5개 칩.
 *
 * 실측이 원안(7종: 무료·야영·반려견·그늘 많음·얕은 수심·주차장·화장실 없음)을
 * 뒤집었다 — `docs/TODO.md` N1 절. 반려견(1/30)·얕은 수심(0/30)은 아무것도
 * 못 거르거나 눌러도 항상 0곳이라 뺐다(결정 (a)). 화장실은 원안에 없었지만
 * 커버리지가 가장 좋아 추가됐다.
 *
 * "그늘 많음" 은 N5 구간 카드 배지와 **같은 술어**를 쓴다(`shadeTags(segment).amount
 * === 'many'`, 종일 평균 ≥ `SHADE_AMOUNT_MANY_MIN`) — 카드에 "나무 그늘 많음" 배지가
 * 붙은 계곡은 반드시 이 칩에도 걸려야 한다. 처음엔 수관 비율(`canopyCover`) 기준으로
 * 짰다가(6/30) 카드 배지(종일 평균 기준 8/30)와 술어가 달라 "카드엔 많음인데 칩을
 * 누르면 사라지는" 불일치가 나왔다 — 리뷰에서 잡혀 `shadeTags` 재사용으로 정정했다.
 *
 * 술어는 **계곡** 단위다(결정 (b) "정보 없는 계곡은 제외"). 화장실·주차장은 시설
 * 존재 여부라 "없음"이 곧 "아니오" — 이 둘은 `undefined`(정보 없음)를 돌려주지
 * 않는다. 무료·야영·그늘은 구간 속성이라 시딩 초기 구간처럼 값 자체가 없을 수
 * 있다 — 그럴 때만 `undefined`. 계곡에 구간이 여럿이면(장래, 지금은 전부 1구간)
 * 하나라도 참이면 계곡 전체가 참, 전부 모르면 정보 없음("이 계곡 어디선가는
 * 무료"라는 확신이 서면 계곡 전체를 참으로 본다).
 */
import type { FacilityType } from './Facility';
import type { ValleyId } from './ids';
import type { Segment } from './Segment';
import { shadeTags } from './shadeTags';
import type { Valley } from './Valley';

/** 칩 5종의 키. 순서 = 결정 (a) 의 표시 순서. */
export const FILTER_CHIP_KEYS = [
  'restroom',
  'parking',
  'freeAccess',
  'camping',
  'shadeMany',
] as const;
export type FilterChipKey = (typeof FILTER_CHIP_KEYS)[number];

export type FilterChipDefinition = {
  readonly key: FilterChipKey;
  readonly label: string;
  /** 이 계곡이 조건에 맞는지. 판단할 정보가 없으면 `undefined`(결정 (b), 제외 대상). */
  readonly matches: (valley: Valley) => boolean | undefined;
};

function hasFacility(type: FacilityType): (valley: Valley) => boolean {
  return (valley) => valley.facilitiesOf(type).length > 0;
}

/**
 * 구간 속성 하나를 계곡 단위로 모은다 — 하나라도 참이면 계곡은 참, 값이 하나도
 * 없으면(전부 `undefined`) 계곡은 정보 없음, 나머지(값은 있지만 전부 거짓)는 거짓.
 */
function segmentFlag(
  read: (segment: Segment) => boolean | undefined,
): (valley: Valley) => boolean | undefined {
  return (valley) => {
    let known = false;
    for (const segment of valley.segments) {
      const value = read(segment);
      if (value === undefined) continue;
      known = true;
      if (value) return true;
    }
    return known ? false : undefined;
  };
}

/**
 * 그늘 많음 — N5 카드 배지와 같은 술어(`shadeTags` 의 `amount === 'many'`, 종일 평균
 * ≥ `SHADE_AMOUNT_MANY_MIN`). `shadeByHour` 미산출 구간은 `shadeTags` 가 `null` →
 * 정보 없음.
 */
function shadeManyOf(segment: Segment): boolean | undefined {
  const tags = shadeTags(segment);
  return tags === null ? undefined : tags.amount === 'many';
}

/**
 * 칩 정의 5종. 표시 순서 = 배열 순서(결정 (a)).
 *
 * **문구 규칙(2026-09-08 사용자 지적 "텍스트 배치 및 규칙이 서비스 컴포넌트와 맞지 않아보임")**
 * — 칩과 카드 배지는 하는 일이 다르므로 문구의 품사도 다르게 고정한다.
 *
 *   칩   = **조건**(무엇으로 걸러내는가) → **명사 최단형**. 어미(있음·가능·입장)를 붙이지 않는다.
 *          정도를 나타내는 말만 남긴다("그늘 많음" 의 "많음").
 *   배지 = **상태**(이 구간이 어떤가) → 서술형. `VALLEY_COPY.badges`("야영 가능"·"반려견 동반")와
 *          `shadeAmountLabel`("나무 그늘 많음")이 그쪽 규칙이고, 이 파일은 그것을 건드리지 않는다.
 *
 * 고친 것: `화장실 있음`→`화장실` · `주차장 있음`→`주차장` · `무료 입장`→`무료`(카드 배지와 같은
 * 말이 된다) · `야영 가능`→`야영`. `그늘 많음` 은 정도어라 유지한다.
 */
export const FILTER_CHIPS: readonly FilterChipDefinition[] = [
  { key: 'restroom', label: '화장실', matches: hasFacility('restroom') },
  { key: 'parking', label: '주차장', matches: hasFacility('parking') },
  { key: 'freeAccess', label: '무료', matches: segmentFlag((segment) => segment.freeAccess) },
  {
    key: 'camping',
    label: '야영',
    matches: segmentFlag((segment) => segment.campingAllowed),
  },
  { key: 'shadeMany', label: '그늘 많음', matches: segmentFlag(shadeManyOf) },
];

const FILTER_CHIP_BY_KEY: ReadonlyMap<FilterChipKey, FilterChipDefinition> = new Map(
  FILTER_CHIPS.map((chip) => [chip.key, chip]),
);

export function filterChipLabel(key: FilterChipKey): string {
  return FILTER_CHIP_BY_KEY.get(key)?.label ?? key;
}

/**
 * 선택 집합에서 칩 하나를 토글 — 새 `Set` 을 돌려준다(있으면 빼고, 없으면 더한다).
 * `SessionStore` 는 참조 비교로 변경을 판단하므로 항상 새 참조를 낸다.
 */
export function toggleFilterChip(
  selected: ReadonlySet<FilterChipKey>,
  key: FilterChipKey,
): ReadonlySet<FilterChipKey> {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** 선택된 칩 전부에 대한 이 계곡의 판정. */
export type ChipOutcome = 'match' | 'no-match' | 'no-info';

/**
 * 선택된 칩 전부의 AND 판정(결정 (c)). 하나라도 확실히 아니면(`false`) 곧장
 * `'no-match'` — 다른 칩이 정보 없음이어도 그렇다(확실한 배제가 "모름"보다 강하다).
 * 배제가 없고 정보 없음이 하나라도 있으면 `'no-info'`, 나머지는 `'match'`.
 * 선택이 비어 있으면(칩 없음) 언제나 `'match'`.
 */
export function evaluateFilterChips(
  valley: Valley,
  selected: ReadonlySet<FilterChipKey>,
): ChipOutcome {
  let sawMissing = false;
  for (const key of selected) {
    const chip = FILTER_CHIP_BY_KEY.get(key);
    if (chip === undefined) continue;
    const value = chip.matches(valley);
    if (value === false) return 'no-match';
    if (value === undefined) sawMissing = true;
  }
  return sawMissing ? 'no-info' : 'match';
}

export type FilterValleysResult = {
  /** 필터를 통과한 계곡(핀 고정 포함) — 입력 순서를 보존한다. */
  readonly valleys: readonly Valley[];
  /** 정보가 없어 제외된 계곡 수(결정 (b) 목록 하단 문구의 재료). 핀 고정된 계곡은 세지 않는다. */
  readonly excludedByMissingInfo: number;
};

/**
 * 계곡 목록에 선택된 칩을 AND 로 적용한다(결정 (c)(f)). `pinnedValleyId` 는 필터를
 * 이긴다(해석 4) — 상세가 열린 계곡(또는 그 계곡의 시설이 선택된 경우)은 걸러져도
 * 결과에 남는다. 칩이 하나도 선택되지 않으면 그대로 돌려준다(핀도 필요 없다 —
 * 전부 보이는 중이다).
 */
export function filterValleys(
  valleys: readonly Valley[],
  selected: ReadonlySet<FilterChipKey>,
  pinnedValleyId?: ValleyId,
): FilterValleysResult {
  if (selected.size === 0) return { valleys, excludedByMissingInfo: 0 };
  const kept: Valley[] = [];
  let excludedByMissingInfo = 0;
  for (const valley of valleys) {
    if (valley.id === pinnedValleyId) {
      kept.push(valley);
      continue;
    }
    const outcome = evaluateFilterChips(valley, selected);
    if (outcome === 'match') kept.push(valley);
    else if (outcome === 'no-info') excludedByMissingInfo += 1;
  }
  return { valleys: kept, excludedByMissingInfo };
}

/**
 * 칩마다 "지금 선택에 이 칩을 더하면(이미 선택돼 있으면 그대로) 몇 곳이 남는지"
 * (결정 (b) — 다른 칩의 선택을 반영한 값, AND 조합 뒤 남는 수). 칩이 하나도
 * 선택되지 않았으면 각 칩의 단독 개수가 된다. 핀은 반영하지 않는다 — 칩 배지는
 * 데이터 전체에 대한 개수이지, 지금 열린 상세를 봐주는 값이 아니다.
 */
export function filterChipMatchCounts(
  valleys: readonly Valley[],
  selected: ReadonlySet<FilterChipKey>,
): ReadonlyMap<FilterChipKey, number> {
  const counts = new Map<FilterChipKey, number>();
  for (const chip of FILTER_CHIPS) {
    const withChip = selected.has(chip.key) ? selected : new Set(selected).add(chip.key);
    let count = 0;
    for (const valley of valleys) {
      if (evaluateFilterChips(valley, withChip) === 'match') count += 1;
    }
    counts.set(chip.key, count);
  }
  return counts;
}
