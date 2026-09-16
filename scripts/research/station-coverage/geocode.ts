import fs from 'node:fs';
import path from 'node:path';
import { HERE, type Keys } from './env.ts';
import { distanceKm } from './geo.ts';
import { log, warn } from './log.ts';
import { type SearchItem, searchPlace } from './vworld.ts';

export interface ValleySeed {
  id: string;
  name: string;
  region: string;
  regionMatch: string;
  queries: string[];
  manual: [number, number];
  note: string;
}

export interface Valley {
  id: string;
  name: string;
  region: string;
  query: string;
  lng: number;
  lat: number;
  source: 'vworld-search' | 'manual';
  /** 채택한 검색 결과의 제목·분류·주소(출처 기록). */
  matched?: { title: string; category: string; address: string };
  /** 수기 좌표와의 거리(km) — 검색 결과 검증용. */
  distFromManualKm?: number;
  note: string;
}

const SEED = path.join(HERE, 'valleys.seed.json');
export const VALLEYS_JSON = path.join(HERE, 'valleys.json');

/**
 * 검색 결과 점수: 골짜기 > 그 외 자연지명(폭포·호소·산) > 휴양림·유원지·관광지 > 정류장 > 상호(펜션·식당).
 * 주소에 시군(regionMatch) 문자열이 있어야 하고, 수기 좌표에서 20 km 넘게 떨어진 동명 지명은 뺀다.
 */
function score(it: SearchItem, seed: ValleySeed, query: string): number {
  let s = 0;
  const c = it.category;
  if (c.includes('골짜기')) s += 8;
  // 산(산맥) 지명은 정상 좌표라 계곡 대리점으로 못 쓴다(표고 조건이 뒤집힘) → 제외
  else if (c.includes('산맥') || c.includes('진출입시설')) return -100;
  else if (c.includes('자연지명')) s += 5;
  else if (/휴양림|유원지|관광지|관광단지|캠핑|야영/.test(c) || /휴양림|유원지|관광지/.test(it.title)) s += 4;
  else if (/정류장/.test(c)) s += 1;
  const bare = seed.name.replace(/\(.*\)$/, '');
  if (it.title === bare || it.title === query) s += 3;
  else if (it.title.includes(bare) || it.title.includes(query)) s += 1;
  const d = distanceKm({ lng: +it.point.x, lat: +it.point.y }, { lng: seed.manual[0], lat: seed.manual[1] });
  if (d > 20) s -= 100;
  return s;
}

function inRegion(it: SearchItem, seed: ValleySeed): boolean {
  return `${it.address.parcel} ${it.address.road}`.includes(seed.regionMatch);
}

export async function geocodeValleys(keys: Keys, force = false): Promise<Valley[]> {
  if (!force && fs.existsSync(VALLEYS_JSON)) {
    return (JSON.parse(fs.readFileSync(VALLEYS_JSON, 'utf8')) as { valleys: Valley[] }).valleys;
  }
  const seeds = (JSON.parse(fs.readFileSync(SEED, 'utf8')) as { valleys: ValleySeed[] }).valleys;
  const out: Valley[] = [];
  for (const seed of seeds) {
    // 모든 검색어를 다 조회한 뒤 점수가 가장 높은 결과 하나를 고른다(첫 검색어의 식당·펜션보다 뒤 검색어의 지명이 낫다)
    let chosen: { item: SearchItem; query: string; score: number } | undefined;
    for (const q of seed.queries) {
      const items = await searchPlace(q, keys);
      for (const it of items) {
        if (!inRegion(it, seed)) continue;
        const sc = score(it, seed, q);
        if (sc < 0) continue;
        if (!chosen || sc > chosen.score) chosen = { item: it, query: q, score: sc };
      }
    }
    const manual = { lng: seed.manual[0], lat: seed.manual[1] };
    if (chosen) {
      const lng = Number(chosen.item.point.x);
      const lat = Number(chosen.item.point.y);
      const d = distanceKm({ lng, lat }, manual);
      out.push({
        id: seed.id,
        name: seed.name,
        region: seed.region,
        query: chosen.query,
        lng,
        lat,
        source: 'vworld-search',
        matched: {
          title: chosen.item.title,
          category: chosen.item.category,
          address: chosen.item.address.parcel || chosen.item.address.road,
        },
        distFromManualKm: Math.round(d * 10) / 10,
        note: seed.note,
      });
      log(`  ✓ ${seed.name} ← "${chosen.query}" ${chosen.item.title} [${chosen.item.category}] (수기와 ${d.toFixed(1)} km)`);
    } else {
      warn(`  ✗ ${seed.name}: 검색 결과 없음 → manual`);
      out.push({
        id: seed.id,
        name: seed.name,
        region: seed.region,
        query: seed.queries.join(' | '),
        lng: manual.lng,
        lat: manual.lat,
        source: 'manual',
        note: `${seed.note} · VWorld 검색(${seed.queries.join(', ')})에 ${seed.regionMatch} 결과 없음, 수기 좌표`,
      });
    }
  }
  fs.writeFileSync(
    VALLEYS_JSON,
    `${JSON.stringify({ _comment: 'R1 계곡 후보 30개. 좌표 출처 source: vworld-search(VWorld 검색 API 결과 그대로) | manual(수기). geocode.ts 가 valleys.seed.json 에서 생성.', generatedAt: new Date().toISOString().slice(0, 10), valleys: out }, null, 2)}\n`,
  );
  return out;
}
