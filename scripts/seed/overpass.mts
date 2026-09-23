/**
 * OSM Overpass — 계곡 점 주변 하천 중심선(`waterway~stream|river`)과 편의시설.
 *
 * 응답은 캐시하고(ODbL, 출처표시로 저장 가능) 요청 간격은 1 s 이상(`OVERPASS_GAP_MS`).
 * 저장 파일의 출처 표기: "© OpenStreetMap contributors, ODbL" — `metadata.sources` 에 URL 로 남긴다.
 */
import type { Keys } from './env.mts';
import { lineLengthM, type Position, pointAlong } from './geo.mts';
import { cached, fetchJson, OVERPASS_GAP_MS } from './http.mts';

/** 기본은 공식 인스턴스. 일시적으로 막히면(예 IP 차단) `OVERPASS_ENDPOINT` 로 다른 미러를 쓸 수 있다. */
const ENDPOINT = process.env['OVERPASS_ENDPOINT'] ?? 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'modu-valley-seed/0.1 (+https://github.com/4sizn/modu-valley)';
export const OSM_ATTRIBUTION = 'https://www.openstreetmap.org/copyright';

export interface OsmWay {
  readonly id: number;
  readonly nodes: readonly number[];
  readonly geometry: readonly Position[];
  readonly tags: Readonly<Record<string, string>>;
}

export interface OsmPoi {
  readonly type: 'node' | 'way' | 'relation';
  readonly id: number;
  readonly position: Position;
  readonly tags: Readonly<Record<string, string>>;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  nodes?: number[];
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/** GET + 식별 가능한 User-Agent — Overpass 는 Node 기본 UA 의 POST 를 406 으로 거절했다(2026-09-06 실측). */
async function query(ql: string, keys: Keys): Promise<OverpassResponse> {
  const url = `${ENDPOINT}?${new URLSearchParams({ data: ql }).toString()}`;
  return fetchJson<OverpassResponse>(url, keys, OVERPASS_GAP_MS, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
  });
}

/** 반경 `radiusM` 안의 하천 way(전체 기하 — 반경 밖으로 이어지는 부분도 함께). */
export async function fetchWaterways(
  valleyId: string,
  center: Position,
  radiusM: number,
  keys: Keys,
): Promise<readonly OsmWay[]> {
  const ql =
    `[out:json][timeout:90];` +
    `(way["waterway"~"^(stream|river)$"](around:${radiusM},${center[1]},${center[0]});)` +
    `;out geom;`;
  const response = await cached(`overpass/waterway-${valleyId}-${radiusM}.json`, () =>
    query(ql, keys),
  );
  return response.elements
    .filter((element) => element.type === 'way' && element.geometry !== undefined)
    .map((element) => ({
      id: element.id,
      nodes: element.nodes ?? [],
      geometry: (element.geometry ?? []).map((point): Position => [point.lon, point.lat]),
      tags: element.tags ?? {},
    }));
}

/** 시설 후보 — 주차장·화장실·식당·카페·매점(편의점·슈퍼·키오스크). 면 요소는 중심점. */
export async function fetchAmenities(
  valleyId: string,
  center: Position,
  radiusM: number,
  keys: Keys,
): Promise<readonly OsmPoi[]> {
  const around = `(around:${radiusM},${center[1]},${center[0]})`;
  const ql =
    `[out:json][timeout:90];(` +
    `nwr["amenity"~"^(parking|toilets|restaurant|cafe|fast_food|food_court)$"]${around};` +
    `nwr["shop"~"^(convenience|supermarket|kiosk|general)$"]${around};` +
    `);out center tags;`;
  const response = await cached(`overpass/amenity-${valleyId}-${radiusM}.json`, () =>
    query(ql, keys),
  );
  return toPois(response);
}

/** 중심선 bbox 를 `radiusM` 만큼 넓힌 Overpass bbox 문자열 `s,w,n,e`. */
function bboxAround(line: readonly Position[], radiusM: number): string {
  const lats = line.map(([, lat]) => lat);
  const lngs = line.map(([lng]) => lng);
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((Math.min(...lats) * Math.PI) / 180));
  return [
    Math.min(...lats) - dLat,
    Math.min(...lngs) - dLng,
    Math.max(...lats) + dLat,
    Math.max(...lngs) + dLng,
  ]
    .map((value) => value.toFixed(5))
    .join(',');
}

/**
 * 이름 있는 봉우리(`natural=peak`) — 중심선 bbox + `radiusM`. `ele` 태그는 그대로 두고 `peaks.mts` 가 숫자로 푼다.
 * 캐시 `overpass/peaks-<id>-<r>.json`.
 */
export async function fetchPeaks(
  valleyId: string,
  line: readonly Position[],
  radiusM: number,
  keys: Keys,
): Promise<readonly OsmPoi[]> {
  const ql = `[out:json][timeout:60];node["natural"="peak"]["name"](${bboxAround(line, radiusM)});out;`;
  const response = await cached(`overpass/peaks-${valleyId}-${radiusM}.json`, () =>
    query(ql, keys),
  );
  return toPois(response);
}

/**
 * 쓰레기통·놀이터 후보(2026-09-23) — 중심선을 `radiusM` 만큼 넓힌 **bbox** 로 조회한다. 정자처럼 선 버퍼
 * (`around:r,lat,lon,…`)로 받으면 1.2 km 버퍼가 무거워 미러에서 504 가 났다(실측). bbox 는 가볍고, 선에서의
 * 거리는 `facilities.mts` 가 다시 자른다. 기존 amenity 캐시를 건드리지 않도록 별도 캐시 파일(`extras-…`).
 */
export async function fetchExtras(
  valleyId: string,
  line: readonly Position[],
  radiusM: number,
  keys: Keys,
): Promise<readonly OsmPoi[]> {
  const bbox = bboxAround(line, radiusM);
  const ql =
    `[out:json][timeout:60];(` +
    `nwr["leisure"="playground"](${bbox});` +
    `nwr["amenity"~"^(waste_basket|waste_disposal|recycling)$"](${bbox});` +
    `);out center tags;`;
  const response = await cached(`overpass/extras-${valleyId}-${radiusM}-bbox.json`, () =>
    query(ql, keys),
  );
  return toPois(response);
}

/**
 * 정자·쉼터 후보 — `amenity=shelter` 와 `building=pavilion`, **구간 중심선을 따라** 조회한다.
 *
 * 한국의 정자는 대부분 `amenity=shelter` + `shelter_type=gazebo` 로 들어가 있다(실측 2026-09-08:
 * 수도권 계곡 주변 344건 중 gazebo 251 · 유형 없음 82 · tent 6 · basic_hut 3 · picnic_shelter 2).
 * 캠핑장 그늘막(`tent`)과 대피소(`basic_hut`)가 섞여 오므로 **거르는 것은 `facilities.mts`** 가
 * 한다 — 여기서는 후보만 받아 캐시한다.
 *
 * Overpass 의 `around:r,lat1,lon1,lat2,lon2,…` 는 점들을 **이은 선**의 버퍼를 뜻한다. 중심점
 * 반경으로 받으면 긴 구간의 끝쪽 정자를 놓치고, 반경을 키우면 옆 동네까지 들어온다(그리고 무거워
 * 504 가 난다). 중심선을 200 m 간격으로 샘플링해 그 선을 따라 얇게 훑는다.
 */
export async function fetchShelters(
  valleyId: string,
  line: readonly Position[],
  radiusM: number,
  keys: Keys,
): Promise<readonly OsmPoi[]> {
  const samples = sampleLine(line, SHELTER_SAMPLE_GAP_M);
  const coords = samples.map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(',');
  const around = `(around:${radiusM},${coords})`;
  const ql =
    `[out:json][timeout:120];(` +
    `nwr["amenity"="shelter"]${around};` +
    `nwr["building"="pavilion"]${around};` +
    `);out center tags;`;
  const response = await cached(
    `overpass/shelter-${valleyId}-${radiusM}-${samples.length}.json`,
    () => query(ql, keys),
  );
  return toPois(response);
}

/** 응답 요소 → 점(way·relation 은 `center`). 좌표 없는 요소는 버린다. */
function toPois(response: OverpassResponse): OsmPoi[] {
  const out: OsmPoi[] = [];
  for (const element of response.elements) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    out.push({
      type: element.type,
      id: element.id,
      position: [lon, lat],
      tags: element.tags ?? {},
    });
  }
  return out;
}

/** 중심선 샘플 간격(m) — 촘촘할수록 질의가 무거워진다. */
const SHELTER_SAMPLE_GAP_M = 200;

/** 폴리라인을 일정 간격으로 샘플링(양끝 포함). */
function sampleLine(line: readonly Position[], gapM: number): Position[] {
  const total = lineLengthM(line);
  const count = Math.max(2, Math.min(60, Math.ceil(total / gapM) + 1));
  const out: Position[] = [];
  for (let index = 0; index < count; index += 1) {
    out.push(pointAlong(line, (total * index) / (count - 1)));
  }
  return out;
}
