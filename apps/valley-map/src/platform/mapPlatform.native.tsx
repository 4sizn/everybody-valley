/**
 * 네이티브(android/ios) 플랫폼 배선.
 *
 * web 배선(`mapPlatform.web.tsx`)은 DOM 노드 하나를 건네주면 끝난다.
 * maplibre-gl 이 명령형이라 어댑터가 그 노드에 지도를 만들어 소유할 수 있기
 * 때문이다. `@maplibre/maplibre-react-native` 는 선언형이라 지도가 React
 * 엘리먼트다 — 소유자가 될 수 없다.
 *
 * 그래서 손잡이로 노드가 아니라 `MapSurface`(양방향 다리)를 건넨다.
 *   MapHost      surface 를 만들고, 그 스냅샷을 그리는 지도 뷰를 올린다
 *   createMapEngine  같은 surface 를 물려 `NativeMapEngine` 을 만든다
 *
 * surface 의 생애는 지도 뷰와 같으므로 이 파일이 정리한다. 엔진은 빌려
 * 쓰기만 한다(세션이 다시 만들어져도 지도 뷰는 그대로 살아 있다).
 */

import { AsyncKeyValueStorage, MapSurface, NativeMapEngine } from '@modu-valley/adapter-native';
import {
  ConsoleLogger,
  type InitialCameraView,
  type LngLat,
  type Logger,
  type MapEnginePort,
  type StoragePort,
} from '@modu-valley/core';
import type { MapStyleMode } from '@modu-valley/map-style';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ABSOLUTE_FILL } from '@/theme/layout';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { BASEMAP_ORIGIN_OVERRIDE } from './baseMapOverride';
import { NativeMapView } from './native/NativeMapView';

export type MapHostHandle = {
  readonly kind: 'native';
  readonly surface: MapSurface;
};

export type MapHostProps = {
  readonly onHost: (host: MapHostHandle | null) => void;
};

/**
 * surface 전용 로거.
 *
 * surface 는 지도 뷰와 생애가 같아서 세션(그리고 세션 로거)보다 먼저
 * 만들어진다. 그래서 세션 로거를 물려받을 수 없고, 같은 콘솔 구현을 같은
 * 이름으로 쓴다 — 로그 태그는 `valley:map-surface` 로 이어진다.
 */
const surfaceLogger: Logger = new ConsoleLogger('valley');

/** 데모의 `<div id="map-root">` 자리 — 화면 전체를 덮는 지도 표면. */
export function MapHost({ onHost }: MapHostProps) {
  const [surface, setSurface] = useState<MapSurface | null>(null);
  const themed = useThemedStyles();

  /* surface 를 `useState` 초기화 함수가 아니라 effect 안에서 만든다.
     초기화 함수에서 만들고 정리를 cleanup 에 두면, 이중 마운트(StrictMode)나
     핫리로드에서 **이미 정리된 surface 로 다시 마운트**된다 — 그 뒤로는 게시가
     전부 무시돼 지도가 영영 뜨지 않는다. 마운트마다 새로 만들면 정리 경로를
     유지하면서 그 함정을 피한다. */
  useEffect(() => {
    const next = new MapSurface(surfaceLogger);
    setSurface(next);
    onHost({ kind: 'native', surface: next });
    return () => {
      onHost(null);
      setSurface(null);
      next.dispose();
    };
  }, [onHost]);

  // surface 가 생기기 전 한 프레임은 배경색만 — 지도 자리가 흰색으로 비지 않게.
  if (surface === null) return <View style={[styles.placeholder, themed.placeholder]} />;
  return <NativeMapView surface={surface} />;
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
  readonly fireworks?: boolean;
  readonly logger: Logger;
};

export function createMapEngine(options: CreateMapEngineOptions): MapEnginePort {
  return new NativeMapEngine({
    surface: options.host.surface,
    launchSite: options.launchSite,
    initialView: options.initialView,
    styleMode: options.styleMode,
    terrain: options.terrain,
    logger: options.logger,
    // 개발용 강제 장애(C7) — 정상 빌드는 undefined 라 스타일이 그대로다.
    ...(BASEMAP_ORIGIN_OVERRIDE === undefined
      ? {}
      : { baseMapOriginOverride: BASEMAP_ORIGIN_OVERRIDE }),
  });
}

/**
 * `AsyncStorage` 를 포트에 꽂는다. 어댑터가 이 패키지를 직접 import 하지 않는
 * 이유는 `AsyncKeyValueStorage` 주석에 적혀 있다 — 필요한 세 메서드만 계약으로
 * 두면 네이티브 모듈 의존이 표현 계층 경계에 머문다.
 */
export function createStorage(): StoragePort {
  return new AsyncKeyValueStorage({ store: AsyncStorage });
}

const styles = StyleSheet.create({
  placeholder: ABSOLUTE_FILL,
});

const useThemedStyles = createThemedStyles((theme) => ({
  placeholder: { backgroundColor: theme.colors.bg },
}));
