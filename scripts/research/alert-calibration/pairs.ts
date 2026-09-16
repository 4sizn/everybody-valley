import type { RainGauge, WaterGauge } from './sources.ts';

/** 사례 쌍(docs/TODO.md F3a). 거리·표고차는 R1 results.md 에서 옮겨 적었다. */
export interface CasePair {
  id: string;
  valley: string;
  role: string;
  /** 첫 번째가 주 신호(S1 또는 대리 신호) */
  rain: RainGauge[];
  water: WaterGauge;
}

export const PAIRS: CasePair[] = [
  {
    id: 'soyosan',
    valley: '소요산계곡',
    role: 'S1 + S4 둘 다 있는 최적 쌍',
    rain: [
      { kind: 'rain-kma', code: '454', name: 'AWS 하봉암', note: '2.9 km · +24 m · 같은 표준유역' },
      { kind: 'rain-hrfco', code: '10224050', name: '양주시(봉암초교)', note: '6.3 km · +49 m · 같은 표준유역' },
    ],
    water: { code: '1022670', name: '연천군(신천교)', note: '5.1 km 하류 · 4단계 3.5/4.8/5.5/6.7 m' },
  },
  {
    id: 'gwangdeok',
    valley: '광덕계곡',
    role: '고지 우량계(1,050 m) vs 하류 수위',
    rain: [{ kind: 'rain-kma', code: '695', name: 'AWS 광덕산', note: '2.7 km · +472 m · 같은 표준유역' }],
    water: { code: '1010686', name: '화천군(일광교)', note: '8 km 하류 · 4단계 2.5/3.6/4.7/5.9 m' },
  },
  {
    id: 'gyeongban',
    valley: '경반계곡',
    role: '상류 우량계 없음 — 인접 저지 우량계가 대리 신호가 되는가(S2 상한 근거)',
    rain: [
      { kind: 'rain-hrfco', code: '10134030', name: '가평군(화악교)', note: '10 km · +1 m · 가평천 본류 상류(다른 지류)' },
      { kind: 'rain-kma', code: '455', name: 'AWS 경기가평', note: '읍내 저지 · 가평교 옆' },
      { kind: 'rain-kma', code: '531', name: 'AWS 가평북면', note: '추가 · 북면 소법리(화악교 인근) 110 m' },
    ],
    water: { code: '1013655', name: '가평군(가평교)', note: '4.3 km 하류 · 4단계 2.8/4.0/5.0/6.2 m' },
  },
];

/** 하류 수위 관측소가 없어 강우 이벤트 통계에만 쓰는 우량계(유명산·어비). */
export const RAIN_ONLY: RainGauge[] = [
  { kind: 'rain-hrfco', code: '10154030', name: '가평군(중미산)', note: '유명산 2 km(+112 m) · 어비 1.8 km(+250 m)' },
];
