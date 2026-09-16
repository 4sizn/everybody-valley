import { describe, expect, it } from 'vitest';
import { ownershipOf, parseLandParcels } from '../src/application/ports/LandOwnership';

const coordinates = [
  [
    [127, 37],
    [127.01, 37],
    [127, 37.01],
    [127, 37],
  ],
];
describe('토지소유 경계', () => {
  it('개인·단체·국공유를 구분하고 불명 코드를 사유지로 단정하지 않는다', () => {
    expect(ownershipOf('01')).toBe('individual');
    expect(ownershipOf('06')).toBe('organization');
    expect(ownershipOf('02')).toBe('public');
    expect(ownershipOf('03')).toBe('unknown');
    expect(ownershipOf(null)).toBe('unknown');
  });
  it('필지 기하를 검증하며 소유자 속성은 결과에서 제거한다', () => {
    const features = [
      {
        geometry: { type: 'Polygon', coordinates },
        properties: { posesn_se_code: '01', owner: 'omit' },
      },
    ];
    expect(parseLandParcels({ features })).toEqual([{ ownership: 'individual', coordinates }]);
    expect(() =>
      parseLandParcels({
        features: [{ ...features[0], geometry: { type: 'Polygon', coordinates: [[[999, 37]]] } }],
      }),
    ).toThrow();
    expect(() => parseLandParcels({ error: 'upstream error' })).toThrow();
  });
});
