/**
 * 계곡 구간 엔티티 — 점이 아니라 선.
 *
 * 상류/중류/하류는 수심·혼잡·그늘이 전부 달라 하나의 Point 로 묶으면 정보가
 * 뭉개진다. 그래서 계곡의 단위는 구간(LineString)이다. 좌표는 데이터 파일이
 * 소유하고(`data/*.geojson`), 이 클래스는 그것을 검증된 `LngLat` 열로 들고 있다.
 *
 * 카드 부제 "중류 · 무릎 · 그늘 많음 · 주차장 320m" 의 재료가 전부 여기 있다.
 * 식별·순서 외의 속성은 모두 선택이다 — 시딩 초기에는 좌표와 순서만 있는
 * 구간이 대부분이기 때문이다.
 *
 * 필드 출처: `data/.schema/valleys.schema.json` `segmentProps`.
 */
import { Distance, equirectangularDistance } from '../geo/Distance';
import { LngLat } from '../geo/LngLat';
import type { BasinCode, SegmentId, StationCode, ValleyId } from './ids';
import type { MapTier } from './MapTier';

/**
 * 계곡 안에서의 위치. DEM 물길 방향에서 자동 판정할 수 있다.
 *
 * `whole` 은 **1구간 계곡** — SD1 결정 (c): 지명·물놀이관리지역·시설 같은 실데이터에
 * 상·중·하 구분이 있을 때만 나누고, 근거가 없으면 계곡 전체를 한 구간으로 둔다(억지 3등분 금지).
 */
export const SEGMENT_POSITIONS = ['upper', 'mid', 'lower', 'whole'] as const;
export type SegmentPosition = (typeof SEGMENT_POSITIONS)[number];

/**
 * 구간을 나눈 근거 (SD1 (c)). `none` 은 나누지 않은 1구간.
 *   toponym  상류·중류·하류·○○골 같은 지명이 실데이터(지도·안내)에 있다
 *   safemap  행안부 물놀이관리지역 구역 경계
 *   facility 주차장·진입점 등 시설 위치
 */
export const SPLIT_BASES = ['toponym', 'safemap', 'facility', 'none'] as const;
export type SplitBasis = (typeof SPLIT_BASES)[number];

/** 수심대. 무릎 / 허리 / 성인 / 혼재 */
export const DEPTHS = ['knee', 'waist', 'adult', 'mixed'] as const;
export type Depth = (typeof DEPTHS)[number];

/** 바닥재. 돗자리 가능 여부와 직결된다. */
export const BEDS = ['gravel', 'rock', 'sand', 'mixed'] as const;
export type Bed = (typeof BEDS)[number];

/** 접근 난이도. easy = 유모차 가능, hard = 계단·급경사 */
export const ACCESS_DIFFICULTIES = ['easy', 'moderate', 'hard'] as const;
export type AccessDifficulty = (typeof ACCESS_DIFFICULTIES)[number];

const SEGMENT_POSITION_LABELS: Readonly<Record<SegmentPosition, string>> = {
  upper: '상류',
  mid: '중류',
  lower: '하류',
  whole: '전체',
};

const DEPTH_LABELS: Readonly<Record<Depth, string>> = {
  knee: '무릎',
  waist: '허리',
  adult: '성인',
  mixed: '혼재',
};

const BED_LABELS: Readonly<Record<Bed, string>> = {
  gravel: '자갈',
  rock: '암반',
  sand: '모래',
  mixed: '혼재',
};

const ACCESS_DIFFICULTY_LABELS: Readonly<Record<AccessDifficulty, string>> = {
  easy: '쉬움',
  moderate: '보통',
  hard: '어려움',
};

export function segmentPositionLabel(position: SegmentPosition): string {
  return SEGMENT_POSITION_LABELS[position];
}

export function depthLabel(depth: Depth): string {
  return DEPTH_LABELS[depth];
}

export function bedLabel(bed: Bed): string {
  return BED_LABELS[bed];
}

export function accessDifficultyLabel(difficulty: AccessDifficulty): string {
  return ACCESS_DIFFICULTY_LABELS[difficulty];
}

/**
 * `shadeByHour` 의 시각 축 — 대표일 8/1, KST 10~18 정시 9개.
 * 인덱스가 `data/shade/<valleyId>/shadow-<HH>.geojson` 파일과 같은 순서라 F4 시간 슬라이더의 스톱이 된다.
 * 출처: `scripts/shade/settings.py` `HOURS`.
 */
export const SHADE_HOURS = [
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
] as const;
/** `shadeByHour` 배열 길이. 이 길이가 아니면 로더가 거절한다. */
export const SHADE_HOUR_COUNT = SHADE_HOURS.length;
/** `SHADE_HOURS` 의 자리. 시간 트랙의 눈금이자 `shadeByHour`·`shadowByHour` 의 인덱스. */
export type ShadeHourIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/** `shadeRatio`(정오 값) 가 가리키는 인덱스. `SHADE_HOURS` 에서 유도하고 테스트가 2 로 고정한다. */
export const SHADE_NOON_INDEX = SHADE_HOURS.indexOf('12:00') as ShadeHourIndex;

export type SegmentProps = {
  readonly id: SegmentId;
  readonly valleyId: ValleyId;
  /** 계곡 이름. 구간 파일이 계곡 파일 없이도 홀로 서게 하려고 구간마다 실려 온다. */
  readonly valleyName: string;
  readonly position: SegmentPosition;
  /** 상류→하류 순서. 0 부터. */
  readonly order: number;
  /** LineString 좌표열. 최소 두 점. 고도(세 번째 성분)는 표현에 쓰지 않아 버린다. */
  readonly path: readonly LngLat[];
  /** 구간 분할 근거(SD1 (c)). 1구간 계곡은 `none`. 시딩 스크립트가 남긴다. */
  readonly splitBasis?: SplitBasis;

  readonly depth?: Depth;
  readonly bed?: Bed;
  /**
   * 시각별 그늘 비율 0~1, `SHADE_HOURS` 순(KST 10~18 정시 9개, 대표일 8/1).
   *
   * 구간 라인 ±25m 버퍼 셀 중 그늘 셀의 비율. 그늘 = 수관(CHM > 2m) ∪ 나무·지형
   * 그림자 ∪ 원거리 지형 마스크. `scripts/shade` 가 산출해 쓴다(D6: 수기 금지).
   * 위성 기반 추정(수관 2016~2018 촬영)이라 현장과 다를 수 있다.
   */
  readonly shadeByHour?: readonly number[];
  /**
   * 나무 밀도 0~1 — 버퍼 안 CHM > 2m 셀 비율. 3단계 표시(dense/moderate/sparse)는
   * 표현 계층이 임계값으로 만든다.
   */
  readonly canopyCover?: number;
  /**
   * 정오 값(산출) — `shadeByHour[SHADE_NOON_INDEX]` 와 같다. 호환용으로 남긴다.
   * R3b 의 수기 태그 권고는 D6 에서 불채택되었고, R3c/P1 이 산출값으로 확정했다.
   */
  readonly shadeRatio?: number;
  /** 주차장→물가 도보 거리(m). */
  readonly accessDistanceM?: number;
  /** 접근로 평균 경사(%). DEM 산출. */
  readonly accessGradePct?: number;
  readonly accessDifficulty?: AccessDifficulty;
  /** 계곡 중심선 표고 중앙값(m). Terrarium 산출(`seed:elevation`). 단풍 기온 보정 재료. */
  readonly elevationM?: number;

  /** 행안부 물놀이관리지역 금지 구역인가. */
  readonly swimBanned?: boolean;
  /** 공식 위험 안내 원문 요약. */
  readonly riskNote?: string;
  /** 상류 강우 경보의 관측소. VWorld 표준유역 매칭으로 자동 채운다. */
  readonly upstreamStationCode?: StationCode;
  readonly basinCode?: BasinCode;

  /** 무료 개방(자릿세 없음). */
  readonly freeAccess?: boolean;
  readonly campingAllowed?: boolean;
  readonly petAllowed?: boolean;

  readonly mapIconTier?: MapTier;
  readonly mapLabelTier?: MapTier;
  /** symbol-sort-key. 작을수록 위. */
  readonly mapImportance?: number;
};

export class Segment {
  readonly id: SegmentId;
  readonly valleyId: ValleyId;
  readonly valleyName: string;
  readonly position: SegmentPosition;
  readonly order: number;
  readonly path: readonly LngLat[];
  readonly splitBasis: SplitBasis | undefined;

  readonly depth: Depth | undefined;
  readonly bed: Bed | undefined;
  readonly shadeByHour: readonly number[] | undefined;
  readonly canopyCover: number | undefined;
  readonly shadeRatio: number | undefined;
  readonly accessDistanceM: number | undefined;
  readonly accessGradePct: number | undefined;
  readonly accessDifficulty: AccessDifficulty | undefined;
  readonly elevationM: number | undefined;

  readonly swimBanned: boolean | undefined;
  readonly riskNote: string | undefined;
  readonly upstreamStationCode: StationCode | undefined;
  readonly basinCode: BasinCode | undefined;

  readonly freeAccess: boolean | undefined;
  readonly campingAllowed: boolean | undefined;
  readonly petAllowed: boolean | undefined;

  readonly mapIconTier: MapTier | undefined;
  readonly mapLabelTier: MapTier | undefined;
  readonly mapImportance: number | undefined;

  constructor(props: SegmentProps) {
    if (props.path.length < 2) {
      // 두 점 미만은 선이 아니다. 로더가 먼저 걸러 주므로 여기 도달하면 버그다.
      throw new RangeError(`구간 ${props.id} 의 좌표열은 최소 두 점이어야 합니다.`);
    }
    this.id = props.id;
    this.valleyId = props.valleyId;
    this.valleyName = props.valleyName;
    this.position = props.position;
    this.order = props.order;
    this.path = props.path;
    this.splitBasis = props.splitBasis;

    this.depth = props.depth;
    this.bed = props.bed;
    this.shadeByHour = props.shadeByHour;
    this.canopyCover = props.canopyCover;
    this.shadeRatio = props.shadeRatio;
    this.accessDistanceM = props.accessDistanceM;
    this.accessGradePct = props.accessGradePct;
    this.accessDifficulty = props.accessDifficulty;
    this.elevationM = props.elevationM;

    this.swimBanned = props.swimBanned;
    this.riskNote = props.riskNote;
    this.upstreamStationCode = props.upstreamStationCode;
    this.basinCode = props.basinCode;

    this.freeAccess = props.freeAccess;
    this.campingAllowed = props.campingAllowed;
    this.petAllowed = props.petAllowed;

    this.mapIconTier = props.mapIconTier;
    this.mapLabelTier = props.mapLabelTier;
    this.mapImportance = props.mapImportance;
  }

  /** 상류 쪽 끝점. 생성자가 두 점 이상을 보장한다. */
  get start(): LngLat {
    return this.path[0] as LngLat;
  }

  /** 하류 쪽 끝점. */
  get end(): LngLat {
    return this.path[this.path.length - 1] as LngLat;
  }

  /** 선의 길이 — 인접 점 사이 등장방형 거리의 합. 표시 라벨 규약은 `Distance.format`. */
  length(): Distance {
    let meters = 0;
    for (let index = 1; index < this.path.length; index += 1) {
      const from = this.path[index - 1] as LngLat;
      const to = this.path[index] as LngLat;
      meters += equirectangularDistance(from, to).meters;
    }
    // 내부 합산 결과라 유효함이 보장된다 — `Distance.unsafeOfMeters` 규약.
    return Distance.unsafeOfMeters(meters);
  }

  /**
   * 선 길이의 절반 지점 — 구간 상세를 열 때 카메라가 향하는 곳.
   *
   * 좌표열의 가운데 **점**이 아니라 길이 기준 중간이다. 점이 한쪽에 몰린
   * 구간(굽이가 많은 쪽에 점이 많다)에서 가운데 점은 선의 중간이 아니다.
   * 두 점 사이 보간은 경위도 선형 — 구간 수백 m 범위에서 오차는 미터 미만이다.
   */
  midpoint(): LngLat {
    const half = this.length().meters / 2;
    let walked = 0;
    for (let index = 1; index < this.path.length; index += 1) {
      const from = this.path[index - 1] as LngLat;
      const to = this.path[index] as LngLat;
      const leg = equirectangularDistance(from, to).meters;
      if (walked + leg >= half) {
        const ratio = leg === 0 ? 0 : (half - walked) / leg;
        return LngLat.of(
          from.lng + (to.lng - from.lng) * ratio,
          from.lat + (to.lat - from.lat) * ratio,
        );
      }
      walked += leg;
    }
    return this.end;
  }
}
