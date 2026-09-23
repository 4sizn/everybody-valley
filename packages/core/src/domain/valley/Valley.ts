/**
 * 계곡 애그리게이트 — 구간(선) 여럿과 시설(점) 여럿의 루트.
 *
 * `Festival` 과 같은 자리다. 표현 계층이 구간 배열을 직접 뒤지지 않도록 조회를
 * 여기로 모은다. 구간은 항상 상류→하류(`order` 오름차순)로 정렬되어 있다 —
 * 데이터 파일의 피처 순서에 기대지 않는다.
 *
 * 혼잡 스냅샷·경보는 애그리게이트에 싣지 않는다. 계곡 데이터는 시딩 시점에
 * 굳는 정적 카탈로그이고, 스냅샷·경보는 분 단위로 바뀌는 런타임 상태라
 * 생애가 다르다. 그 결합은 애플리케이션 상태(`AppState`)가 맡는다.
 */
import { ValleyError } from '../../shared/errors';
import { err, ok, type Result } from '../../shared/result';
import { type Distance, distanceToPolyline } from '../geo/Distance';
import { LngLat } from '../geo/LngLat';
import type { Facility, FacilityType } from './Facility';
import type { BasinCode, FacilityId, SegmentId, ValleyId } from './ids';
import type { Segment, SegmentPosition } from './Segment';
import type { AlertConfidence } from './UpstreamAlert';
import type { Verification } from './ValleyDataset';

/**
 * 계곡의 표준유역(정적 속성, R2). `sbsncd` 는 구간의 `basinCode` 에서 온다(상류 구간
 * 대표). `catchmentKm2`·`leadTimeMin` 은 DEM 집수역 추적(v2)이 나오기 전까지 비어 있다.
 */
export type ValleyBasin = {
  readonly sbsncd: BasinCode;
  readonly catchmentKm2?: number;
  readonly leadTimeMin?: number;
};

export type ValleyProps = {
  readonly id: ValleyId;
  readonly name: string;
  readonly segments: readonly Segment[];
  readonly facilities?: readonly Facility[];
  /** 지도·시설 목록에는 내지 않는 먹거리(식당·카페). "즐길 거리" 탭만 읽는다. */
  readonly eateries?: readonly Facility[];
  /** 이 계곡 파일의 검수 수준(SD1 (g)). 계곡별 파일 `metadata.verified` 에서 온다. */
  readonly verified?: Verification;
  /** 표준유역. 생략하면 구간의 `basinCode` 로 유도한다(가장 상류 구간). */
  readonly basin?: ValleyBasin;
  /** 이 계곡이 낼 수 있는 최고 경보 확신(F3 §5). 관측소 로스터가 없으면 `undefined`. */
  readonly alertCapability?: AlertConfidence;
};

export class Valley {
  #around: FacilitiesAround | undefined;

  readonly id: ValleyId;
  readonly name: string;
  /** 상류→하류 순. */
  readonly segments: readonly Segment[];
  readonly facilities: readonly Facility[];
  /** 식당·카페. 핀·검색·집계에서 빠지고 `eateriesAround()` 로만 본다. */
  readonly eateries: readonly Facility[];
  /** 검수 수준. 모르면(샘플·옛 파일) `undefined` — 배지를 붙이지 않는다. */
  readonly verified: Verification | undefined;
  /** 표준유역. 구간에 `basinCode` 가 하나도 없으면 `undefined`. */
  readonly basin: ValleyBasin | undefined;
  /** 이 계곡이 낼 수 있는 최고 경보 확신. 모르면 `undefined`(배지에 쓰지 않는다). */
  readonly alertCapability: AlertConfidence | undefined;

  readonly #segmentsById: ReadonlyMap<SegmentId, Segment>;
  readonly #facilitiesById: ReadonlyMap<FacilityId, Facility>;

  private constructor(props: ValleyProps) {
    this.id = props.id;
    this.name = props.name;
    this.segments = [...props.segments].sort((a, b) => a.order - b.order);
    this.facilities = props.facilities ?? [];
    this.eateries = props.eateries ?? [];
    this.verified = props.verified;
    this.basin = props.basin ?? deriveBasin(this.segments);
    this.alertCapability = props.alertCapability;
    this.#segmentsById = new Map(this.segments.map((segment) => [segment.id, segment]));
    this.#facilitiesById = new Map(this.facilities.map((facility) => [facility.id, facility]));
  }

  /**
   * 검증된 생성. 구간이 하나 이상이고, 모든 구간·시설이 이 계곡의 것이어야 한다.
   * 로더가 `valleyId` 로 묶어 넘기므로 여기서 다시 확인하는 것은 방어선이다.
   */
  static create(props: ValleyProps): Result<Valley, ValleyError> {
    if (props.segments.length === 0) {
      return err(
        new ValleyError('valley/empty-valley', '계곡에는 구간이 하나 이상 있어야 합니다.', {
          context: { valleyId: props.id },
        }),
      );
    }
    const stray =
      props.segments.find((segment) => segment.valleyId !== props.id) ??
      props.facilities?.find((facility) => facility.valleyId !== props.id) ??
      props.eateries?.find((facility) => facility.valleyId !== props.id);
    if (stray !== undefined) {
      return err(
        new ValleyError(
          'valley/inconsistent-segments',
          '다른 계곡에 속한 구간 또는 시설이 섞여 있습니다.',
          { context: { valleyId: props.id, strayId: stray.id, strayValleyId: stray.valleyId } },
        ),
      );
    }
    return ok(new Valley(props));
  }

  findSegment(id: SegmentId): Result<Segment, ValleyError> {
    const segment = this.#segmentsById.get(id);
    if (segment === undefined) {
      return err(
        new ValleyError('valley/segment-not-found', '해당 구간을 찾을 수 없습니다.', {
          context: { valleyId: this.id, segmentId: id },
        }),
      );
    }
    return ok(segment);
  }

  /** 같은 위치(상류/중류/하류)의 구간들. 긴 계곡은 중류가 둘일 수 있다. */
  segmentsAt(position: SegmentPosition): readonly Segment[] {
    return this.segments.filter((segment) => segment.position === position);
  }

  findFacility(id: FacilityId): Result<Facility, ValleyError> {
    const facility = this.#facilitiesById.get(id);
    if (facility === undefined) {
      return err(
        new ValleyError('valley/facility-not-found', '해당 시설을 찾을 수 없습니다.', {
          context: { valleyId: this.id, facilityId: id },
        }),
      );
    }
    return ok(facility);
  }

  /** 종류별 시설. "대안 주차장 거리순" 의 입력. */
  facilitiesOf(type: FacilityType): readonly Facility[] {
    return this.facilities.filter((facility) => facility.facilityType === type);
  }

  /**
   * 기준점에서 가장 가까운 시설. 카드 부제의 "주차장 320m" 재료.
   * `type` 을 생략하면 종류를 가리지 않는다. 그 종류가 하나도 없으면 `undefined`.
   */
  nearestFacility(from: LngLat, type?: FacilityType): NearestFacility | undefined {
    const candidates = type === undefined ? this.facilities : this.facilitiesOf(type);
    let nearest: NearestFacility | undefined;
    for (const facility of candidates) {
      const distance = facility.distanceFrom(from);
      if (nearest === undefined || distance.meters < nearest.distance.meters) {
        nearest = { facility, distance };
      }
    }
    return nearest;
  }

  /** 기준점에서 가까운 순으로 정렬한 시설 전부. 상세 면의 시설 목록. */
  facilitiesByDistance(from: LngLat): readonly FacilityAtDistance[] {
    return this.facilities
      .map((facility) => ({ facility, distance: facility.distanceFrom(from) }))
      .sort((a, b) => a.distance.meters - b.distance.meters);
  }

  /**
   * 시설을 "계곡 주변"과 "가는 길에"로 나눈다 — 거리는 계곡 점이 아니라 **중심선까지**(물가에서
   * 얼마나 떨어졐나). 주변 = 300 m 안, 주차장·진입로·역은 800 m(차 대고 걸어오는 거리).
   * 시딩은 계곡 점 반경 1.5 km 원으로 긁어 와서(`scripts/seed/facilities.mts`) 물가에서 1 km
   * 넘는 식당까지 섞여 있다 — 표시 계층이 이 규칙으로 갈라 보여준다. 두 묶음 모두 가까운 순.
   */
  facilitiesAround(): FacilitiesAround {
    if (this.#around) return this.#around;
    this.#around = this.#computeFacilitiesAround();
    return this.#around;
  }

  /**
   * 먹거리(식당·카페)를 물가에서 가까운 순으로. "즐길 거리" 탭의 재료 — 시딩이 3 km 원으로
   * 긁어 와 도심 계곡은 수백 곳이라 표현 계층이 앞의 몇 곳만 보여준다.
   */
  eateriesAround(): readonly FacilityAtDistance[] {
    const line = this.segments.flatMap((segment) => segment.path);
    return collapseSameSpot(
      this.eateries
        .map((facility) => ({ facility, distance: distanceToPolyline(facility.position, line) }))
        .sort((a, b) => a.distance.meters - b.distance.meters),
    );
  }

  #computeFacilitiesAround(): FacilitiesAround {
    const line = this.segments.flatMap((segment) => segment.path);
    const nearby: FacilityAtDistance[] = [];
    const onTheWay: FacilityAtDistance[] = [];
    for (const facility of this.facilities) {
      const distance = distanceToPolyline(facility.position, line);
      const limit = FACILITY_ACCESS_TYPES.has(facility.facilityType)
        ? FACILITY_ACCESS_NEARBY_M
        : FACILITY_NEARBY_M;
      (distance.meters <= limit ? nearby : onTheWay).push({ facility, distance });
    }
    const byDistance = (a: FacilityAtDistance, b: FacilityAtDistance) =>
      a.distance.meters - b.distance.meters;
    return {
      nearby: collapseSameSpot(nearby.sort(byDistance)),
      onTheWay: collapseSameSpot(onTheWay.sort(byDistance)),
    };
  }

  /**
   * 계곡 전체가 보이는 중심 — 모든 구간 좌표의 경계 상자 가운데.
   *
   * 평균(무게중심)이 아닌 이유: 굽이가 많은 쪽에 점이 몰리면 평균이 그쪽으로
   * 끌려가 반대편 끝이 화면 밖으로 밀린다. 상자 가운데는 양끝을 공평하게 잡는다.
   * 생성자가 구간 하나 이상·구간마다 두 점 이상을 보장하므로 항상 값이 있다.
   */
  center(): LngLat {
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    for (const segment of this.segments) {
      for (const point of segment.path) {
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
      }
    }
    return LngLat.of((minLng + maxLng) / 2, (minLat + maxLat) / 2);
  }
}

/**
 * 가장 상류(정렬된 첫) 구간의 `basinCode` 를 표준유역으로 삼는다. 지금은 계곡마다
 * 구간이 하나뿐이라(SD1) 이견이 없다 — 여러 구간이 다른 유역을 물고 있으면(장래) 그래도
 * 상류가 대표다. `basinCode` 가 있는 구간이 하나도 없으면 `undefined`.
 */
function deriveBasin(sortedSegments: readonly Segment[]): ValleyBasin | undefined {
  const sbsncd = sortedSegments.find((segment) => segment.basinCode !== undefined)?.basinCode;
  return sbsncd === undefined ? undefined : { sbsncd };
}

/** 기준점과의 거리를 곁들인 시설. */
/** 중심선에서 이 거리 안이면 "계곡 주변". */
export const FACILITY_NEARBY_M = 300;
/** 주차장·진입로·역은 걸어오는 거리라 더 넉넉하게. */
export const FACILITY_ACCESS_NEARBY_M = 800;
const FACILITY_ACCESS_TYPES: ReadonlySet<FacilityType> = new Set(['parking', 'access', 'station']);

export type FacilitiesAround = {
  readonly nearby: readonly FacilityAtDistance[];
  readonly onTheWay: readonly FacilityAtDistance[];
};

/**
 * 같은 종류가 이 거리 안에 겹치면 한 행으로 접는다 — 표준데이터는 건물 하나(탐방안내소)에
 * 화장실 행을 3개 낸다(같은 좌표, 다른 이름). 가까운 순으로 받아 첫 것을 대표로 두고 나머지는
 * `alsoHere` 에 붙인다.
 */
export const FACILITY_SAME_SPOT_M = 30;

function collapseSameSpot(sorted: readonly FacilityAtDistance[]): FacilityAtDistance[] {
  const out: FacilityAtDistance[] = [];
  for (const item of sorted) {
    const head = out.find(
      (h) =>
        h.facility.facilityType === item.facility.facilityType &&
        h.facility.distanceFrom(item.facility.position).meters <= FACILITY_SAME_SPOT_M,
    );
    if (head) (head.alsoHere as Facility[]).push(item.facility);
    else out.push({ ...item, alsoHere: [] });
  }
  return out;
}

export type FacilityAtDistance = {
  readonly facility: Facility;
  readonly distance: Distance;
  /** 같은 자리(30 m 안)의 같은 종류 시설. `facilitiesAround` 만 채운다. */
  readonly alsoHere?: readonly Facility[];
};
export type NearestFacility = FacilityAtDistance;
