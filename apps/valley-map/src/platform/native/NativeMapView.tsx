/**
 * 네이티브 지도 뷰 — `MapSurface` 스냅샷을 그리는 유일한 곳.
 *
 * `@maplibre/maplibre-react-native` 는 지도·소스·레이어·마커를 **React
 * 엘리먼트**로 만든다. 그래서 web 처럼 어댑터가 지도 객체를 소유할 수 없고,
 * 렌더링이 표현 계층으로 온다. 대신 이 파일이 어댑터가 게시한 스냅샷만
 * 읽고, 지도가 알려 온 것만 되돌려 준다 — 도메인·유즈케이스·상태는 이 파일을
 * 모른다.
 *
 * 피처 레이어는 `MAP_LAYER_SETS` 를 순회해 그린다 — web 어댑터와 **같은
 * 목록**이므로 소스 id·레이어 명세가 갈라질 수 없고, 종류가 늘어도 이 파일은
 * 바뀌지 않는다. `<Layer>` 는 `LayerSpecification` 전체를 받으므로 `line`
 * 명세(구간)도 `fill` 명세(그늘)도 그대로 들어간다. 히트 대상이 아닌 셋
 * (`isInteractiveLayerSet` 거짓)에는 `onPress` 를 달지 않고 — 래퍼의 `onPress` 는
 * 소스의 모든 피처에 발화한다 — `placement` 는 엔진이 스냅샷에 실어 준 배치별
 * 기준 레이어 id(`placementLayerIds`)를 `beforeId` 로 옮긴다. 지형(음영기복·고도색)은
 * 스타일 JSON 안에 이미 들어 있어 이 파일이 그릴 것이 없다(C10a). 시설 핀 아이콘은 빌드 때
 * 구운 PNG 를 `<Images>` 로 같은 ID 에 등록한다(C5, `facilityIconImages.ts`) — web 이 런타임에
 * SVG 로 푸는 자리다.
 *
 * 되돌려 주는 것
 *   onDidFinishLoadingStyle → reportStyleLoaded  (엔진의 ready 신호)
 *   onDidFailLoadingMap     → reportStyleFailed (초기화 중 스타일 실패 · ready 뒤 헬스 실패, C7)
 *   onDidFinishRenderingMapFully → reportRendered (헬스 성공 신호, C7)
 *   onRegionIsChanging      → reportViewState    (나침반 바늘·카메라 스냅샷)
 *   onRegionDidChange       → reportSettled      (web 의 moveend 자리)
 *   GeoJSONSource.onPress   → reportFeaturePress (소스 id + 속성에서 읽은 id)
 *   Map.onPress             → reportBackgroundPress
 *
 * 지도 SDK 타입이 이 파일 밖으로 새지 않는다. `MapSurface` 의 좁은 타입
 * (`NativeCameraStop`, `NativeViewState`)으로만 오간다.
 */
import {
  Camera,
  type CameraRef,
  type CameraStop,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapLibreMap,
  Marker,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type {
  MapCameraDriver,
  MapScene,
  MapSurface,
  NativeCameraStop,
  NativeViewState,
} from '@modu-valley/adapter-native';
import {
  EMPTY_FEATURE_COLLECTION,
  type FeatureLayerSet,
  isInteractiveLayerSet,
  MAP_LAYER_SETS,
} from '@modu-valley/map-style';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { ABSOLUTE_FILL } from '@/theme/layout';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FACILITY_ICON_IMAGES } from './facilityIconImages';
import { nearestFeatureByLngLat } from './nearestFeature';
import { SelectionPin } from './SelectionPin';

export type NativeMapViewProps = {
  readonly surface: MapSurface;
};

export function NativeMapView({ surface }: NativeMapViewProps) {
  const scene = useSyncExternalStore(surface.scene.subscribeRaw, surface.scene.getSnapshot);
  const cameraRef = useRef<CameraRef | null>(null);
  const themed = useThemedStyles();

  /* 카메라 손잡이를 어댑터에 빌려준다. `setStop` 은 네이티브 뷰가 아직 없으면
     던지므로(래퍼 구현), 그 사실을 boolean 으로 바꿔 올린다 — 어댑터는
     "못 움직였다"를 `Result` 로 만든다. */
  const driver = useMemo<MapCameraDriver>(
    () => ({
      setStop: (stop: NativeCameraStop) => {
        const camera = cameraRef.current;
        if (camera === null) return false;
        void camera.setStop(toCameraStop(stop)).catch(() => {
          // 명령 전달 실패는 카메라 큐가 타임아웃으로 정착시킨다.
        });
        return true;
      },
    }),
    [],
  );

  useEffect(() => {
    surface.attachCamera(driver);
    return () => surface.attachCamera(null);
  }, [surface, driver]);

  const onRegionIsChanging = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      surface.reportViewState(toViewState(event.nativeEvent));
    },
    [surface],
  );

  const onRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      surface.reportSettled(toViewState(event.nativeEvent));
    },
    [surface],
  );

  const onBackgroundPress = useCallback(() => surface.reportBackgroundPress(), [surface]);
  const onStyleLoaded = useCallback(() => surface.reportStyleLoaded(), [surface]);
  const onStyleFailed = useCallback(() => surface.reportStyleFailed(), [surface]);
  const onRendered = useCallback(() => surface.reportRendered(), [surface]);

  // 스타일을 받아 오는 동안에는 지도를 띄우지 않는다 — 기본 스타일의 밝은
  // 지도가 잠깐 스쳤다가 어두운 스타일로 바뀌는 깜빡임을 막는다.
  if (scene.style === null) return <View style={[styles.placeholder, themed.placeholder]} />;

  return (
    <MapLibreMap
      style={styles.map}
      mapStyle={scene.style}
      /* SDK 어트리뷰션 버튼은 남긴다 — web 도 maplibre-gl 의 compact
         어트리뷰션을 띄우고, 타일 출처 표기는 라이선스 요구사항이다.
         위치는 web 의 `.maplibregl-ctrl-bottom-right{margin-bottom:74px}` 와
         같게 하단 내비를 피한다. */
      attribution
      attributionPosition={ATTRIBUTION_POSITION}
      /* 나머지 장식은 끈다. 나침반은 `MapControls` 가 화면에 직접 그리고
         (데모는 자체 나침반과 SDK 나침반을 둘 다 띄우는데, 좁은 화면에서
         겹쳐 보일 뿐이다), 로고·스케일바는 데모에 없다. */
      logo={false}
      compass={false}
      scaleBar={false}
      /* 조작 제스처는 코어의 정책(`DEFAULT_MAP_GESTURES`)에서 온다.
         SDK 기본값에 맡기지 않는 이유는 `MapGestures` 주석에 있다 —
         두 엔진의 기본값이 달라 web 과 핀치 동작이 어긋났다. */
      dragPan={scene.gestures.pan}
      touchZoom={scene.gestures.pinchZoom}
      touchRotate={scene.gestures.pinchRotate}
      doubleTapZoom={scene.gestures.doubleTapZoom}
      doubleTapHoldZoom={scene.gestures.quickZoom}
      touchPitch={scene.gestures.dragPitch}
      onDidFinishLoadingStyle={onStyleLoaded}
      onDidFailLoadingMap={onStyleFailed}
      onDidFinishRenderingMapFully={onRendered}
      onRegionIsChanging={onRegionIsChanging}
      onRegionDidChange={onRegionDidChange}
      onPress={onBackgroundPress}
    >
      <Camera ref={cameraRef} initialViewState={toInitialViewState(scene.initialView)} />

      {/* 시설 핀 아이콘(C5) — 심볼 레이어가 부르는 ID 와 같은 키. 레이어보다 먼저 있어야 첫 프레임에 뜬다. */}
      <Images images={FACILITY_ICON_IMAGES} />

      {MAP_LAYER_SETS.map((set) => (
        <FeatureSource
          key={set.sourceId}
          set={set}
          data={scene.sources[set.sourceId] ?? EMPTY_FEATURE_COLLECTION}
          placementLayerIds={scene.placementLayerIds}
          paintOverrides={scene.layerPaintOverrides}
          surface={surface}
        />
      ))}

      <SelectedPinMarker pin={scene.selectedPin} />
    </MapLibreMap>
  );
}

type FeatureSourceProps = {
  readonly set: FeatureLayerSet;
  readonly data: MapScene['sources'][string];
  readonly placementLayerIds: MapScene['placementLayerIds'];
  readonly paintOverrides: MapScene['layerPaintOverrides'];
  readonly surface: MapSurface;
};

/**
 * 레이어 셋 하나 = GeoJSON 소스 하나 + 그 위의 레이어들. web 의
 * `FeatureLayerController` 와 같은 단위다. 어떤 속성에서 id 를 읽는지는 셋이
 * 알고, 종류로 바꾸는 일은 어댑터가 한다 — 이 컴포넌트는 소스 id 만 올린다.
 */
function FeatureSource({
  set,
  data,
  placementLayerIds,
  paintOverrides,
  surface,
}: FeatureSourceProps) {
  const onPress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      // 빈 곳 press 핸들러가 이어서 상세를 닫지 않도록 멈춘다(web 의
      // `event.preventDefault()` 자리).
      event.stopPropagation();
      // X2 — 시설이 몰린 곳은 한 탭에 점 여럿이 잡힌다. `[0]` 은 화면 근접도가
      // 아니라 내부 순서라 엉뚱한 시설이 뽑혔다 — `nearestFeatureByLngLat` 로 고친다.
      const feature = nearestFeatureByLngLat(event.nativeEvent.lngLat, event.nativeEvent.features);
      const featureId = set.readFeatureId(feature?.properties);
      if (featureId === undefined) return;
      surface.reportFeaturePress(set.sourceId, featureId);
    },
    [set, surface],
  );

  // 히트 대상이 아닌 셋(그늘)은 press 를 받지 않는다 — 아래 구간 선의 탭을 가로채지 않게.
  const pressProps = isInteractiveLayerSet(set) ? { onPress } : {};
  // 배치. 기준 레이어를 아직 모르면(스타일 전·기준 없음) 맨 위 — web 과 같은 규칙.
  const beforeId = set.placement === undefined ? null : placementLayerIds[set.placement];
  const placementProps = beforeId === null ? {} : { beforeId };

  return (
    <GeoJSONSource id={set.sourceId} data={data} {...pressProps}>
      {set.layers.map((layer) => (
        <Layer key={layer.id} {...withPaintOverride(layer, paintOverrides)} {...placementProps} />
      ))}
    </GeoJSONSource>
  );
}

/**
 * 프레임마다 바뀌는 paint(물줄기 흐름 점선, C10c)를 명세 위에 얹는다. 덧쓸 것이 없으면
 * 같은 객체를 돌려줘 `<Layer>` 가 다시 그리지 않는다.
 */
function withPaintOverride(
  layer: FeatureLayerSet['layers'][number],
  overrides: MapScene['layerPaintOverrides'],
): FeatureLayerSet['layers'][number] {
  const override = overrides[layer.id];
  if (override === undefined) return layer;
  const paint = 'paint' in layer && layer.paint !== undefined ? layer.paint : {};
  return { ...layer, paint: { ...paint, ...override } } as FeatureLayerSet['layers'][number];
}

/** 선택 핀(명당만 — 시설은 자기 핀이 커진다, C5). `key` 를 피처 id 로 두어 선택이 바뀌면 낙하가 다시 재생된다. */
function SelectedPinMarker({ pin }: { readonly pin: MapScene['selectedPin'] }) {
  if (pin === null) return null;
  return (
    <Marker key={pin.id} id={pin.id} lngLat={[pin.center[0], pin.center[1]]} anchor="bottom">
      <SelectionPin color={pin.color} />
    </Marker>
  );
}

/**
 * 어댑터의 좁은 stop → SDK 의 `CameraStop`.
 *
 * `CameraStop` 은 center 유무로 갈리는 유니온이라(`center?: never` 분기가
 * 있다) 한쪽으로 좁혀서 넘겨야 한다. 읽기 전용 튜플도 여기서 사본으로 푼다.
 */
function toCameraStop(stop: NativeCameraStop): CameraStop {
  const { center, padding, ...rest } = stop;
  const base = padding === undefined ? rest : { ...rest, padding: { ...padding } };
  return center === undefined ? base : { ...base, center: [center[0], center[1]] };
}

function toInitialViewState(stop: NativeCameraStop): {
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
} {
  const view: { center?: [number, number]; zoom?: number; pitch?: number; bearing?: number } = {};
  if (stop.center !== undefined) view.center = [stop.center[0], stop.center[1]];
  if (stop.zoom !== undefined) view.zoom = stop.zoom;
  if (stop.pitch !== undefined) view.pitch = stop.pitch;
  if (stop.bearing !== undefined) view.bearing = stop.bearing;
  return view;
}

function toViewState(event: ViewStateChangeEvent): NativeViewState {
  return {
    center: [event.center[0], event.center[1]],
    zoom: event.zoom,
    pitch: event.pitch,
    bearing: event.bearing,
  };
}

/** web 의 어트리뷰션 위치와 같은 자리 — 하단 플로팅 내비 위. */
const ATTRIBUTION_POSITION = { bottom: 74, right: 8 } as const;

const styles = StyleSheet.create({
  map: ABSOLUTE_FILL,
  placeholder: ABSOLUTE_FILL,
});

const useThemedStyles = createThemedStyles((theme) => ({
  placeholder: { backgroundColor: theme.colors.bg },
}));
