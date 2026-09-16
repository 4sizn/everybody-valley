import type { FeatureCollection, Polygon, Position } from 'geojson';
import { EMPTY_GEOJSON_SOURCE } from './featureProperties';
import type { FeatureLayerSet } from './layerSets';

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
          '#e46d30',
          'organization',
          '#b57b24',
          'public',
          '#5886b3',
          '#929292',
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
          '#b94e17',
          'organization',
          '#946317',
          'public',
          '#47739b',
          '#777777',
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
