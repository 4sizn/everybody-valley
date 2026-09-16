/**
 * 지도 엔진 능력 매트릭스.
 *
 * web(maplibre-gl)과 네이티브(maplibre-react-native)는 같은 이름의 지도지만
 * 제공 범위가 다르다. 특히 **커스텀 WebGL 레이어**는 네이티브 래퍼가 카메라
 * 행렬을 노출하지 않아 그대로 옮길 수 없다. 그 사실을 런타임에 물어볼 수
 * 있게 타입으로 못 박아 두면, 표현 계층이 "안 되는 기능"을 조용히 실패시키는
 * 대신 대체 UI 를 고를 수 있다.
 */
export type MapCapabilities = {
  /** 로그·오류 메시지에 쓰는 엔진 이름. */
  readonly engineName: string;
  /** 줌아웃 시 구체로 모핑하는 적응형 투영. */
  readonly globeProjection: boolean;
  /** fill-extrusion 3D 건물. */
  readonly extrudedBuildings: boolean;
  /** 카메라 행렬을 받아 직접 그리는 커스텀 레이어 — 불꽃 파티클의 전제. */
  readonly particleLayer: boolean;
  /** 라벨을 `name:ko` 로 갈아끼울 수 있는가. */
  readonly localizedLabels: boolean;
  /** 카메라 이동 시 화면 픽셀 오프셋(하단 시트 회피). */
  readonly cameraOffset: boolean;
  /** 밤하늘 sky/atmosphere 설정. */
  readonly sky: boolean;
  /**
   * 엔진이 **자체 확대·축소 버튼**을 화면에 그리는가.
   *
   * maplibre-gl 은 `NavigationControl` 로 +/− 버튼을 직접 얹는다.
   * maplibre-native 래퍼에는 대응 컨트롤이 없어 화면상 줌 수단이 사라진다
   * (핀치는 되지만 눌러서 줌할 곳이 없다). 표현 계층이 이 값을 읽어
   * 엔진이 그려 주지 않을 때만 자기 줌 버튼을 얹는다 — 그래야 web 에서
   * 줌 버튼이 두 벌로 겹치지 않는다.
   */
  readonly builtInZoomControls: boolean;
  /**
   * 3D 지형 — DEM 으로 지면을 실제로 들어 올리는 `setTerrain`(C10b).
   *
   * maplibre-gl 만 있다. maplibre-native 는 3D terrain 이 없고(트래킹 #252, draft PR
   * #4190) 음영기복·고도색까지가 상한이라 `false`. 두 플랫폼이 공유하는 음영기복·고도색은
   * 스타일 JSON 으로 성립하므로 능력 항목이 아니다 — 이 값은 "지면이 기울어 보이는가"만
   * 말한다. 표현 계층은 이 값을 읽어 카메라 프리셋의 3D 연출을 켠다.
   */
  readonly terrain: boolean;
};

export const NO_CAPABILITIES: MapCapabilities = {
  engineName: 'none',
  globeProjection: false,
  extrudedBuildings: false,
  particleLayer: false,
  localizedLabels: false,
  cameraOffset: false,
  sky: false,
  builtInZoomControls: false,
  terrain: false,
};
