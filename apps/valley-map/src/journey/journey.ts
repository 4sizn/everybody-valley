import type { Facility, Segment, SheetSnap, Valley } from '@modu-valley/core';

export type Place = { valley: Valley; segment: Segment; facility?: Facility };
export type JourneyLink = { place: Place | null; sheet: SheetSnap; hour: number };

export function parseJourneyLink(search: string, valleys: readonly Valley[]): JourneyLink {
  const params = new URLSearchParams(search);
  const valley = valleys.find((v) => v.id === params.get('valley'));
  const segment =
    valley?.segments.find((s) => s.id === params.get('segment')) ?? valley?.segments[0];
  const facility = valley?.facilities.find((f) => f.id === params.get('facility'));
  const rawHour = Number(params.get('hour') ?? 14);
  const snap = params.get('sheet');
  return {
    place: valley && segment ? { valley, segment, ...(facility ? { facility } : {}) } : null,
    sheet: snap === 'half' || snap === 'full' ? snap : 'peek',
    hour: Number.isInteger(rawHour) && rawHour >= 10 && rawHour <= 18 ? rawHour : 14,
  };
}

export function journeySearch(place: Place | null, sheet: SheetSnap, hour: number): string {
  if (!place) return '';
  const params = new URLSearchParams({
    valley: place.valley.id,
    segment: place.segment.id,
    sheet,
    hour: String(hour),
  });
  if (place.facility) params.set('facility', place.facility.id);
  return `?${params}`;
}

export function placeForValley(valley: Valley, segment = valley.segments[0]): Place | null {
  return segment ? { valley, segment } : null;
}
