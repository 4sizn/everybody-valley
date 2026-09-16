/**
 * 그늘 — 계곡별 수관·시각별 그림자 폴리곤과 그 메타데이터(F4).
 *
 * `scripts/shade`(P1)가 산출한 `data/shade/<valleyId>/canopy.geojson` 1장과
 * `shadow-<HH>.geojson` 9장이 원천이다. 구간 속성 `shadeByHour`·`canopyCover` 가
 * "이 구간은 몇 % 그늘인가"를 답하고, 이 타입은 "그늘이 **어디에** 있나"를 지도에
 * 그리기 위해 든다. 새 계산은 없다 — 파일을 읽어 그대로 실어 나른다.
 *
 * 좌표는 `LngLat` 값 객체가 아니라 검증된 `[lng, lat]` 튜플이다. 폴리곤 정점이
 * 계곡당 수천 개라 정점마다 객체를 만들면 첫 렌더가 느려지고, 지도 소스로 넘길 때
 * 다시 배열로 풀어야 한다. 검증(범위·링 닫힘·최소 점 수)은 로더가 한 번 한다.
 */
import type { ValleyId } from './ids';
import { SHADE_HOUR_COUNT, SHADE_HOURS, SHADE_NOON_INDEX, type ShadeHourIndex } from './Segment';

/** `[경도, 위도]`. GeoJSON·MapLibre 규약과 같다. */
export type ShadePosition = readonly [lng: number, lat: number];
/** 닫힌 링 — 첫 점과 끝 점이 같고 최소 4점. */
export type ShadeRing = readonly ShadePosition[];
/** 폴리곤 하나 — 외곽 링 + 구멍 링들. */
export type ShadePolygon = readonly ShadeRing[];
export type ShadePolygons = readonly ShadePolygon[];

export const EMPTY_SHADE_POLYGONS: ShadePolygons = [];

/** 화면 고지의 재료. 파일 `metadata` 에서 읽는다(README "한계 고지"). */
export type ShadeMetadata = {
  /** 대표일 'YYYY-MM-DD' — 데이터 규약은 8/1 고정이지만 파일 값을 신뢰한다. */
  readonly representativeDate: string;
  /** 수관 높이 지도의 촬영 연월 목록. 예: `['2019-03', '2019-05']`. 없으면 빈 배열. */
  readonly chmAcquisition: readonly string[];
  /** 사람이 읽는 출처 문장. */
  readonly source: string;
};

export type ValleyShade = {
  readonly valleyId: ValleyId;
  /** 수관(CHM > 2 m) — 시각 무관, 항상 그린다. */
  readonly canopy: ShadePolygons;
  /** 개방지에 드리운 그림자, `SHADE_HOURS` 순 9장. 비어 있을 수 있다(정오 근처). */
  readonly shadowByHour: readonly ShadePolygons[];
  readonly metadata: ShadeMetadata;
};

/** `SHADE_HOURS` 의 시(hour) 값. 로더가 합본의 키(`"10"`…`"18"`)와 대조한다. */
export const SHADE_HOUR_VALUES: readonly number[] = SHADE_HOURS.map((hour) =>
  Number(hour.slice(0, 2)),
);
const FIRST_SHADE_HOUR = SHADE_HOUR_VALUES[0] as number;
const LAST_SHADE_HOUR = SHADE_HOUR_VALUES[SHADE_HOUR_COUNT - 1] as number;
const KST_OFFSET_MINUTES = 9 * 60;
const MINUTES_PER_DAY = 24 * 60;

export function isShadeHourIndex(value: number): value is ShadeHourIndex {
  return Number.isInteger(value) && value >= 0 && value < SHADE_HOUR_COUNT;
}

/** 범위를 벗어난 인덱스를 양끝으로 붙인다 — ‹ › 버튼이 끝에서 더 눌려도 안전하게. */
export function clampShadeHourIndex(value: number): ShadeHourIndex {
  const clamped = Math.min(SHADE_HOUR_COUNT - 1, Math.max(0, Math.round(value)));
  return clamped as ShadeHourIndex;
}

/**
 * 시간 트랙의 기본 시각 (F4 결정 (a)).
 *
 * 지금 KST 시각을 10~18 시로 클램프해 **가장 가까운 정시**. 10시 전·18시 후에
 * 열면 **정오** — 그 시각에는 그늘 데이터가 없고, 정오는 `shadeRatio` 와 같은
 * 값이라 카드 부제와 지도가 일치한다. KST 는 UTC+9 고정(서머타임 없음).
 */
export function defaultShadeHourIndex(now: Date): ShadeHourIndex {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + KST_OFFSET_MINUTES) % MINUTES_PER_DAY;
  const kstHour = Math.floor(kstMinutes / 60);
  if (kstHour < FIRST_SHADE_HOUR || kstHour > LAST_SHADE_HOUR) return SHADE_NOON_INDEX;
  const nearest = Math.min(LAST_SHADE_HOUR, Math.round(kstMinutes / 60));
  return clampShadeHourIndex(nearest - FIRST_SHADE_HOUR);
}

/** 그 시각의 그림자. 배열 길이는 로더가 9 로 보장하지만 방어적으로 빈 값을 돌려준다. */
export function shadowAt(shade: ValleyShade, index: ShadeHourIndex): ShadePolygons {
  return shade.shadowByHour[index] ?? EMPTY_SHADE_POLYGONS;
}

// ── 나무 밀도 3단계 ─────────────────────────────────────────────

/** 나무 밀도(`Segment.canopyCover`) 표시 단계. 많음 / 보통 / 적음. */
export const CANOPY_LEVELS = ['dense', 'moderate', 'sparse'] as const;
export type CanopyLevel = (typeof CANOPY_LEVELS)[number];

/** F4 결정 (f) — `canopyCover ≥ 0.7` 많음, `≥ 0.4` 보통, 그 외 적음. */
export const CANOPY_DENSE_MIN = 0.7;
export const CANOPY_MODERATE_MIN = 0.4;

export function canopyLevel(cover: number): CanopyLevel {
  if (cover >= CANOPY_DENSE_MIN) return 'dense';
  if (cover >= CANOPY_MODERATE_MIN) return 'moderate';
  return 'sparse';
}

const CANOPY_LEVEL_LABELS: Readonly<Record<CanopyLevel, string>> = {
  dense: '나무 많음',
  moderate: '나무 보통',
  sparse: '나무 적음',
};

export function canopyLevelLabel(level: CanopyLevel): string {
  return CANOPY_LEVEL_LABELS[level];
}
