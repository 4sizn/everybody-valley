/**
 * @modu-valley/map-style — 플랫폼 무관 MapLibre 스타일 명세.
 *
 * 스타일 JSON·레이어 명세·마커 GeoJSON 은 web(maplibre-gl)과
 * 네이티브(maplibre-native)가 **같은 값**을 읽는다. 어댑터 한쪽에 두고
 * 다른 쪽에 복사하면 파리티가 조용히 갈라지므로, 두 어댑터가 함께 의존하는
 * 이 패키지에 모았다.
 *
 * 이 패키지는 지도 SDK 를 import 하지 않는다 — 명세 타입(`@maplibre/
 * maplibre-gl-style-spec`)만 쓰고, 값은 순수 데이터다.
 */
export {
  applyMapPalette,
  type MapPaletteReport,
  PALETTE_RULE_NAMES,
  type PaletteMatch,
  type PaletteRuleName,
  paintMapPalette,
} from './applyMapPalette';
export {
  BASE_MAP_HOSTS,
  hostOfOrigin,
  normalizeOrigin,
  OPENFREEMAP_HOST,
  overrideBaseMapOrigin,
  overrideOpenFreeMapUrl,
  TERRAIN_DEM_HOST,
} from './baseMapHosts';
export {
  BUILDINGS_LAYER,
  BUILDINGS_LAYER_ID,
  decorateDay,
  decorateNight,
  decorateNightStyle,
  isStyleSpecification,
  LIGHT_BUILDINGS_LAYER,
  LIGHT_BUILDINGS_LAYER_ID,
  LOCALIZED_TEXT_FIELD,
  localizeLabels,
  MAP_STYLE_URL,
  MAP_STYLE_URLS,
  NIGHT_SKY,
  OPENMAPTILES_SOURCE,
  readsNameProperty,
} from './baseStyle';
export {
  type ComposedMapStyle,
  composeMapStyle,
  type MapStyleOptions,
  type WithTerrainOptions,
  withTerrain,
} from './composeMapStyle';
export {
  FACILITY_GLYPH_SELECTED_SIZE,
  FACILITY_GLYPH_SIZE,
  FACILITY_GLYPHS,
  FACILITY_ICON_ID_PREFIX,
  FACILITY_ICON_SELECTED_SUFFIX,
  FACILITY_ICON_SPECS,
  FACILITY_PIN_SELECTED_SIZE,
  FACILITY_PIN_SIZE,
  FACILITY_PIN_TIP_INSET,
  type FacilityIconSpec,
  facilityIconId,
  facilityIconSize,
  facilityIconSvgById,
  facilityPinSvg,
  type IconSize,
  MARKER_ICON_PIXEL_RATIO,
  parseFacilityIconId,
} from './facilityIcons';
export {
  FACILITY_ICON_IMAGE,
  FACILITY_ICON_OFFSET,
  FACILITY_INTERACTIVE_LAYER_IDS,
  FACILITY_LAYER_SET,
  FACILITY_PIN_LAYER,
  FACILITY_PIN_LAYER_ID,
  FACILITY_SOURCE_ID,
  type FacilityFeatureProperties,
  readFacilityFeatureId,
  toFacilityFeatureCollection,
} from './facilityLayers';
export {
  EMPTY_FEATURE_COLLECTION,
  EMPTY_GEOJSON_SOURCE,
  readStringProperty,
} from './featureProperties';
export {
  FLOW_BASE_LAYER,
  FLOW_BASE_LAYER_ID,
  FLOW_DASH_LAYER,
  FLOW_DASH_LAYER_ID,
  FLOW_DASH_SEQUENCE,
  FLOW_FRAME_MS,
  FLOW_LAYER_SET,
  FLOW_LINE_WIDTH,
  FLOW_SOURCE_ID,
  type FlowFeatureProperties,
  flowDashArray,
  flowStepAt,
  toFlowFeatureCollection,
} from './flowLayers';
export { LAND_OWNERSHIP_COLORS } from './landLayers';
export {
  type FeatureLayerSet,
  findLayerSetBySource,
  type InteractiveLayerSet,
  isInteractiveLayerSet,
  MAP_LAYER_SETS,
  type MapLayerKind,
  sameDependencies,
} from './layerSets';
export {
  ALERT_LEVEL_COLORS,
  CROWD_STATUS_COLORS,
  DARK_MAP_PALETTE,
  FACILITY_COLORS,
  FACILITY_PIN_STROKE_COLOR,
  LIGHT_MAP_PALETTE,
  MAP_PALETTES,
  MAP_STYLE_MODES,
  type MapPalette,
  type MapStyleMode,
  REPORT_TYPE_COLORS,
  SEGMENT_CASING_COLORS,
  SEGMENT_UNKNOWN_COLOR,
  SHADE_AMOUNT_COLORS,
  VALLEY_PARK_OPACITY,
  VALLEY_WATERWAY_WIDTH,
} from './palette';
export {
  PEAK_HEIGHT_OFFSET_M,
  PEAK_LABEL_LAYER_ID,
  PEAK_LAYER_SET,
  PEAK_MIN_ZOOM,
  PEAK_SOURCE_ID,
  PEAK_TEXT_FIELD,
  type PeakFeatureProperties,
  type PeakLabelOptions,
  peakLabelLayer,
  toPeakFeatureCollection,
  VALLEY_PEAK_LABEL_LAYER,
  VALLEY_PEAK_LABEL_LAYER_ID,
  VALLEY_PEAK_MIN_ZOOM,
} from './peakLayers';
export {
  findFirstSymbolLayerId,
  findFirstWaterwayLayerId,
  findPlacementLayerId,
  insertLayers,
  LAYER_PLACEMENTS,
  type LayerPlacement,
  type PlaceableLayer,
  type PlaceableStyle,
} from './placement';
export {
  readSegmentFeatureId,
  SEGMENT_CASING_LAYER,
  SEGMENT_CASING_LAYER_ID,
  SEGMENT_CASING_OPACITY,
  SEGMENT_CASING_WIDTH_STOPS,
  SEGMENT_INTERACTIVE_LAYER_IDS,
  SEGMENT_LAYER_SET,
  SEGMENT_LINE_COLOR,
  SEGMENT_LINE_LAYER,
  SEGMENT_LINE_LAYER_ID,
  SEGMENT_LINE_WIDTH_STOPS,
  SEGMENT_SOURCE_ID,
  type SegmentFeatureProperties,
  type SegmentWidthStop,
  segmentWidthExpression,
  toSegmentFeatureCollection,
} from './segmentLayers';
export {
  SHADE_CANOPY_LAYER,
  SHADE_CANOPY_LAYER_ID,
  SHADE_COLORS,
  SHADE_LAYER_KINDS,
  SHADE_LAYER_SET,
  SHADE_SHADOW_LAYER,
  SHADE_SHADOW_LAYER_ID,
  SHADE_SOURCE_ID,
  type ShadeFeatureProperties,
  type ShadeLayerKind,
  toShadeFeatureCollection,
} from './shadeLayers';
export {
  EMPTY_SPOT_SOURCE,
  readSpotFeatureId,
  SPOT_DOT_LAYER,
  SPOT_DOT_LAYER_ID,
  SPOT_GLOW_LAYER,
  SPOT_GLOW_LAYER_ID,
  SPOT_INTERACTIVE_LAYER_IDS,
  SPOT_LABEL_LAYER,
  SPOT_LABEL_LAYER_ID,
  SPOT_LAYER_SET,
  SPOT_SOURCE_ID,
  type SpotFeatureProperties,
  toSpotFeatureCollection,
} from './spotLayers';
export {
  COLOR_RELIEF_LAYER,
  COLOR_RELIEF_LAYER_ID,
  COLOR_RELIEF_OPACITY,
  COLOR_RELIEF_STOPS,
  HILLSHADE_ILLUMINATION_DIRECTION,
  HILLSHADE_LAYER_ID,
  HILLSHADE_METHOD,
  HILLSHADE_PAINT,
  type HillshadePaint,
  hillshadeLayer,
  TERRAIN_DEM_SOURCE,
  TERRAIN_DEM_SOURCE_ID,
  TERRAIN_EXAGGERATION,
  TERRAIN_PLACEMENT,
  terrainLayers,
} from './terrainLayers';
export {
  EMPTY_PAINT_OVERRIDES,
  isShadeVisible,
  mergePaintOverrides,
  type PaintOverrides,
  SHADE_ON_CANOPY_OPACITY,
  SHADE_ON_HILLSHADE_EXAGGERATION,
  type ValleyPaintState,
  valleyPaintOverrides,
} from './valleyPaint';
export {
  toWaterFeatureCollection,
  WATER_COLORS,
  WATER_EDGE_LAYER,
  WATER_EDGE_LAYER_ID,
  WATER_FILL_LAYER,
  WATER_FILL_LAYER_ID,
  WATER_LAYER_SET,
  WATER_SOURCE_ID,
  type WaterFeatureProperties,
} from './waterLayers';
