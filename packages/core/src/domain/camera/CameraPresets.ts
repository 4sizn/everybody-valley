/**
 * 카메라 프리셋 — 데모의 카메라 수치를 한 곳에 모은 것.
 *
 * 값은 원본 데모에서 그대로 옮겼다. 주석의 숫자가 데모의 어느 호출인지
 * 밝혀 두었으니, 파리티 검증 시 여기만 보면 된다.
 */
import { bearingBetween, normalizeBearing } from '../geo/Bearing';
import type { LngLat } from '../geo/LngLat';
import type { Segment } from '../valley/Segment';
import { type CameraCommand, cameraCommand } from './CameraPose';
import { type CameraViewportInsets, viewportCenterOffset } from './ViewportCameraOffset';

/**
 * 최대 pitch — **양 플랫폼 공통 상한**.
 *
 * 데모는 `maxPitch: 85` 로 만든다. 그런데 maplibre-native 는 60도가 SDK 하드
 * 상한이다 (iOS `MLNMapView.maximumPitch` 문서: "may not exceed 60 degrees
 * regardless of this property"; Android `MAXIMUM_TILT` 도 60). 올릴 방법이
 * 없으므로 동일한 동작을 원하면 web 을 내려야 한다.
 *
 * 그래서 60 으로 맞췄다 — web 에서만 더 눕는 화면을 없애는 대가로 데모의 85
 * 를 포기한 것이다. 되돌리려면 이 값을 85 로 바꾸면 되고, 그 순간 web 은
 * 데모와 같아지고 네이티브와는 달라진다.
 */
export const MAX_PITCH = 60;

/**
 * 지도 최초 생성 시점의 시점 — 어댑터가 지도를 만들 때 쓴다. 중심은 앱이 따로
 * 넘긴다(festival 은 발사 지점, valley 는 첫 계곡). 장면마다 다르다: 첫 카메라
 * 명령이 `offset` 을 쓰는데 MapLibre 는 그 픽셀 offset 을 **현재** 시점(pitch)의
 * 투영으로 지면 거리로 바꾸므로, pitch 62 에서 출발해 pitch 0 으로 가는 비행은
 * 중심이 크게 어긋난다(F1b 에서 실측). 장면의 시작 pitch 를 목표와 맞춰 둔다.
 */
export type InitialCameraView = {
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
  readonly maxPitch: number;
};

/** festival 데모의 첫 시점. `new maplibregl.Map({...})` */
export const INITIAL_VIEW: InitialCameraView = {
  zoom: 13.6,
  pitch: 62,
  bearing: -22,
  maxPitch: MAX_PITCH,
};

/** 3D 로 볼 때의 기본 pitch. 데모에서 `pitch:62` 로 네 번 반복되는 값. */
export const TILTED_PITCH = 62;
/** 2D 로 눕힐 때. */
export const FLAT_PITCH = 0;
/** 이 값을 넘으면 "기울어져 있다"고 본다. 데모 `map.getPitch() > 20`. */
export const PITCH_FLAT_THRESHOLD = 20;
/** 이 줌보다 가까우면 지구본으로 나갈 차례. 데모 `map.getZoom() > 4`. */
export const GLOBE_ZOOM_THRESHOLD = 4;

/** 줌 버튼 한 번의 변화량. maplibre `NavigationControl` 과 같은 1 레벨. */
export const ZOOM_STEP = 1;
/** 줌 한계. maplibre-gl·maplibre-native 의 기본 범위와 같다. */
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 22;

// ── festival ───────────────────────────────────────────────────
//  원본 데모(`docs/references/firework-map-clone.html`)에서 그대로 옮긴 값.

/** 나침반 버튼 — 북쪽 정렬. `easeTo({bearing:0, pitch:62, duration:800})` */
export function alignNorth(): CameraCommand {
  return cameraCommand({ bearing: 0, pitch: TILTED_PITCH }, { motion: 'ease', durationMs: 800 });
}

/** 발사 지점 버튼. `flyTo({center:LAUNCH, zoom:13.6, pitch:62, bearing:-22, duration:1400})` */
export function recenterLaunch(launchSite: LngLat): CameraCommand {
  return cameraCommand(
    {
      center: launchSite,
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
    },
    { motion: 'fly', durationMs: 1400 },
  );
}

/**
 * 확대·축소 버튼 한 번.
 *
 * 데모에는 이 조작이 없다 — web 은 maplibre 의 `NavigationControl` 이 대신
 * 하기 때문이다. 네이티브 래퍼에는 그 컨트롤이 없어 표현 계층이 버튼을 얹고,
 * 그 버튼이 부르는 명령을 여기 둔다. 한계를 넘어서면 같은 줌으로 정착하므로
 * 버튼을 계속 눌러도 카메라가 튀지 않는다.
 */
export function zoomBy(currentZoom: number, delta: number): CameraCommand {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom + delta));
  return cameraCommand({ zoom: next }, { motion: 'ease', durationMs: 300 });
}

/** 2D/3D 토글. `easeTo({pitch: ..., duration:800})` */
export function togglePitch(currentPitch: number): CameraCommand {
  return cameraCommand(
    { pitch: currentPitch > PITCH_FLAT_THRESHOLD ? FLAT_PITCH : TILTED_PITCH },
    { motion: 'ease', durationMs: 800 },
  );
}

/** 지구본으로 나가기. `flyTo({center:LAUNCH, zoom:1.5, pitch:0, bearing:0, duration:3000})` */
export function zoomToGlobe(launchSite: LngLat): CameraCommand {
  return cameraCommand(
    { center: launchSite, zoom: 1.5, pitch: FLAT_PITCH, bearing: 0 },
    { motion: 'fly', durationMs: 3000 },
  );
}

/** 지구본에서 돌아오기. 같은 목표에 duration 만 3400. */
export function returnFromGlobe(launchSite: LngLat): CameraCommand {
  return cameraCommand(
    {
      center: launchSite,
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
    },
    { motion: 'fly', durationMs: 3400 },
  );
}

/**
 * 명당 순회 비행. `flyTo({zoom:15.4, pitch:72, bearing:(tour*47)%360, duration:2600, curve:1.5})`
 * bearing 이 매 회차 47도씩 돌아가는 것까지 원본과 같다.
 */
export function tourStep(position: LngLat, step: number): CameraCommand {
  return cameraCommand(
    { center: position, zoom: 15.4, pitch: 72, bearing: (step * 47) % 360 },
    { motion: 'fly', durationMs: 2600, curve: 1.5 },
  );
}

/**
 * 명당 상세 열기.
 * `flyTo({zoom:15.4, pitch:64, duration:1400, offset:[0,-90], essential:true})`
 * bearing 을 지정하지 않아 사용자가 돌려 둔 방향이 유지된다.
 */
export function focusSpot(position: LngLat): CameraCommand {
  return cameraCommand(
    { center: position, zoom: 15.4, pitch: 64, offset: [0, -90] },
    { motion: 'fly', durationMs: 1400, essential: true },
  );
}

/** 상세 닫기. `easeTo({zoom:13.8, pitch:62, duration:1100, offset:[0,0]})` */
export function releaseSpot(): CameraCommand {
  return cameraCommand(
    { zoom: 13.8, pitch: TILTED_PITCH, offset: [0, 0] },
    { motion: 'ease', durationMs: 1100 },
  );
}

/** 주변에서 찾기. `flyTo({zoom:16.4, pitch:74, bearing:(bearing+70)%360, duration:2000})` */
export function inspectNearby(position: LngLat, currentBearing: number): CameraCommand {
  return cameraCommand(
    { center: position, zoom: 16.4, pitch: 74, bearing: (currentBearing + 70) % 360 },
    { motion: 'fly', durationMs: 2000 },
  );
}

// ── valley ─────────────────────────────────────────────────────
//  계곡 화면의 시점. 위 festival 절과 달리 데모에서 옮긴 값이 아니라 **이 앱이
//  정한 값**이다. 계곡에는 3D 건물이 없어 기울일 이유가 없고(pitch 를 올리면
//  선이 얇아지고 산 능선이 지도를 가린다), 방위도 북쪽 고정이 지형 읽기에 낫다.
//  값은 F1b 에서 web 화면(1440×757)으로 확인해 잡았다 — 근거는 각 함수 주석에.

/**
 * 계곡 전체 보기 — 첫 진입과 "계곡으로" 버튼. 상세 닫기(`releaseSegment`)도 같은
 * 틀로 돌아온다.
 *
 * zoom 14.2: 샘플 계곡(구간 3개, 약 0.96km × 0.86km)이 1440×757 web 화면에서 약
 * 290×250px — 시트 위 빈 영역(높이 약 416px, 상단바 아래)에 통째로 들어오는 값.
 * 기획 초깃값 13.5 는 선이 150px 남짓으로 짧아 시설 점과 겹쳐 보였고, 14.7 은
 * 하류 끝이 시트 밑으로 들어갔다(F1b 눈 확인).
 * offset [0,-120]: 시트가 화면 아래 45%(757px 기준 340px)를 가리므로 계곡을 위로
 * 올린다. 남는 영역의 정확한 가운데(-170)까지 올리면 상류 끝이 상단바(높이 64)에
 * 닿아, 상단바와 시트 사이에 여유를 두는 값으로 낮췄다. 명당의 [0,-90] 은 점
 * 하나를 시트 위로 올리는 값이고, 계곡은 면적이 있어 더 올려야 전체가 보인다.
 * pitch 0·bearing 0: 위 절 머리말 참고.
 *
 * **C6 이후** — `focusValley` 는 이 상수 대신 `viewportCenterOffset`(인셋 기반)을 쓴다.
 * 이 상수는 이제 `releaseSegment`(상세 닫기 → 전체 보기 복귀)만 쓴다 — 그 경로는
 * 이번 결정 범위 밖이라 손대지 않았다(TODO C6 참고).
 */
export const VALLEY_OVERVIEW_ZOOM = 14.2;
export const VALLEY_FLAT_PITCH = 0;
export const VALLEY_OVERVIEW_OFFSET: readonly [x: number, y: number] = [0, -120];

/** 계곡 화면의 첫 시점 — `focusValley` 와 같은 줌·평면·북쪽. 첫 비행은 offset 만 적용한다. */
export const VALLEY_INITIAL_VIEW: InitialCameraView = {
  zoom: VALLEY_OVERVIEW_ZOOM,
  pitch: VALLEY_FLAT_PITCH,
  bearing: 0,
  maxPitch: MAX_PITCH,
};

/** `insets` — 지금 시트 스냅·상단바가 가리는 만큼(C6, `viewportCenterOffset` 참고). */
export function focusValley(center: LngLat, insets: CameraViewportInsets): CameraCommand {
  return cameraCommand(
    {
      center,
      zoom: VALLEY_OVERVIEW_ZOOM,
      pitch: VALLEY_FLAT_PITCH,
      bearing: 0,
      offset: viewportCenterOffset(insets),
    },
    { motion: 'fly', durationMs: 1400 },
  );
}

/** 구간 상세의 줌 — 구간 하나(수백 m)가 화면 폭의 절반쯤을 차지해 선택 강조가 읽히는 값. */
export const VALLEY_DETAIL_ZOOM = 15.5;
/** 3D 지형이 없을 때의 상세 pitch(F1b) — 살짝 눕히면 선이 "물길"로 읽히고 그 이상은 얻는 게 없다. */
export const VALLEY_DETAIL_FLAT_PITCH = 30;
/**
 * 3D 지형 위에서의 상세 pitch(C10 결정 (e)). `MAX_PITCH` 60 안쪽 — 그 위로는 지평선이
 * 들어와 sky 가 필요해진다(스파이크에서 60 까지 미노출 확인, sky 는 범위 밖).
 */
export const VALLEY_DETAIL_TERRAIN_PITCH = 58;
/**
 * 상세 시트를 피해 중심을 위로 올리던 옛 고정값 — festival 의 [0,-90] 을 그대로 옮겨 온
 * 것이었다. C6 부터 `focusSegment` 는 `viewportCenterOffset`(인셋 기반)을 쓰므로 이
 * 상수는 더 쓰이지 않는다 — `ViewportCameraOffset.ts` 의 회귀 테스트가 이 값을
 * "top=0·bottom=180 상태의 계산 결과"로 대체해 기록해 둔다.
 */

/**
 * 계곡 축을 **가로질러** 보는 방위 (C10 결정 (e) E4).
 *
 * 구간 축은 상류(`start`)→하류(`end`) 방위각 θ 다. 화면 위쪽이 θ − 90° 를 향하면 축은
 * 화면을 왼쪽→오른쪽으로 가로지르고 **상류가 왼쪽, 하류가 오른쪽**에 놓인다 — 골짜기
 * 양쪽 벽이 화면 위·아래에 서고 물이 왼쪽에서 오른쪽으로 내려간다.
 *
 * 결정 기록에는 "θ + 90°" 로 적혀 있지만 그 값은 하류를 **왼쪽**에 놓는다(MapLibre
 * `bearing` = 화면 위쪽이 가리키는 나침반 방향; 동쪽으로 흐르는 구간에 +90 을 주면
 * 남쪽이 위가 되어 동쪽(하류)이 왼쪽). 사용자가 확정한 문장은 "상류 왼쪽·하류 오른쪽"
 * 이므로 그 결과를 따른다 — PR 에 표기해 두었다.
 */
export function valleyAxisBearing(segment: Segment): number {
  return normalizeBearing(bearingBetween(segment.start, segment.end) - 90);
}

export type FocusSegmentOptions = {
  /**
   * 엔진에 3D 지형이 있는가(`MapCapabilities.terrain`). 있으면 결정 (e) 의 기울인 시점
   * (pitch 58·축 가로지르기 bearing), 없으면 F1b 의 평면에 가까운 시점 — 지형이 없는
   * 지도를 58° 로 눕히면 납작한 선만 남는다(네이티브).
   */
  readonly terrain: boolean;
  /** 지금 시트 스냅·상단바가 가리는 만큼(C6, `viewportCenterOffset` 참고). */
  readonly insets: CameraViewportInsets;
};

/**
 * 구간 상세 열기 — 카드 탭·지도 선 탭.
 *
 * 중심은 구간 **중간점**(끝점은 옆 구간과 겹친다). zoom 15.5. pitch·bearing 은 지형
 * 유무로 갈린다(`FocusSegmentOptions`). offset 은 인셋에서 계산한다(C6) — 시트가 펼침
 * 상태여도 특별한 보정 없이 그 인셋값을 그대로 반영할 뿐이다(덮임 처리는 만들지 않는다,
 * 사용자 결정 2026-09-07).
 */
export function focusSegment(segment: Segment, options: FocusSegmentOptions): CameraCommand {
  const tilted = options.terrain;
  return cameraCommand(
    {
      center: segment.midpoint(),
      zoom: VALLEY_DETAIL_ZOOM,
      pitch: tilted ? VALLEY_DETAIL_TERRAIN_PITCH : VALLEY_DETAIL_FLAT_PITCH,
      ...(tilted ? { bearing: valleyAxisBearing(segment) } : {}),
      offset: viewportCenterOffset(options.insets),
    },
    { motion: 'fly', durationMs: 1400, essential: true },
  );
}

/**
 * 구간 상세 닫기. `releaseSpot` 의 계곡판 — 전체 보기 줌·평면·북쪽·전체 보기 offset 으로.
 * 중심은 지정하지 않아 사용자가 끌어 둔 위치는 유지된다(데모 `closeSpot` 과 같다).
 * bearing 0 은 C10 부터 — 상세가 축 방향으로 돌아가 있으므로 전체 보기(북쪽 고정)로
 * 되돌린다. 지형 없는 엔진에서는 상세도 북쪽이라 no-op 이다.
 */
export function releaseSegment(): CameraCommand {
  return cameraCommand(
    {
      zoom: VALLEY_OVERVIEW_ZOOM,
      pitch: VALLEY_FLAT_PITCH,
      bearing: 0,
      offset: VALLEY_OVERVIEW_OFFSET,
    },
    { motion: 'ease', durationMs: 1100 },
  );
}
