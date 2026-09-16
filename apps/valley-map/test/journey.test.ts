import {
  Facility,
  LngLat,
  Segment,
  toFacilityId,
  toSegmentId,
  toValleyId,
  Valley,
} from '@modu-valley/core';
import { describe, expect, it } from 'vitest';
import { journeySearch, parseJourneyLink } from '../src/journey/journey';

const id = toValleyId('test-valley');
const segment = new Segment({
  id: toSegmentId('test-segment'),
  valleyId: id,
  valleyName: '검증 계곡',
  position: 'whole',
  order: 0,
  path: [LngLat.of(127, 37), LngLat.of(127.001, 37.001)],
});
const facility = new Facility({
  id: toFacilityId('test-parking'),
  valleyId: id,
  name: '검증 주차장',
  facilityType: 'parking',
  position: LngLat.of(127, 37),
});
const result = Valley.create({
  id,
  name: '검증 계곡',
  segments: [segment],
  facilities: [facility],
});
if (!result.ok) throw result.error;
const valley = result.value;
describe('journey deep links', () => {
  it('restores a facility, its parent valley, sheet and shade hour together', () => {
    const url = journeySearch({ valley, segment, facility }, 'half', 17);
    const restored = parseJourneyLink(url, [valley]);
    expect(restored.place?.facility?.id).toBe(facility.id);
    expect(restored.place?.valley.id).toBe(valley.id);
    expect(restored.sheet).toBe('half');
    expect(restored.hour).toBe(17);
  });
  it('rejects unknown valleys and foreign facility ids and clamps invalid controls', () => {
    expect(parseJourneyLink('?valley=missing', [valley]).place).toBeNull();
    const state = parseJourneyLink(
      '?valley=test-valley&facility=foreign&segment=missing&hour=NaN&sheet=giant',
      [valley],
    );
    expect(state.place?.segment.id).toBe(segment.id);
    expect(state.place?.facility).toBeUndefined();
    expect(state.sheet).toBe('peek');
    expect(state.hour).toBe(14);
  });
  it('only serializes public catalog state, discarding GPS and drafts', () => {
    const restored = parseJourneyLink(
      '?valley=test-valley&lat=37&lng=127&password=private&draft=secret',
      [valley],
    );
    const url = journeySearch(restored.place, restored.sheet, restored.hour);
    expect(url).not.toMatch(/lat|lng|password|draft|secret|private/);
    expect(journeySearch(null, 'full', 14)).toBe('');
  });
});
