/**
 * 지도 엔진 포트.
 *
 * 애플리케이션 계층은 이 추상만 안다. maplibre-gl 의 `Map`, GeoJSON 소스,
 * 레이어 id, `MercatorCoordinate` 같은 것은 어댑터 안에 갇혀 있다.
 *
 * 규약
 *  · 모든 실패는 `Result` 로 나온다. 지도 SDK 는 예외를 던지지만 어댑터가
 *    경계에서 흡수한다.
 *  · 카메라 이동은 취소 가능하다. 새 이동이 오면 이전 이동은 취소된다.
 *  · `dispose()` 는 레이어·소스·이벤트·GL 자원을 전부 되돌린다.
 *  · 제스처 정책은 **엔진이 정하지 않는다.** 애플리케이션 계층이
 *    `setGestures` 로 내려보내고 어댑터는 번역만 한다 — 두 SDK 의 기본값에
 *    맡기면 플랫폼마다 켜진 제스처가 갈린다(`MapGestures` 주석 참고).
 */

import type { BaseMapHealth } from '../../domain/basemap/BaseMapHealth';
import type { CameraCommand, CameraPose } from '../../domain/camera/CameraPose';
import type { MapGestures } from '../../domain/camera/MapGestures';
import type { ProjectionMode } from '../../domain/camera/ProjectionMode';
import type { CancellationToken } from '../../shared/async/cancellation';
import type { AsyncInitializable, LifecycleState } from '../../shared/async/lifecycle';
import type { AppError } from '../../shared/errors';
import type { EmitterView } from '../../shared/events/Emitter';
import type { Result, VoidResult } from '../../shared/result';
import type { MapCapabilities } from './MapCapabilities';
import type { MapContent, MapFeatureRef, MapSelection } from './MapContent';

export type MapEngineEvents = {
  /** 카메라가 움직였다. 나침반 바늘 회전에 쓴다. */
  'camera-change': CameraPose;
  /** 지도 위 피처(명당·구간·시설)를 눌렀다. 종류는 참조에 실려 온다. */
  'feature-press': MapFeatureRef;
  /** 지도 빈 곳을 눌렀다 — 상세를 닫는 신호. */
  'background-press': undefined;
  /** 스타일·레이어 준비가 끝났다. */
  ready: undefined;
  /**
   * 렌더 루프에서 삼켜진 비치명적 오류. 데모 주석의
   * `_updateRetainedTiles` 경합처럼 상태에는 영향이 없지만 기록은 남긴다.
   */
  'recoverable-error': AppError;
  /**
   * 베이스맵(스타일·타일·DEM 호스트) 헬스가 바뀌었다(C7). 어댑터가 SDK 의 오류·타일 이벤트를
   * `BaseMapHealthMonitor` 에 넣어 돌리고 상태가 바뀔 때마다 올린다 — 첫 실패에서 arm,
   * 8초 동안 성공이 없으면 `outage`, 타일 하나라도 오면 처음으로. 세션이 `AppState.baseMapHealth`
   * 로 올리고 배너는 `outage` 만 본다.
   */
  'basemap-health': BaseMapHealth;
};

export abstract class MapEnginePort implements AsyncInitializable {
  abstract readonly capabilities: MapCapabilities;
  abstract readonly state: LifecycleState;
  abstract readonly events: EmitterView<MapEngineEvents>;

  /** 지도 생성 → 스타일 로드 → 레이어 구성까지. 취소되면 자원을 되돌린다. */
  abstract initialize(token: CancellationToken): Promise<VoidResult>;

  /** 카메라 이동. 애니메이션이 끝나거나 취소될 때까지 대기한다. */
  abstract moveCamera(command: CameraCommand, token: CancellationToken): Promise<VoidResult>;

  /** 진행 중인 카메라 애니메이션을 즉시 멈춘다. */
  abstract stopCamera(): void;

  abstract getCamera(): Result<CameraPose>;

  abstract setProjection(mode: ProjectionMode): VoidResult;

  /**
   * 조작 제스처를 정책대로 맞춘다. 어느 SDK 기본값도 신뢰하지 않고
   * 켤 것과 끌 것을 모두 명시적으로 적용한다.
   */
  abstract setGestures(gestures: MapGestures): VoidResult;

  /**
   * 그릴 내용을 통째로 반영한다. 어댑터는 소스별로 이전 값과 참조 비교해
   * 바뀐 것만 다시 쓴다 — 호출부는 매번 전체를 넘겨도 된다.
   */
  abstract renderContent(content: MapContent): VoidResult;

  /**
   * 선택을 반영한다. `null` 이면 해제. 점 피처(명당·시설)는 핀을 세우고,
   * 선 피처(구간)는 강조만 한다 — 그 구분은 어댑터의 것이다.
   */
  abstract setSelection(selection: MapSelection | null): VoidResult;

  /** 불꽃 발사 on/off. 이미 떠 있는 불꽃은 남는다. */
  abstract setFireworksEnabled(enabled: boolean): VoidResult;

  /**
   * 물줄기 흐름 애니메이션 on/off (C10c). 어댑터가 `line-dasharray` 시퀀스를 프레임마다
   * 갈아 끼운다(web rAF / 네이티브 타이머). 언제 켤지는 `WaterFlowCoordinator` 가 정한다 —
   * 시트가 접히거나 앱이 배경이면 끈다. 같은 값을 다시 받으면 아무 일도 하지 않아야 한다.
   */
  abstract setWaterFlowEnabled(enabled: boolean): VoidResult;

  /**
   * 베이스맵 재시도(C7). 지도를 다시 만들지 않고 **베이스맵 소스만** 다시 불러온다 — web 은
   * 벡터·raster-dem 소스의 `setTiles`/`setUrl` 재설정, 네이티브는 스타일 참조 교체. GeoJSON
   * 소스는 건드리지 않는다. 헬스는 처음으로 돌아가 `'basemap-health'` 가 한 번 더 발화한다.
   * 스타일 자체가 실패해 초기화가 `failed` 로 끝난 경우는 이 메서드가 아니라 세션 재생성이다.
   */
  abstract retryBaseMap(): VoidResult;

  abstract dispose(): void;
}
