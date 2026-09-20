/**
 * 계곡 주변 시설 한 줄 요약 — 시설 탭 맨 위. "화장실 2 · 주차장 3(가장 가까운 63 m) · 정자 1".
 *
 * 있는 것만 말하고, 사람이 꼭 묻는 둘(화장실·주차장)은 없을 때도 "없음"으로 말한다 —
 * 목록을 훑어 내려가지 않아도 답이 되게. 쓰레기통은 등록 데이터가 없으니(OSM·표준데이터
 * 둘 다 한국 계곡엔 비어 있다) 시설 종류로 세지 않고 되가져가기 안내만 붙인다.
 */
import { FACILITY_TYPES, type FacilityType, facilityTypeLabel } from './Facility';
import type { FacilityAtDistance } from './Valley';

/** 없어도 꼭 말하는 종류. */
const ALWAYS_MENTION: readonly FacilityType[] = ['restroom', 'parking'];

export function facilitySummary(nearby: readonly FacilityAtDistance[]): string {
  const parts: string[] = [];
  for (const type of FACILITY_TYPES) {
    const items = nearby.filter((f) => f.facility.facilityType === type);
    if (items.length === 0) {
      if (ALWAYS_MENTION.includes(type)) parts.push(`${facilityTypeLabel(type)} 없음`);
      continue;
    }
    const nearest = items[0] as FacilityAtDistance; // 호출자가 가까운 순으로 준다
    parts.push(
      type === 'parking'
        ? `${facilityTypeLabel(type)} ${items.length}(가장 가까운 ${nearest.distance.format()})`
        : `${facilityTypeLabel(type)} ${items.length}`,
    );
  }
  parts.push('쓰레기는 되가져가기');
  return parts.join(' · ');
}
