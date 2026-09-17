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

/** 홈 아래 "계곡 이야기" 목록의 주소. 탭이 아니라 홈에서 들어가는 화면이라 주소만 남긴다. */
export const STORIES_SEARCH = '?page=stories';

/** 지금 주소가 그 목록인가. 계곡이 함께 있으면 지도가 먼저다(`parseJourneyLink`). */
export function isStoriesUrl(search: string): boolean {
  return new URLSearchParams(search).get('page') === 'stories';
}
