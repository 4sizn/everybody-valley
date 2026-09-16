/** 변환 함수 테스트용 계곡 픽스처. `data/example-valley.geojson` 의 샘플 구간과 같은 좌표. */
import {
  type CrowdStatus,
  Facility,
  LngLat,
  Segment,
  type SegmentId,
  toFacilityId,
  toSegmentId,
  toValleyId,
} from '@modu-valley/core';

const VALLEY = toValleyId('sample');

export const UPPER = new Segment({
  id: toSegmentId('sample-upper'),
  valleyId: VALLEY,
  valleyName: '샘플계곡',
  position: 'upper',
  order: 0,
  path: [LngLat.of(127.2612, 37.8341), LngLat.of(127.2628, 37.8329), LngLat.of(127.2641, 37.8318)],
  mapImportance: 20,
});

export const MID = new Segment({
  id: toSegmentId('sample-mid'),
  valleyId: VALLEY,
  valleyName: '샘플계곡',
  position: 'mid',
  order: 1,
  path: [LngLat.of(127.2641, 37.8318), LngLat.of(127.2674, 37.8291)],
});

export const LOWER = new Segment({
  id: toSegmentId('sample-lower'),
  valleyId: VALLEY,
  valleyName: '샘플계곡',
  position: 'lower',
  order: 2,
  path: [LngLat.of(127.2674, 37.8291), LngLat.of(127.2721, 37.8264)],
});

export const SEGMENTS = [UPPER, MID, LOWER] as const;

export const CROWD: ReadonlyMap<SegmentId, CrowdStatus> = new Map([
  [UPPER.id, 'available'],
  [MID.id, 'busy'],
]);

export const PARKING = new Facility({
  id: toFacilityId('sample-parking-1'),
  valleyId: VALLEY,
  name: '하류 공영주차장',
  facilityType: 'parking',
  position: LngLat.of(127.2701, 37.8262),
});

export const STORE = new Facility({
  id: toFacilityId('sample-store-1'),
  valleyId: VALLEY,
  name: '계곡 매점',
  facilityType: 'store',
  position: LngLat.of(127.2688, 37.8284),
});

export const FACILITIES = [PARKING, STORE] as const;
