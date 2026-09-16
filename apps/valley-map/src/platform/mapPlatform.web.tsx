/**
 * web 플랫폼 배선.
 *
 * 지도 엔진은 DOM 요소를 요구한다. RN 트리 안에서 그 요소를 얻으려면
 * `View` 의 ref 가 react-native-web 에서 실제 DOM 노드라는 사실을 이용한다.
 * 그 캐스팅이 이 파일 밖으로 새지 않도록 `MapHostHandle` 로 감싼다.
 */

import { MapLibreEngine, WebStorage } from '@modu-valley/adapter-web';
import type {
  InitialCameraView,
  LngLat,
  Logger,
  MapEnginePort,
  StoragePort,
} from '@modu-valley/core';
import type { MapStyleMode } from '@modu-valley/map-style';
// 지도 컨트롤·어트리뷰션의 기본 스타일. 데모는 CDN 으로 불러오지만
// 번들에 든 maplibre-gl 과 버전이 어긋날 수 없도록 패키지에서 가져온다.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback } from 'react';
import { View } from 'react-native';
import { ABSOLUTE_FILL } from '@/theme/layout';
import { BASEMAP_ORIGIN_OVERRIDE } from './baseMapOverride';

export type MapHostHandle = {
  readonly kind: 'dom';
  readonly node: HTMLElement;
};

export type MapHostProps = {
  readonly onHost: (host: MapHostHandle | null) => void;
};

/** 데모의 `<div id="map-root">` — 화면 전체를 덮는 지도 캔버스 자리. */
export function MapHost({ onHost }: MapHostProps) {
  const attach = useCallback(
    (instance: View | null) => {
      // RNW 의 View ref 는 DOM 요소다. 타입에는 드러나지 않아 여기서 좁힌다.
      const node = instance as unknown as HTMLElement | null;
      onHost(node === null ? null : { kind: 'dom', node });
    },
    [onHost],
  );

  // `StyleSheet.absoluteFill` 은 등록된 스타일 ID 라 react-native-web 이
  // position 을 클래스로 내보내지 않는다. 그러면 RNW 기본 클래스의
  // `position:relative` 가 남아 컨테이너 높이가 0 이 되고 지도가 그려지지
  // 않는다. 값 객체를 직접 넘겨 position 까지 확실히 실린다.
  return <View ref={attach} style={ABSOLUTE_FILL} dataSet={{ mv: 'map-root' }} />;
}

export type CreateMapEngineOptions = {
  readonly host: MapHostHandle;
  /** 지도 최초 중심(festival 은 불꽃 원점 겸). */
  readonly launchSite: LngLat;
  /** 지도 최초 시점 — 장면이 정한다. */
  readonly initialView: InitialCameraView;
  /** 지도 팔레트 모드 — 테마 모드와 같은 값. 생성 시점에 정해진다 — 테마가 바뀌면 세션(엔진)이 다시 만들어진다(C9 결정 (d)). */
  readonly styleMode: MapStyleMode;
  /** 지형(DEM + 고도색·음영기복)을 스타일에 얹는가 — 계곡 장면만. festival 은 소스도 늘지 않는다. */
  readonly terrain: boolean;
  readonly logger: Logger;
};

/**
 * maplibre-gl 워커 경로.
 *
 * `scripts/sync-maplibre-worker.mjs` 가 설치된 패키지에서 `public/maplibre/`
 * 로 복사한다. Expo 는 `public/` 을 web 루트에 그대로 서빙하고 export 에도
 * 함께 담는다. 이 경로가 어긋나면 지도는 뜨지만 타일·마커가 하나도
 * 그려지지 않는다(워커 없이는 GeoJSON 파싱이 일어나지 않는다).
 */
const MAPLIBRE_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

export function createMapEngine(options: CreateMapEngineOptions): MapEnginePort {
  return new MapLibreEngine({
    container: options.host.node,
    launchSite: options.launchSite,
    initialView: options.initialView,
    styleMode: options.styleMode,
    terrain: options.terrain,
    logger: options.logger,
    // 개발용 강제 장애(C7) — 정상 빌드는 undefined 라 스타일이 그대로다.
    ...(BASEMAP_ORIGIN_OVERRIDE === undefined
      ? {}
      : { baseMapOriginOverride: BASEMAP_ORIGIN_OVERRIDE }),
    workerUrl: MAPLIBRE_WORKER_URL,
  });
}

export function createStorage(): StoragePort {
  return new WebStorage();
}
