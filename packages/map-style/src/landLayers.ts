import type { FeatureCollection, Polygon, Position } from 'geojson';
import { EMPTY_GEOJSON_SOURCE } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';

/** 지도와 소유구분 범례가 함께 쓰는 색상. */
export const LAND_OWNERSHIP_COLORS = {
  individual: { fill: '#e46d30', stroke: '#b94e17' },
  organization: { fill: '#b57b24', stroke: '#946317' },
  public: { fill: '#5886b3', stroke: '#47739b' },
  unknown: { fill: '#929292', stroke: '#777777' },
} as const;

export const LAND_LAYER_SET: FeatureLayerSet = {
  kind: 'land',
  sourceId: 'valley-land',
  emptySource: EMPTY_GEOJSON_SOURCE,
  layers: [
    {
      id: 'valley-land-fill',
      type: 'fill',
      source: 'valley-land',
      paint: {
        'fill-color': [
          'match',
          ['get', 'ownership'],
          'individual',
          LAND_OWNERSHIP_COLORS.individual.fill,
          'organization',
          LAND_OWNERSHIP_COLORS.organization.fill,
          'public',
          LAND_OWNERSHIP_COLORS.public.fill,
          LAND_OWNERSHIP_COLORS.unknown.fill,
        ],
        'fill-opacity': 0.18,
      },
    },
    {
      id: 'valley-land-outline',
      type: 'line',
      source: 'valley-land',
      paint: {
        'line-color': [
          'match',
          ['get', 'ownership'],
          'individual',
          LAND_OWNERSHIP_COLORS.individual.stroke,
          'organization',
          LAND_OWNERSHIP_COLORS.organization.stroke,
          'public',
          LAND_OWNERSHIP_COLORS.public.stroke,
          LAND_OWNERSHIP_COLORS.unknown.stroke,
        ],
        'line-width': 1.2,
        'line-dasharray': [3, 2],
      },
    },
  ],
  interactiveLayerIds: [],
  readFeatureId: () => undefined,
  placement: 'below-labels',
  dependencies: (content) => [content.landParcels],
  toFeatureCollection: (content): FeatureCollection<Polygon> => ({
    type: 'FeatureCollection',
    features: (content.landParcels ?? []).map((parcel) => ({
      type: 'Feature',
      properties: { ownership: parcel.ownership },
      geometry: { type: 'Polygon', coordinates: parcel.coordinates as unknown as Position[][] },
    })),
  }),
};
