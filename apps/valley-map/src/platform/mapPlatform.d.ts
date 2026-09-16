/**
 * 플랫폼 배선의 공용 계약.
 *
 * 실제 구현은 `mapPlatform.web.tsx` 와 `mapPlatform.native.tsx` 두 개이고,
 * Metro 가 빌드 대상에 맞는 쪽을 고른다. TypeScript 는 확장자 기반 플랫폼
 * 해석을 하지 않으므로, 공유 코드가 볼 표면을 이 선언 파일이 정의한다.
 *
 * 두 구현은 각각 독립적으로 타입체크된다. 이 파일과 어긋나면 공유 코드에서
 * 컴파일 오류로 드러난다.
 */
import type { InitialCameraView, LngLat, Logger, MapEnginePort, StoragePort } from '@modu-valley/core';
import type { MapStyleMode } from '@modu-valley/map-style';
import type { ComponentType } from 'react';

/** 플랫폼별 지도 표면 손잡이. 공유 코드는 내용을 들여다보지 않고 전달만 한다. */
export type MapHostHandle = {
  readonly kind: 'dom' | 'native';
};

export type MapHostProps = {
  readonly onHost: (host: MapHostHandle | null) => void;
};

/** 화면 전체를 덮는 지도 표면. 데모의 `<div id="map-root">` 위치. */
export declare const MapHost: ComponentType<MapHostProps>;

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

export declare function createMapEngine(options: CreateMapEngineOptions): MapEnginePort;

export declare function createStorage(): StoragePort;
