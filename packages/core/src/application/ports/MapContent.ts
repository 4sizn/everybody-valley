/**
 * 지도가 그릴 **내용 스냅샷**과 그 위의 선택·히트 참조.
 *
 * 포트가 `Spot` 전용(`renderSpots`)이던 시절에는 피처 종류가 하나 늘 때마다
 * 메서드·이벤트·어댑터 경로가 함께 늘었다. 여기서는 "무엇을 그릴지"를 값
 * 하나로 모아 종류가 늘어도 **필드만 늘고 메서드는 늘지 않게** 한다.
 *
 *   · festival — 명당(Point) + 발사 지점(거리 라벨의 기준)
 *   · valley   — 구간(LineString) + 시설(Point) + 구간별 혼잡 상태
 *              + 그늘(Polygon) — **지금 그릴 시각의 것만**(F4)
 *
 * 어댑터는 소스별로 이전 스냅샷과 **참조 비교**해 바뀐 것만 다시 쓴다. 그래서
 * 이 값의 배열·맵은 불변으로 다루고, 바꿀 때는 새 참조를 만든다.
 *
 * 도메인 타입만 참조한다 — GeoJSON·레이어 id 같은 표현 어휘는 `map-style` 과
 * 어댑터의 것이다.
 */

import type { Spot } from '../../domain/festival/Spot';
import type { SpotId } from '../../domain/festival/SpotId';
import { toSpotId } from '../../domain/festival/SpotId';
import type { LngLat } from '../../domain/geo/LngLat';
import type { CrowdStatus } from '../../domain/valley/CrowdSnapshot';
import type { Facility } from '../../domain/valley/Facility';
import type { FilterChipKey } from '../../domain/valley/filterChips';
import {
  type FacilityId,
  type SegmentId,
  toFacilityId,
  toSegmentId,
  type ValleyId,
} from '../../domain/valley/ids';
import type { Segment } from '../../domain/valley/Segment';
import type { ShadePolygons } from '../../domain/valley/Shade';
import type { LandParcel } from './LandOwnership';

/**
 * 지도에 얹는 그늘 — 수관과 그 시각의 개방지 그림자. 시각 축은 애플리케이션 상태가
 * 정하고, 여기에는 이미 고른 시각의 폴리곤만 싣는다. 어댑터는 이 값의 **참조**만
 * 비교하므로 시각이 바뀌면 새 객체를 만든다.
 */
export type ShadeOverlay = {
  readonly canopy: ShadePolygons;
  readonly shadow: ShadePolygons;
};

export type MapContent = {
  readonly landParcels?: readonly LandParcel[];
  // ── festival ──
  readonly spots: readonly Spot[];
  /** 거리 라벨의 기준점. 명당이 없으면 `null`. */
  readonly launchSite: LngLat | null;

  // ── valley ──
  readonly segments: readonly Segment[];
  readonly facilities: readonly Facility[];
  /** 구간별 혼잡 상태. 없는 구간은 "미확인"으로 그린다. */
  readonly crowd: ReadonlyMap<SegmentId, CrowdStatus>;
  /** 그늘 보기가 켜져 있을 때만 값이 있다. 꺼져 있거나 데이터가 없으면 `null`. */
  readonly shade: ShadeOverlay | null;
};

/**
 * N1 지도 필터 입력 — 선택된 칩 + 필터를 이기는 계곡(해석 4). `MapContentComposer.content` 가
 * 이 값으로 `segments`·`facilities`·`shade` 를 계곡 단위로 함께 거른다(해석 2·3). `selected` 가
 * 비어 있으면 필터를 적용하지 않는다(전부 보인다) — 그때는 `pinnedValleyId` 도 의미가 없다.
 */
export type MapContentFilter = {
  readonly selected: ReadonlySet<FilterChipKey>;
  readonly pinnedValleyId?: ValleyId;
};

/** 아무것도 없는 지도. 부분만 채울 때 spread 의 바탕으로 쓴다. */
export const EMPTY_MAP_CONTENT: MapContent = {
  spots: [],
  launchSite: null,
  segments: [],
  facilities: [],
  crowd: new Map(),
  shade: null,
};

/** 지도에 그려지는 피처 종류. 레이어 셋·히트 이벤트가 같은 이름을 쓴다. */
export const MAP_FEATURE_KINDS = ['spot', 'segment', 'facility'] as const;
export type MapFeatureKind = (typeof MAP_FEATURE_KINDS)[number];

/**
 * 지도 위의 선택 하나. 종류에 따라 엔티티를 그대로 싣는다 — 어댑터가 핀 위치·
 * 색을 다시 조회하지 않아도 되게 하기 위해서다.
 */
export type MapSelection =
  | { readonly kind: 'spot'; readonly spot: Spot }
  | { readonly kind: 'segment'; readonly segment: Segment }
  | { readonly kind: 'facility'; readonly facility: Facility };

/** 지도에서 눌린 피처. 어댑터가 GeoJSON 속성에서 읽어 올린다. */
export type MapFeatureRef =
  | { readonly kind: 'spot'; readonly id: SpotId }
  | { readonly kind: 'segment'; readonly id: SegmentId }
  | { readonly kind: 'facility'; readonly id: FacilityId };

/**
 * 어댑터가 (종류, 원시 id) 로 참조를 만드는 유일한 통로. 브랜드 id 로 바꾸는
 * 지점이 어댑터마다 흩어지지 않게 한다.
 */
export function toMapFeatureRef(kind: MapFeatureKind, rawId: string): MapFeatureRef {
  switch (kind) {
    case 'spot':
      return { kind, id: toSpotId(rawId) };
    case 'segment':
      return { kind, id: toSegmentId(rawId) };
    case 'facility':
      return { kind, id: toFacilityId(rawId) };
  }
}

/** 선택이 이 종류라면 그 id, 아니면 `null`. 어댑터의 `selected` 주입에 쓴다. */
export function selectedIdOf(selection: MapSelection | null, kind: MapFeatureKind): string | null {
  if (selection === null || selection.kind !== kind) return null;
  switch (selection.kind) {
    case 'spot':
      return selection.spot.id;
    case 'segment':
      return selection.segment.id;
    case 'facility':
      return selection.facility.id;
  }
}
