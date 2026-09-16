/**
 * 계곡 목록 위의 조회 — 어느 계곡의 것인지 모르는 id 를 찾는다.
 *
 * 지도 히트(`feature-press`)는 구간·시설 id 만 실어 오고 계곡 id 는 없다.
 * 유즈케이스가 매번 계곡 배열을 뒤지지 않도록 여기 모았다. 결과에 소속 계곡을
 * 함께 돌려주는 이유는 "가장 가까운 주차장"·"이 계곡의 시설" 이 계곡 단위
 * 조회이기 때문이다.
 */
import { ValleyError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';
import type { Facility } from './Facility';
import type { FacilityId, SegmentId } from './ids';
import type { Segment } from './Segment';
import type { Valley } from './Valley';

export type SegmentLookup = { readonly valley: Valley; readonly segment: Segment };
export type FacilityLookup = { readonly valley: Valley; readonly facility: Facility };

export function lookupSegment(
  valleys: readonly Valley[],
  id: SegmentId,
): Result<SegmentLookup, ValleyError> {
  for (const valley of valleys) {
    const found = valley.findSegment(id);
    if (found.ok) return ok({ valley, segment: found.value });
  }
  return err(
    new ValleyError('valley/segment-not-found', '해당 구간을 찾을 수 없습니다.', {
      context: { segmentId: id },
    }),
  );
}

export function lookupFacility(
  valleys: readonly Valley[],
  id: FacilityId,
): Result<FacilityLookup, ValleyError> {
  for (const valley of valleys) {
    const found = valley.findFacility(id);
    if (found.ok) return ok({ valley, facility: found.value });
  }
  return err(
    new ValleyError('valley/facility-not-found', '해당 시설을 찾을 수 없습니다.', {
      context: { facilityId: id },
    }),
  );
}
