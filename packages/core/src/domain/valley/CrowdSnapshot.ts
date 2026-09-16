/**
 * 혼잡도 스냅샷 — 어느 시점에 누가 봤더니 어땠나.
 *
 * festival 의 `CrowdLevel` 은 4단계(relaxed/moderate/busy/severe)이고 명당에
 * 박힌 정적 속성이다. 계곡은 3단계이고 시간이 흐르면 갈아엎어지는 관측값이라
 * 별도 타입으로 둔다. 이름이 `CrowdStatus` 인 이유는 코어 공개 표면에서
 * festival 의 `CrowdLevel`·`crowdLabel` 과 충돌하지 않기 위해서다.
 *
 * valley-ds 반입 시 정규화 결정 (C3): 팔레트 `status3` 만 세 번째 키가 `empty`
 * 였고 스키마 `crowdSnapshot.level` 과 마커 코드 `CROWD_COLOR` 는 `busy` 였다.
 * **`busy` 로 통일**한다 — `empty` 는 "자리가 없다"는 뜻이지만 `available`(여유)의
 * 반대말로 읽혀 혼동을 낳고, 두 출처가 이미 `busy` 다. 팔레트 키 교체는 C2 에서.
 *
 * 필드 출처: `data/.schema/valleys.schema.json` `crowdSnapshot`.
 */
import type { SegmentId, ValleyId } from './ids';

/** 여유 / 보통 / 혼잡. 마커 3단계 색과 대응. */
export const CROWD_STATUSES = ['available', 'low', 'busy'] as const;
export type CrowdStatus = (typeof CROWD_STATUSES)[number];

const CROWD_STATUS_LABELS: Readonly<Record<CrowdStatus, string>> = {
  available: '여유',
  low: '보통',
  busy: '혼잡',
};

export function crowdStatusLabel(status: CrowdStatus): string {
  return CROWD_STATUS_LABELS[status];
}

/** 관측 출처. 제보 / 체크인 / 주차장 API / 추정 */
export const CROWD_SOURCES = ['report', 'checkin', 'parking-api', 'estimate'] as const;
export type CrowdSource = (typeof CROWD_SOURCES)[number];

/** ISO 8601 날짜·시각 문자열. `Date` 는 가변이라 스냅샷에 싣지 않는다. */
export type IsoDateTime = string;

export type CrowdSnapshotProps = {
  readonly valleyId: ValleyId;
  /** 없으면 계곡 전체에 대한 관측이다. */
  readonly segmentId?: SegmentId;
  readonly level: CrowdStatus;
  readonly observedAt: IsoDateTime;
  readonly source: CrowdSource;
  /** 이 스냅샷을 만든 제보·체크인 수. */
  readonly sampleCount?: number;
};

export class CrowdSnapshot {
  readonly valleyId: ValleyId;
  readonly segmentId: SegmentId | undefined;
  readonly level: CrowdStatus;
  readonly observedAt: IsoDateTime;
  readonly source: CrowdSource;
  readonly sampleCount: number | undefined;

  constructor(props: CrowdSnapshotProps) {
    this.valleyId = props.valleyId;
    this.segmentId = props.segmentId;
    this.level = props.level;
    this.observedAt = props.observedAt;
    this.source = props.source;
    this.sampleCount = props.sampleCount;
  }

  /** 구간 하나를 가리키는가, 계곡 전체인가. */
  get isSegmentScoped(): boolean {
    return this.segmentId !== undefined;
  }
}
