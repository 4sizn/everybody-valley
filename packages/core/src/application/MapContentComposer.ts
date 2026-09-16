/**
 * 지도 내용 조립 — 기본 내용(구간·시설)은 적재 때 한 번 만들고, 그늘·필터만 상태에 따라 갈아 끼운다.
 *
 * 어댑터는 `MapContent` 의 필드를 소스별로 **참조 비교**해 바뀐 것만 다시 쓴다
 * (`FeatureLayerSet.dependencies`). 그 약속을 지키려면 시각을 바꿀 때 구간·시설
 * 배열을 다시 만들면 안 된다 — `flatMap` 을 매번 부르면 새 참조가 생겨 구간 소스가
 * 쓸데없이 다시 쓰인다. 그래서 적재 결과를 여기 한 번 굳혀 두고, 그늘 유즈케이스들은
 * `content(visible, hour)` 로 "같은 바탕 + 다른 그늘" 을 받는다.
 *
 * 그늘 오버레이는 시각별로 캐시한다. 같은 시각으로 돌아오면 같은 참조라 어댑터가
 * 다시 쓰지 않는다 — 트랙을 왔다 갔다 해도 `setData` 는 시각이 **실제로 바뀔 때만** 일어난다.
 *
 * N1 필터(결정 (f), 해석 2·3) — `MapContentFilter` 를 넘기면 이 자리에서 계곡 단위로
 * `filterValleys` 를 돌려 바탕을 다시 만든다. 구간·시설·그늘이 **같은 계곡 집합**에서
 * 나오므로 하나만 걸리는 어긋난 상태(선은 없는데 그늘만 남는 등)가 생기지 않는다.
 * 필터 걸린 바탕도 선택(칩 조합 + 핀 고정 계곡, 해석 4)의 "지문"으로 캐시한다 — 그늘
 * 시각만 바뀌는 흔한 경우에 구간·시설 소스를 다시 쓰지 않기 위해서다.
 */
import { filterValleys } from '../domain/valley/filterChips';
import type { ValleyId } from '../domain/valley/ids';
import type { ShadeHourIndex } from '../domain/valley/Segment';
import {
  EMPTY_SHADE_POLYGONS,
  type ShadePolygons,
  shadowAt,
  type ValleyShade,
} from '../domain/valley/Shade';
import type { Valley } from '../domain/valley/Valley';
import type { ValleyDataset } from '../domain/valley/ValleyDataset';
import {
  EMPTY_MAP_CONTENT,
  type MapContent,
  type MapContentFilter,
  type ShadeOverlay,
} from './ports/MapContent';

/** 필터 없음 — 기본값. `selected` 가 비어 있으면 `#baseFor` 가 바로 원본 바탕을 돌려준다. */
const NO_FILTER: MapContentFilter = { selected: new Set() };

/** 필터 선택의 지문 — 칩 조합(순서 무관) + 핀 고정 계곡. 같으면 다시 계산하지 않는다. */
function filterFingerprint(filter: MapContentFilter): string {
  if (filter.selected.size === 0) return '';
  const chips = [...filter.selected].sort().join(',');
  return `${chips}|${filter.pinnedValleyId ?? ''}`;
}

export class MapContentComposer {
  landParcels: MapContent['landParcels'] = [];

  #valleys: readonly Valley[] = [];
  #base: MapContent = EMPTY_MAP_CONTENT;
  #shade: ReadonlyMap<ValleyId, ValleyShade> = new Map();
  readonly #overlays = new Map<ShadeHourIndex, ShadeOverlay>();

  // N1 — 필터 걸린 바탕(선택 지문으로 캐시). 선택이 비어 있으면 쓰지 않는다(#base 그대로).
  #filterFingerprint: string | null = null;
  #filteredBase: MapContent = EMPTY_MAP_CONTENT;
  #filteredShade: ReadonlyMap<ValleyId, ValleyShade> = new Map();
  readonly #filteredOverlays = new Map<ShadeHourIndex, ShadeOverlay>();

  /** 계곡 데이터셋으로 바탕을 굳힌다. 혼잡은 전부 "미확인" — 제보 피드(S1·F2)가 채운다. */
  loadValley(dataset: ValleyDataset): void {
    this.#valleys = dataset.valleys;
    this.#base = {
      ...EMPTY_MAP_CONTENT,
      segments: dataset.valleys.flatMap((valley) => valley.segments),
      facilities: dataset.valleys.flatMap((valley) => valley.facilities),
    };
    this.#shade = dataset.shade;
    this.#overlays.clear();
    this.#filterFingerprint = null;
    this.#filteredOverlays.clear();
  }

  /**
   * 지금 상태로 그릴 내용. 그늘이 꺼져 있으면 바탕 그대로(같은 참조). `filter` 를
   * 생략하면 필터 없음 — 기존 호출부(그늘 유즈케이스들)가 그대로 쓸 수 있다.
   */
  content(
    shadeVisible: boolean,
    hour: ShadeHourIndex,
    filter: MapContentFilter = NO_FILTER,
  ): MapContent {
    const source = this.#baseFor(filter);
    const base = this.landParcels?.length ? { ...source, landParcels: this.landParcels } : source;
    if (!shadeVisible) return base;
    const shade = this.#overlayFor(filter, hour);
    return shade === null ? base : { ...base, shade };
  }

  /** 그늘 데이터가 하나라도 있나. 없으면 토글을 켜도 지도에는 아무것도 얹히지 않는다. */
  get hasShade(): boolean {
    return this.#shade.size > 0;
  }

  /** 필터가 걸린 바탕. 선택이 없으면 필터 없는 원본(`#base`, 같은 참조). */
  #baseFor(filter: MapContentFilter): MapContent {
    if (filter.selected.size === 0) return this.#base;
    this.#refreshFilter(filter);
    return this.#filteredBase;
  }

  /** 지문이 바뀌었을 때만 필터 걸린 바탕·그늘 소스를 다시 만든다. */
  #refreshFilter(filter: MapContentFilter): void {
    const fingerprint = filterFingerprint(filter);
    if (fingerprint === this.#filterFingerprint) return;
    const { valleys } = filterValleys(this.#valleys, filter.selected, filter.pinnedValleyId);
    this.#filteredBase = {
      ...EMPTY_MAP_CONTENT,
      segments: valleys.flatMap((valley) => valley.segments),
      facilities: valleys.flatMap((valley) => valley.facilities),
    };
    const allowed = new Set(valleys.map((valley) => valley.id));
    this.#filteredShade = filterShadeMap(this.#shade, allowed);
    this.#filteredOverlays.clear();
    this.#filterFingerprint = fingerprint;
  }

  #overlayFor(filter: MapContentFilter, hour: ShadeHourIndex): ShadeOverlay | null {
    if (filter.selected.size === 0) return this.#overlay(hour, this.#shade, this.#overlays);
    this.#refreshFilter(filter);
    return this.#overlay(hour, this.#filteredShade, this.#filteredOverlays);
  }

  #overlay(
    hour: ShadeHourIndex,
    shadeSource: ReadonlyMap<ValleyId, ValleyShade>,
    cache: Map<ShadeHourIndex, ShadeOverlay>,
  ): ShadeOverlay | null {
    const cached = cache.get(hour);
    if (cached !== undefined) return cached;
    const shades = [...shadeSource.values()];
    if (shades.length === 0) return null;

    /* 계곡이 하나면 파일의 배열을 그대로 싣고(복사 없음), 여럿이면 이어 붙인다.
       계곡별 지연 로드(S1)가 오면 이 자리가 "지금 보이는 계곡만" 으로 바뀐다. */
    const single = shades.length === 1 ? shades[0] : undefined;
    const overlay: ShadeOverlay =
      single !== undefined
        ? { canopy: single.canopy, shadow: shadowAt(single, hour) }
        : {
            canopy: concat(shades.map((shade) => shade.canopy)),
            shadow: concat(shades.map((shade) => shadowAt(shade, hour))),
          };
    cache.set(hour, overlay);
    return overlay;
  }
}

function concat(parts: readonly ShadePolygons[]): ShadePolygons {
  const merged = parts.flat();
  return merged.length === 0 ? EMPTY_SHADE_POLYGONS : merged;
}

/** 그늘 합본을 허용된 계곡만 남기고 거른다(해석 2·3 — 그늘도 걸러진 계곡과 함께 빠진다). */
function filterShadeMap(
  shade: ReadonlyMap<ValleyId, ValleyShade>,
  allowed: ReadonlySet<ValleyId>,
): ReadonlyMap<ValleyId, ValleyShade> {
  if (shade.size === 0) return shade;
  const filtered = new Map<ValleyId, ValleyShade>();
  for (const [valleyId, valleyShade] of shade) {
    if (allowed.has(valleyId)) filtered.set(valleyId, valleyShade);
  }
  return filtered;
}
