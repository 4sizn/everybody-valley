/**
 * 구간 카드 문구 — 제목 "중류 · 허리", 부제 "자갈 · 주차장 320m · 그늘 62%".
 *
 * 카드 문구의 재료(위치·수심·바닥·가장 가까운 주차장 거리·정오 그늘)는 전부 도메인에
 * 있으므로 조립도 여기서 한다. 표현 계층이 라벨 함수를 골라 이어 붙이면
 * web 과 네이티브가 다른 문장을 만들 수 있다.
 *
 * V1 (d) — 카드 제목이 계곡명이던 F1 구성은 단일 계곡에서 "샘플계곡" 을 세 번 반복했다.
 * 계곡명은 섹션 헤더에만 두고, 제목은 **위치 · 수심**(`segmentTitle`), 부제는 그 뒤부터
 * (`afterTitle`) + 정오 그늘(`shade`)로 갈랐다. 상세 시트는 F1 문장을 그대로 쓴다
 * (옵션 없는 `segmentSubtitle`) — 제목이 계곡명이라 위치·수심이 부제에 있어야 한다.
 *
 * 없는 속성은 **생략**한다(시딩 초기 구간은 좌표와 순서만 있다). 위치는
 * 필수라 항상 앞에 온다. 거리 표기는 `Distance.format`(320m / 1.2km).
 */
import { Distance } from '../geo/Distance';
import {
  bedLabel,
  depthLabel,
  type Segment,
  SHADE_NOON_INDEX,
  segmentPositionLabel,
} from './Segment';

/** 데모 `.spot .tag` 와 같은 구분자. */
export const SUBTITLE_SEPARATOR = ' · ';
const PARKING_LABEL = '주차장';
const SHADE_LABEL = '그늘';

export type SegmentSubtitleOptions = {
  /**
   * `true` 면 위치·수심(`segmentTitle` 의 몫)을 빼고 바닥부터 시작한다 — 카드 제목이 이미
   * 말할 때. 기본 `false` 는 F1 문장("중류 · 허리 · 자갈 · 주차장 320m").
   */
  readonly afterTitle?: boolean;
  /** `true` 면 정오 그늘 비율을 "그늘 62%" 로 붙인다. 그늘 데이터가 없으면 생략. */
  readonly shade?: boolean;
};

/**
 * 카드 제목 — "중류 · 허리". 수심을 모르면 위치만("중류"). 계곡명은 넣지 않는다(섹션 헤더의 몫).
 * 1구간 계곡(`whole`, SD1 (c))도 같은 규칙 — "전체 · 무릎", 수심이 없으면 "전체".
 */
export function segmentTitle(segment: Segment): string {
  const parts: string[] = [segmentPositionLabel(segment.position)];
  if (segment.depth !== undefined) parts.push(depthLabel(segment.depth));
  return parts.join(SUBTITLE_SEPARATOR);
}

/**
 * 정오 그늘 비율 0~1. `shadeByHour` 의 정오 칸이 우선, 없으면 호환 필드 `shadeRatio`.
 * 둘 다 없으면 `undefined` — P1 산출물이 없는 계곡.
 */
export function noonShadeRatio(segment: Segment): number | undefined {
  return segment.shadeByHour?.[SHADE_NOON_INDEX] ?? segment.shadeRatio;
}

/** "62%" — 카드 부제와 목록 요약이 같은 반올림을 쓴다. */
export function formatShadePercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * @param nearestParkingM 구간 시작점에서 가장 가까운 주차장까지 미터. 없거나
 *                        유효하지 않으면(음수·NaN) 주차장 항목을 뺀다.
 */
export function segmentSubtitle(
  segment: Segment,
  nearestParkingM?: number,
  options: SegmentSubtitleOptions = {},
): string {
  const parts: string[] = [];
  if (options.afterTitle !== true) {
    parts.push(segmentPositionLabel(segment.position));
    if (segment.depth !== undefined) parts.push(depthLabel(segment.depth));
  }
  if (segment.bed !== undefined) parts.push(bedLabel(segment.bed));
  if (nearestParkingM !== undefined) {
    const distance = Distance.ofMeters(nearestParkingM);
    if (distance.ok) parts.push(`${PARKING_LABEL} ${distance.value.format()}`);
  }
  if (options.shade === true) {
    const ratio = noonShadeRatio(segment);
    if (ratio !== undefined) parts.push(`${SHADE_LABEL} ${formatShadePercent(ratio)}`);
  }
  return parts.join(SUBTITLE_SEPARATOR);
}
