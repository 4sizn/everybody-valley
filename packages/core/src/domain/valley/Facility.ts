/**
 * 계곡 부속 시설 엔티티 — Point.
 *
 * 주차장·화장실·매점처럼 구간이 아니라 한 지점에 있는 것. "주차장 320m",
 * "대안 주차장 거리순"(MVP-2)의 재료다. 마커 색 9종과 1:1 대응한다.
 *
 * 필드 출처: `data/.schema/valleys.schema.json` `facilityProps`.
 */
import { type Distance, equirectangularDistance } from '../geo/Distance';
import type { LngLat } from '../geo/LngLat';
import type { FacilityId, ValleyId } from './ids';
import type { MapTier } from './MapTier';

/**
 * 시설 종류 10종.
 *
 * valley-ds 반입 시 정규화 결정 (C3): 스키마 `facilityType` 과 마커 코드
 * `lazy-marker-icons.ts` 는 `store`, 팔레트 `map-palette.json` 만 `convenience`
 * 였다. **`store` 로 통일**한다 — 세 출처 중 둘이 이미 `store` 이고, 매점·슈퍼·
 * 편의점을 모두 담는 넓은 이름이라 `convenience`(편의점) 보다 계곡 현장에 맞다.
 * 팔레트 키 교체는 C2(지도 팔레트 반입)에서 함께 한다.
 */
export const FACILITY_TYPES = [
  'parking',
  'restroom',
  'food',
  'cafe',
  'store',
  'shelter',
  'station',
  'access',
  'safety',
  'etc',
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

const FACILITY_TYPE_LABELS: Readonly<Record<FacilityType, string>> = {
  parking: '주차장',
  restroom: '화장실',
  food: '식당',
  cafe: '카페',
  store: '매점',
  shelter: '정자·쉼터',
  station: '역·정류장',
  access: '진입로',
  safety: '안전시설',
  etc: '기타',
};

export function facilityTypeLabel(type: FacilityType): string {
  return FACILITY_TYPE_LABELS[type];
}

export type FacilityProps = {
  readonly id: FacilityId;
  readonly valleyId: ValleyId;
  readonly name: string;
  readonly facilityType: FacilityType;
  readonly position: LngLat;
  /** 주차 면수 등. */
  readonly capacity?: number;
  readonly feeNote?: string;
  /** 예: '09:00~18:00' */
  readonly operatingHours?: string;
  /** 국가지점번호. 119 좌표 카드용. */
  readonly nationalPointNumber?: string;
  readonly mapIconTier?: MapTier;
  readonly mapImportance?: number;
};

export class Facility {
  readonly id: FacilityId;
  readonly valleyId: ValleyId;
  readonly name: string;
  readonly facilityType: FacilityType;
  readonly position: LngLat;
  readonly capacity: number | undefined;
  readonly feeNote: string | undefined;
  readonly operatingHours: string | undefined;
  readonly nationalPointNumber: string | undefined;
  readonly mapIconTier: MapTier | undefined;
  readonly mapImportance: number | undefined;

  constructor(props: FacilityProps) {
    this.id = props.id;
    this.valleyId = props.valleyId;
    this.name = props.name;
    this.facilityType = props.facilityType;
    this.position = props.position;
    this.capacity = props.capacity;
    this.feeNote = props.feeNote;
    this.operatingHours = props.operatingHours;
    this.nationalPointNumber = props.nationalPointNumber;
    this.mapIconTier = props.mapIconTier;
    this.mapImportance = props.mapImportance;
  }

  /** 기준점(보통 구간 끝점)까지 거리. "주차장 320m" 라벨은 `Distance.format`. */
  distanceFrom(origin: LngLat): Distance {
    return equirectangularDistance(origin, this.position);
  }
}
