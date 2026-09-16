/**
 * 데모 시드 데이터 — 원본 HTML 의 `LAUNCH` 와 `SPOTS` 를 도메인 객체로 옮긴 것.
 *
 * 좌표·색·문구는 한 글자도 바꾸지 않았다. 혼잡도만 자유 문자열에서
 * `CrowdLevel` 로 올렸고, 표시 문구는 `crowdLabel` 이 같은 문자열을 돌려준다.
 *
 * 원본 데모의 고지 그대로: 예시 데이터이며 실제 관람 정보가 아니다.
 */
import { type CrowdLevel, crowdLabel } from '../domain/festival/CrowdLevel';
import { Festival } from '../domain/festival/Festival';
import type { Program } from '../domain/festival/Program';
import { type HexColor, Spot } from '../domain/festival/Spot';
import { toSpotId } from '../domain/festival/SpotId';
import { infoRow } from '../domain/festival/SpotInfoRow';
import { LngLat } from '../domain/geo/LngLat';

/** 발사 지점 — 여의도 한강공원 상공. 데모의 `LAUNCH`. */
export const LAUNCH_SITE = LngLat.of(126.9345, 37.5285);

export const FESTIVAL_TITLE = '서울세계불꽃축제 2026';

const PROGRAMS: readonly Program[] = [
  {
    id: 'eve',
    title: '전야제',
    schedule: '2026년 9월 4일 (금) · 20:00–20:20',
    summary: '시민 불꽃쇼 · 드론쇼',
  },
  {
    id: 'main',
    title: '메인 불꽃쇼',
    schedule: '2026년 9월 5일 (토) · 19:20–20:40',
    summary: '영국 20:00 · 미국 20:20 · 한국 20:40',
  },
];

type SpotSeed = {
  readonly id: string;
  readonly name: string;
  readonly lng: number;
  readonly lat: number;
  readonly tag: string;
  readonly color: HexColor;
  readonly description: string;
  readonly crowd: CrowdLevel;
  readonly viewpoint: string;
  readonly restroom: string;
  readonly transit: string;
};

const SPOT_SEEDS: readonly SpotSeed[] = [
  {
    id: 'yeouido-hangang-park',
    name: '여의도 한강공원',
    lng: 126.933,
    lat: 37.5285,
    tag: '공식 관람구역',
    color: '#f97316',
    description: '두 불꽃 연출 지점과 가까운 대표 무료 관람지예요.',
    crowd: 'severe',
    viewpoint: '불꽃이 크게 보이는 중심 관람지',
    restroom: '안내센터 앞 계절광장 약 100m',
    transit: '5호선 여의나루역 약 400m',
  },
  {
    id: 'wonhyo-bridge-south',
    name: '원효대교 남단',
    lng: 126.943,
    lat: 37.5245,
    tag: '다리 위 조망',
    color: '#38bdf8',
    description: '다리 위에서 정면으로 내려다보는 각도가 나오는 자리예요.',
    crowd: 'busy',
    viewpoint: '정면 시야 · 강 반사 함께 보임',
    restroom: '남단 진입로 공원 약 250m',
    transit: '1호선 남영역 약 900m',
  },
  {
    id: '63-square',
    name: '63빌딩 앞',
    lng: 126.94,
    lat: 37.5195,
    tag: '랜드마크 배경',
    color: '#a78bfa',
    description: '랜드마크를 배경에 걸고 촬영하기 좋은 각도예요.',
    crowd: 'moderate',
    viewpoint: '건물 실루엣과 겹치는 구도',
    restroom: '건물 내 이용 가능',
    transit: '5호선 여의도역 약 1.1km',
  },
  {
    id: 'nodeul-island',
    name: '노들섬',
    lng: 126.9585,
    lat: 37.5175,
    tag: '정면 조망',
    color: '#34d399',
    description: '강 건너 정면에서 전체를 조망할 수 있어요.',
    crowd: 'busy',
    viewpoint: '시야를 가리는 구조물이 적음',
    restroom: '노들섬 내 상시 개방',
    transit: '9호선 노들역 약 600m',
  },
  {
    id: 'seogang-bridge-north',
    name: '서강대교 북단',
    lng: 126.931,
    lat: 37.5405,
    tag: '인파 우회',
    color: '#fbbf24',
    description: '중심부 인파를 피하면서 볼 수 있는 우회 지점이에요.',
    crowd: 'relaxed',
    viewpoint: '거리는 있지만 여유로움',
    restroom: '밤섬 전망대 인근 약 300m',
    transit: '2호선 신촌역 약 1.4km',
  },
  {
    id: 'ichon-hangang-park',
    name: '이촌 한강공원',
    lng: 126.969,
    lat: 37.517,
    tag: '측면 조망',
    color: '#fb7185',
    description: '측면에서 넓게 펼쳐지는 구도로 볼 수 있어요.',
    crowd: 'moderate',
    viewpoint: '돗자리 펼치기 좋은 잔디',
    restroom: '이촌나들목 인근 약 200m',
    transit: '4호선 이촌역 약 500m',
  },
];

function toSpot(seed: SpotSeed): Spot {
  return new Spot({
    id: toSpotId(seed.id),
    name: seed.name,
    tag: seed.tag,
    color: seed.color,
    position: LngLat.of(seed.lng, seed.lat),
    description: seed.description,
    crowd: seed.crowd,
    // 순서도 데모와 같다: 관람 포인트 → 혼잡도 → 화장실 → 교통
    infoRows: [
      infoRow('viewpoint', seed.viewpoint),
      infoRow('crowd', crowdLabel(seed.crowd)),
      infoRow('restroom', seed.restroom),
      infoRow('transit', seed.transit),
    ],
  });
}

export function createSeoulFireworks2026(): Festival {
  return new Festival({
    title: FESTIVAL_TITLE,
    launchSite: LAUNCH_SITE,
    programs: PROGRAMS,
    spots: SPOT_SEEDS.map(toSpot),
  });
}
