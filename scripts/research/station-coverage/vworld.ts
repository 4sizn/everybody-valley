import { cached } from './cache.ts';
import type { Keys } from './env.ts';
import { type LngLat, round5 } from './geo.ts';
import { fetchJson } from './http.ts';

export interface Basin {
  /** 표준유역 코드 */
  sbsncd: string;
  sbsnnm: string;
  /** 중권역 코드 */
  mbsncd: string;
  /** 대권역 코드 */
  bbsncd: string;
}

interface WfsResponse {
  features?: { properties: Record<string, string> }[];
}

const WFS_GAP_MS = 150;

/**
 * 점이 속한 표준유역(lt_c_wkmsbsn)을 VWorld WFS 로 조회. BBOX 는 **위도,경도** 순서(EPSG:4326, WFS 1.1.0).
 * 폴리곤은 저장하지 않고 속성 코드만 캐시한다(브이월드 약관 §19).
 */
export async function lookupBasin(p: LngLat, keys: Keys): Promise<Basin | undefined> {
  const lat = round5(p.lat);
  const lng = round5(p.lng);
  const key = `basin/${lat}_${lng}.json`;
  const r = await cached<Basin | null>(key, async () => {
    for (const eps of [0.0003, 0.002]) {
      const bbox = `${lat - eps},${lng - eps},${lat + eps},${lng + eps},EPSG:4326`;
      const url =
        `https://api.vworld.kr/req/wfs?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=lt_c_wkmsbsn` +
        `&BBOX=${bbox}&SRSNAME=EPSG:4326&OUTPUT=application/json&MAXFEATURES=1&key=${keys.vworld}&domain=localhost`;
      const j = await fetchJson<WfsResponse>(url, keys, WFS_GAP_MS);
      const f = j.features?.[0];
      if (f) {
        const pr = f.properties;
        return { sbsncd: pr['sbsncd'] ?? '', sbsnnm: pr['sbsnnm'] ?? '', mbsncd: pr['mbsncd'] ?? '', bbsncd: pr['bbsncd'] ?? '' };
      }
    }
    return null;
  });
  return r ?? undefined;
}

export interface SearchItem {
  id: string;
  title: string;
  category: string;
  address: { road: string; parcel: string };
  point: { x: string; y: string };
}

interface SearchResponse {
  response: { status: string; result?: { items?: SearchItem[] }; error?: { text?: string } };
}

/** VWorld 지명 검색(type=place). 응답은 그대로 캐시. */
export async function searchPlace(query: string, keys: Keys, type: 'place' | 'address' = 'place'): Promise<SearchItem[]> {
  const items = await cached<SearchItem[]>(`search/${type}-${encodeURIComponent(query)}.json`, async () => {
    const url =
      `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:4326&size=10&page=1` +
      `&query=${encodeURIComponent(query)}&type=${type}&format=json&errorformat=json&key=${keys.vworld}`;
    const j = await fetchJson<SearchResponse>(url, keys, 150);
    if (j.response.status === 'ERROR') throw new Error(`VWorld search 오류: ${j.response.error?.text ?? ''}`);
    return j.response.result?.items ?? [];
  });
  return items;
}
