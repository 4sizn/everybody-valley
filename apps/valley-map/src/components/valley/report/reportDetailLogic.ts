/**
 * 제보 상세(F5c·F5d)의 순수 로직 — react-native 를 import 하지 않는다(`reportFormLogic.ts`
 * 와 같은 이유, vitest 가 RN 목 없이 검증한다).
 *
 * 신고하기(결정 (h))는 **접수만** 한다 — 성공·실패 어느 쪽이든 토스트 문구를 고르는 것
 * 말고는 아무것도 하지 않는다. 이 함수가 반환하는 것은 문자열 하나뿐이라는 사실 자체가
 * "카드는 그대로 남는다"는 계약을 코드로 굳힌다 — 목록·상세를 다시 그리게 할 상태 변경도,
 * 제보를 지우거나 숨길 자리도 이 파일에는 없다.
 */
import {
  lookupSegment,
  reportCoordinateCopyText,
  segmentPositionLabel,
  toSegmentId,
  type Valley,
} from '@modu-valley/core';
import { REPORT_FEED_COPY } from '../../../theme/copy';

export function reportFlagResultMessage(ok: boolean): string {
  return ok ? REPORT_FEED_COPY.flagSuccess : REPORT_FEED_COPY.flagFailed;
}

/**
 * 상세 면 복사 버튼의 문자열(F5d 해석 5) — "계곡명 구간\n위도, 경도"(core
 * `reportCoordinateCopyText`). 계곡을 찾지 못하면(드문 경우) `null` — 호출부는 복사 버튼을
 * 감춘다.
 */
export function reportDetailCopyText(
  valleys: readonly Valley[],
  valleyId: string,
  segmentId: string | null,
  lat: number,
  lng: number,
): string | null {
  const valley = valleys.find((v) => v.id === valleyId);
  if (valley === undefined) return null;
  const segmentLabel = segmentLabelOf(valleys, segmentId);
  return reportCoordinateCopyText(valley.name, segmentLabel, lat, lng);
}

function segmentLabelOf(valleys: readonly Valley[], segmentId: string | null): string | undefined {
  if (segmentId === null) return undefined;
  const found = lookupSegment(valleys, toSegmentId(segmentId));
  return found.ok ? segmentPositionLabel(found.value.segment.position) : undefined;
}

export function reportCopyResultMessage(ok: boolean): string {
  return ok ? REPORT_FEED_COPY.copyCoordinateSuccess : REPORT_FEED_COPY.copyCoordinateFailed;
}
