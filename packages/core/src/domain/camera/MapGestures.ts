/**
 * 지도 조작 제스처 정책 — **세 플랫폼의 유일한 선언 지점**.
 *
 * 왜 이 파일이 필요한가. 두 지도 엔진은 제스처를 서로 다른 모양으로 노출한다.
 *
 *   maplibre-gl (web)      `touchZoomRotate` 하나가 **핀치 줌 + 핀치 회전 +
 *                          더블탭-드래그 빠른 줌**을 함께 들고 있다.
 *                          회전만 끄려면 `disableRotation()` 을 따로 불러야 한다.
 *   maplibre-native        `touchZoom` / `touchRotate` / `doubleTapHoldZoom` 이
 *                          각각 독립 boolean 이다.
 *
 * 그래서 "각 SDK 기본값에 맡긴다"로 두면 어느 제스처가 켜져 있는지가 플랫폼별로
 * 갈리고, 코드 어디에도 의도가 적혀 있지 않다. 실제로 그렇게 두었다가 web 과
 * 네이티브의 핀치 동작이 어긋났다. 정책을 여기 한 곳에 값으로 적고, 어댑터는
 * **번역만** 한다 — `MapEnginePort.setGestures` 가 그 통로다.
 *
 * ── 옮길 수 없는 차이 (엔진이 다르면 남는다)
 *
 *  · **줌 배율·임계값**: 같은 물리적 핀치 거리가 두 엔진에서 같은 줌 변화량을
 *    만들지 않는다. maplibre-gl 은 `touchZoomRotate.setZoomRate` 로 조절
 *    가능하지만 네이티브 래퍼는 대응 API 를 노출하지 않는다.
 *  · **최대 pitch**: maplibre-gl 은 원하는 값을 받지만 maplibre-native 는
 *    60도가 SDK 하드 상한이다(iOS `MLNMapView.maximumPitch` 문서:
 *    "may not exceed 60 degrees regardless of this property").
 *  · **빠른 줌(더블탭 후 드래그)**: web 에서는 핀치와 같은 핸들러에 묶여 있어
 *    핀치를 켜면 함께 켜진다. 따로 끌 수 없다.
 *
 * 이 세 가지는 숨기지 않고 `docs/PARITY.md` 에 측정값으로 적어 둔다.
 */

export type MapGestures = {
  /** 한 손가락 끌어 이동. */
  readonly pan: boolean;
  /** 두 손가락 핀치로 확대·축소. */
  readonly pinchZoom: boolean;
  /**
   * 두 손가락 비틀어 회전.
   *
   * 끄면 핀치 중에 지도가 돌지 않는다 — 확대만 하려는데 화면이 기우는 일을
   * 막는다. web 은 `disableRotation()`, 네이티브는 `touchRotate={false}` 로
   * 같은 결과를 만든다.
   *
   * **회전 축은 두 손가락의 중간점이다** — maplibre-gl 은 핀치 중간점을
   * `around` 로 넘겨 회전·줌을 같은 점에 걸고(`TwoFingersTouchRotateHandler`),
   * 축을 다른 점으로 바꾸는 옵션은 없다(`enable({around:'center'})` 로 화면
   * 중앙에 고정하는 것만 가능). "한 손가락을 축으로" 는 커스텀 핸들러가
   * 있어야 하고, 지금은 SDK 기본 축을 쓴다(사용자 결정 2026-09-08).
   *
   * web 에서는 **마우스 우클릭·ctrl 드래그 회전(`dragRotate`)도 이 값에 묶여
   * 있다** — 어댑터가 두 핸들러를 같은 값으로 맞춘다. 터치가 없는 데스크톱
   * 브라우저에서도 같은 정책이 보이게 하는 쪽이 맞다고 보았다.
   */
  readonly pinchRotate: boolean;
  /** 더블탭으로 한 단계 확대. */
  readonly doubleTapZoom: boolean;
  /**
   * 더블탭 후 드래그로 한 손가락 확대·축소.
   *
   * web 에서는 핀치와 같은 핸들러라 `pinchZoom` 을 따라간다(따로 끌 수 없다).
   * 네이티브에서는 독립적으로 끌 수 있다.
   */
  readonly quickZoom: boolean;
  /** 두 손가락 수직 드래그로 기울이기. */
  readonly dragPitch: boolean;
};

/**
 * 이 앱의 제스처 정책 — **세 플랫폼이 같은 값을 받는다**(표면별 분기 없음).
 *
 * 회전은 2026-09-08 사용자 요청으로 **켜져 있다**. 오래 꺼 두었던 이유는 데모가 방위를
 * **의도적으로** 정하기 때문이었다(`tourStep` 의 47도 증가, `inspectNearby` 의 70도 회전,
 * 나침반 버튼). 핀치 중에 방위가 흔들리는 것은 두 가지가 막는다 — 두 엔진 모두 가진 회전
 * 임계값(두 손가락 간격이 좁거나 비틀림이 작으면 무시)과, 언제든 정북으로 되돌리는 나침반
 * 버튼(`session.alignNorth()`)이다.
 *
 * 회전 축은 **두 손가락의 중간점**이다(SDK 기본). maplibre-gl 은 핀치 중간점을 `around` 로
 * 넘기고, 축을 특정 손가락으로 바꾸는 옵션은 없다(`enable({around:'center'})` 로 화면 중앙
 * 고정만 가능). 그래서 회전 뒤에는 중심이 조금 옮겨져 있고, 나침반은 방위만 되돌린다.
 *
 * web 에서는 이 값이 **마우스 회전(`dragRotate`)까지 함께** 켠다 — 우클릭(맥 트랙패드 두
 * 손가락 클릭) 또는 ctrl+좌클릭 드래그. 좌우가 방위, 상하가 기울기다. 브라우저는 트랙패드의
 * 회전 제스처를 페이지로 넘기지 않으므로 데스크톱에서는 그 경로가 유일한 회전 수단이다.
 *
 * 실측(2026-09-08) — web 은 두 손가락 60도 비틀기에 방위 47.5도(회전 임계값 약 14도 선소진).
 * iOS 시뮬레이터(iPhone 17 Pro)에서도 양방향 회전이 되고, 나침반 복귀까지 확인했다.
 * 안드로이드는 같은 `touchRotate` prop 을 쓰지만 이 개발 환경에 SDK·에뮬레이터가 없어
 * **코드로만 켜져 있다**(미검증).
 */
export const DEFAULT_MAP_GESTURES: MapGestures = {
  pan: true,
  pinchZoom: true,
  pinchRotate: true,
  doubleTapZoom: true,
  quickZoom: true,
  dragPitch: true,
};
