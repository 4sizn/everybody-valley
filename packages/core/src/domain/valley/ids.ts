/**
 * 계곡 도메인 식별자 — 브랜드 타입.
 *
 * `festival/SpotId` 와 같은 규약이다. 계곡·구간·시설·관측소·유역 코드가 모두
 * 문자열이라, 브랜드가 없으면 `findSegment(valleyId)` 같은 뒤바뀜이 컴파일을
 * 통과한다. `to*` 함수는 외부 입력(GeoJSON, API 응답)을 도메인으로 들이는
 * 유일한 통로다.
 */
declare const VALLEY_ID_BRAND: unique symbol;
declare const SEGMENT_ID_BRAND: unique symbol;
declare const FACILITY_ID_BRAND: unique symbol;
declare const STATION_CODE_BRAND: unique symbol;
declare const BASIN_CODE_BRAND: unique symbol;

/** 계곡. 예: `baegun` */
export type ValleyId = string & { readonly [VALLEY_ID_BRAND]: 'ValleyId' };
/** 구간. 예: `baegun-mid` */
export type SegmentId = string & { readonly [SEGMENT_ID_BRAND]: 'SegmentId' };
/** 시설(주차장·화장실 …). */
export type FacilityId = string & { readonly [FACILITY_ID_BRAND]: 'FacilityId' };
/** 한강홍수통제소 상류 관측소 코드. */
export type StationCode = string & { readonly [STATION_CODE_BRAND]: 'StationCode' };
/** 표준유역 코드. */
export type BasinCode = string & { readonly [BASIN_CODE_BRAND]: 'BasinCode' };

export function toValleyId(raw: string): ValleyId {
  return raw as ValleyId;
}

export function toSegmentId(raw: string): SegmentId {
  return raw as SegmentId;
}

export function toFacilityId(raw: string): FacilityId {
  return raw as FacilityId;
}

export function toStationCode(raw: string): StationCode {
  return raw as StationCode;
}

export function toBasinCode(raw: string): BasinCode {
  return raw as BasinCode;
}
