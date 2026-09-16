/**
 * 계곡별 경보 신호 관측소 로스터 — R1 실측(`scripts/research/station-coverage/results.json`, 2026-09-04)에서
 * 유도한 정적 데이터. 같은 표준유역(sbsncd) ∧ 같은 중권역(mbsncd) ∧ 표고차 ≥ 50 m ∧ ≤ 5 km 를 S1,
 * 같은 중권역 ∧ 표고 ≥ 계곡 ∧ ≤ 10 km(S1 제외)를 S2, 15 km 안 수위 관측소를 S4 로 묶었다
 * (`docs/F3_ALERT_DESIGN.md` §2). 계곡 표고·유역 폴리곤을 실시간으로 못 구하므로(R2 는 조회만) 서버가
 * 매 틱 재계산하지 않고 이 표를 쓴다 — R1 재실행 전까지 고정. 능선 너머 인접 우량계(예: 백운 ← 광덕산,
 * 다른 중권역)는 이 표에 없다(같은 중권역 조건 때문) — 후속 제안.
 */
import type { StationKind } from './records';

export interface AlertSourceStation {
  readonly kind: StationKind;
  readonly code: string;
  readonly name: string;
}

export interface AlertSourceRoster {
  readonly valleyId: string;
  readonly sbsncd: string | null;
  /** S1 — 유역 안 고지 우량계(관측 확신). */
  readonly s1: readonly AlertSourceStation[];
  /** S2 — 인접 산지 우량계(추정 확신, 관심 상한). */
  readonly s2: readonly AlertSourceStation[];
  /** S4 — 하류 수위 관측소(승격·해제·사후검증). */
  readonly waterlevel: readonly AlertSourceStation[];
}

export const ALERT_SOURCES: readonly AlertSourceRoster[] = [
  { valleyId: 'baegun-pocheon', sbsncd: '102206', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'cheonghakdong', sbsncd: '102207', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'bisun-sanjeong', sbsncd: '102204', s1: [], s2: [], waterlevel: [] },
  {
    valleyId: 'jijangsan',
    sbsncd: '102205',
    s1: [],
    s2: [
      { kind: 'aws', code: '874', name: '동송' },
      { kind: 'aws', code: '474', name: '영북' },
      { kind: 'aws', code: '475', name: '관인' },
    ],
    waterlevel: [],
  },
  { valleyId: 'wangbang', sbsncd: '102213', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'myeongji', sbsncd: '101305', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'yongchu-gapyeong', sbsncd: '101306', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'jomurak', sbsncd: '101305', s1: [], s2: [], waterlevel: [] },
  {
    valleyId: 'yumyeongsan',
    sbsncd: '101507',
    s1: [{ kind: 'hrfco-rainfall', code: '10154030', name: '가평군(중미산)' }],
    s2: [],
    waterlevel: [],
  },
  {
    valleyId: 'eobi',
    sbsncd: '101507',
    s1: [{ kind: 'hrfco-rainfall', code: '10154030', name: '가평군(중미산)' }],
    s2: [],
    waterlevel: [],
  },
  { valleyId: 'baekdunri', sbsncd: '101305', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'gyeongban', sbsncd: '101306', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'nonnamgi', sbsncd: '101305', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'hyeondeungsa', sbsncd: '101503', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'domachi', sbsncd: '101305', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'sudong', sbsncd: '101505', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'chungnyeongsan', sbsncd: '101505', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'jangheung', sbsncd: '101904', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'songchu', sbsncd: '101904', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'angol', sbsncd: '101808', s1: [], s2: [], waterlevel: [] },
  {
    valleyId: 'soyosan',
    sbsncd: '102213',
    s1: [],
    s2: [
      { kind: 'aws', code: '454', name: '하봉암' },
      { kind: 'aws', code: '477', name: '상패' },
      { kind: 'aws', code: '98', name: '동두천' },
      { kind: 'hrfco-rainfall', code: '10224050', name: '양주시(봉암초교)' },
      { kind: 'hrfco-rainfall', code: '10224060', name: '포천시(포천삼정초교)' },
      { kind: 'aws', code: '372', name: '은현면' },
      { kind: 'aws', code: '351', name: '남면' },
      { kind: 'aws', code: '343', name: '연천백의' },
    ],
    waterlevel: [
      { kind: 'hrfco-waterlevel', code: '1022668', name: '동두천시(송천교)' },
      { kind: 'hrfco-waterlevel', code: '1022666', name: '연천군(고탄교)' },
      { kind: 'hrfco-waterlevel', code: '1022660', name: '양주시(발운2교)' },
      { kind: 'hrfco-waterlevel', code: '1022659', name: '백의교' },
      { kind: 'hrfco-waterlevel', code: '1022645', name: '연천군(한여울교)' },
      { kind: 'hrfco-waterlevel', code: '1022647', name: '포천시(포천대교)' },
      { kind: 'hrfco-waterlevel', code: '1022644', name: '연천군(한탄강댐)' },
    ],
  },
  {
    valleyId: 'dongmak',
    sbsncd: '102214',
    s1: [],
    s2: [{ kind: 'hrfco-rainfall', code: '10204010', name: '연천군(고문분교)' }],
    waterlevel: [{ kind: 'hrfco-waterlevel', code: '1022640', name: '포천시(용담교)' }],
  },
  { valleyId: 'gamaksan', sbsncd: '102303', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'sanasa', sbsncd: '101507', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'yongmunsan', sbsncd: '100717', s1: [], s2: [], waterlevel: [] },
  { valleyId: 'uidong', sbsncd: '101810', s1: [], s2: [], waterlevel: [] },
  {
    valleyId: 'suraksan',
    sbsncd: '101803',
    s1: [],
    s2: [
      { kind: 'aws', code: '532', name: '의정부' },
      { kind: 'aws', code: '599', name: '광릉' },
      { kind: 'aws', code: '451', name: '오남' },
    ],
    waterlevel: [{ kind: 'hrfco-waterlevel', code: '1018619', name: '포천시(마명1교)' }],
  },
  {
    valleyId: 'hamheodongcheon',
    sbsncd: '120105',
    s1: [],
    s2: [{ kind: 'aws', code: '500', name: '양도' }],
    waterlevel: [],
  },
  { valleyId: 'gugok', sbsncd: '101304', s1: [], s2: [], waterlevel: [] },
  {
    valleyId: 'gwangdeok',
    sbsncd: '101010',
    s1: [{ kind: 'aws', code: '695', name: '광덕산' }],
    s2: [],
    waterlevel: [],
  },
];

export const ALERT_SOURCE_BY_VALLEY: ReadonlyMap<string, AlertSourceRoster> = new Map(
  ALERT_SOURCES.map((r) => [r.valleyId, r]),
);
