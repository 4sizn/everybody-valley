/**
 * 계곡 출입 통제 시딩 — 지방산림청·지자체 고시의 통제구역 **지번**을 계곡에 붙인다.
 *
 *   python3 scripts/seed/access-xlsx.py --xlsx … --tag jungbu-2025 …   # 고시 xlsx → CSV
 *   pnpm seed:access --tag jungbu-2025                                   # CSV → data/access/jungbu-2025.json
 *   pnpm seed:access --tag jungbu-2025 --probe 3                         # 지역 필터 무시하고 필지 3개로 경로 점검
 *
 * 판정은 계곡 기준이다:
 *   통제구역 필지 → 브이월드 검색(지번 → PNU) → 데이터 API(PNU → 폴리곤) → 계곡 중심선 300 m 버퍼와
 *   교차하면 그 계곡의 `closed-area`(basis `parcel`). 같은 시군의 계곡만 본다(호출 절약).
 *   등산로 개방·폐쇄 행도 구간이 지나는 필지 지번이 있어 같은 길로 `trail-open`/`trail-closed`.
 * 통제 기간은 meta.json 의 seasons 마다 기록 하나.
 *
 * 브이월드 응답은 저장하지 않는다(약관 §19) — PNU·주소(코드)만 캐시하고 폴리곤은 메모리에서 쓰고
 * 버린다. 결과 파일에도 기하 없이 계곡 id·거리(m)·PNU 만 남는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readCsv } from './csv.mts';
import { DATA_DIR, type Keys, loadKeys, SEED_DIR, VALLEYS_DIR } from './env.mts';
import { dumpsFile } from './format.mts';
import { type Position, projectOnLine } from './geo.mts';
import { cached, fetchJson, VWORLD_GAP_MS } from './http.mts';
import { log, warn } from './log.mts';

export const ACCESS_BUFFER_M = 300;
const ACCESS_DIR = path.join(DATA_DIR, 'access');

interface Meta {
  readonly tag: string;
  readonly agency: string;
  readonly sourceUrl: string;
  readonly sourceFile: string;
  readonly seasons: readonly { readonly from: string; readonly to: string }[];
}

interface Control {
  readonly valleyId: string;
  readonly kind: 'closed-area' | 'trail-closed' | 'trail-open';
  readonly from: string;
  readonly to: string;
  readonly basis: 'parcel';
  readonly agency: string;
  readonly sourceUrl: string;
  readonly note: string;
}

interface ValleyRef {
  readonly id: string;
  readonly name: string;
  /** 시군구 마지막 토큰('포천시'·'강북구'). */
  readonly sigungu: string;
  /** 소재 리·동('도평리'·'우이동'). 주소가 없으면 ''. */
  readonly ri: string;
  readonly line: readonly Position[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function loadValleys(): ValleyRef[] {
  const raw = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'valleys.json'), 'utf8')) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { valleys?: unknown }).valleys)
      ? (raw as { valleys: unknown[] }).valleys
      : Object.values(raw as Record<string, unknown>);
  const out: ValleyRef[] = [];
  for (const v of list as {
    id: string;
    name: string;
    region?: string;
    matched?: { address?: string } | string;
  }[]) {
    const file = path.join(VALLEYS_DIR, `${v.id}.geojson`);
    if (!fs.existsSync(file)) continue;
    const geo = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      features: { geometry: { coordinates: Position[] } }[];
    };
    const address = typeof v.matched === 'object' ? (v.matched?.address ?? '') : '';
    const ri = /\s([가-힣]+[리동])(?:\s|$)/.exec(address)?.[1] ?? '';
    out.push({
      id: v.id,
      name: v.name,
      sigungu: (v.region ?? '').split(/\s+/).at(-1) ?? '',
      ri,
      line: geo.features[0]?.geometry.coordinates ?? [],
    });
  }
  return out;
}

/** 레이 캐스팅 — 점이 링 안인가. */
function insideRing(p: Position, ring: readonly Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as Position;
    const [xj, yj] = ring[j] as Position;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** 폴리곤(외곽 링들)과 중심선의 최소 거리(m). 중심선 점이 링 안이면 0. */
function polygonToLineM(
  rings: readonly (readonly Position[])[],
  line: readonly Position[],
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    for (const p of line) {
      if (insideRing(p, ring)) return 0;
      best = Math.min(best, projectOnLine(ring, p).distance);
    }
    for (const q of ring) best = Math.min(best, projectOnLine(line, q).distance);
  }
  return best;
}

function outerRings(geometry: { type: string; coordinates: unknown }): Position[][] {
  if (geometry.type === 'Polygon') return [(geometry.coordinates as Position[][])[0] as Position[]];
  if (geometry.type === 'MultiPolygon')
    return (geometry.coordinates as Position[][][]).map((poly) => poly[0] as Position[]);
  return [];
}

interface Parcel {
  readonly pnu: string;
  readonly address: string;
}

async function lookupPnu(
  query: string,
  mustContain: readonly string[],
  keys: Keys,
  domain: string,
): Promise<Parcel | null> {
  const key = keys.vworld as string;
  const safe = query.replace(/[^가-힣0-9-]+/g, '_');
  return cached<Parcel | null>(`vworld-stats/pnu-${safe}.json`, async () => {
    const url =
      `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:4326&size=5&page=1` +
      `&query=${encodeURIComponent(query)}&type=address&category=parcel&format=json&errorformat=json&key=${key}&domain=${domain}`;
    const res = await fetchJson<{
      response: {
        status: string;
        result?: { items?: { id: string; address: { parcel: string } }[] };
      };
    }>(url, keys, VWORLD_GAP_MS);
    const items = res.response.result?.items ?? [];
    const hit = items.find((it) => mustContain.every((t) => it.address.parcel.includes(t)));
    return hit ? { pnu: hit.id, address: hit.address.parcel } : null;
  });
}

async function fetchParcelRings(pnu: string, keys: Keys, domain: string): Promise<Position[][]> {
  const key = keys.vworld as string;
  const url =
    `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${key}&domain=${domain}` +
    `&attrFilter=pnu:=:${pnu}&crs=EPSG:4326&format=json&size=10`;
  const res = await fetchJson<{
    response: {
      status: string;
      result?: {
        featureCollection?: { features?: { geometry: { type: string; coordinates: unknown } }[] };
      };
    };
  }>(url, keys, VWORLD_GAP_MS);
  const features = res.response.result?.featureCollection?.features ?? [];
  return features.flatMap((f) => outerRings(f.geometry));
}

async function main(): Promise<void> {
  const tag = arg('tag');
  if (!tag) throw new Error('--tag <tag> 가 필요하다 (data/seed/access/<tag>/)');
  const probe = Number(arg('probe') ?? 0);
  const dry = process.argv.includes('--dry');
  const dir = path.join(SEED_DIR, 'access', tag);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as Meta;
  const keys = loadKeys();
  const key = keys.vworld;
  if (!key) throw new Error('.env.local 에 VWORLD_API_KEY 가 없다');
  const domain = process.env['VWORLD_DOMAIN'] ?? 'localhost';

  const valleys = loadValleys();
  const bySigungu = new Map<string, ValleyRef[]>();
  for (const v of valleys) {
    const list = bySigungu.get(v.sigungu) ?? [];
    list.push(v);
    bySigungu.set(v.sigungu, list);
  }

  const controls: Control[] = [];
  const push = (c: Omit<Control, 'from' | 'to'>) => {
    for (const s of meta.seasons) controls.push({ ...c, from: s.from, to: s.to });
  };

  // 통제구역 필지와 등산로 필지를 같은 길로 — 지번 → PNU → 폴리곤 → 계곡 중심선 버퍼 교차.
  type Row = Readonly<Record<string, string>>;
  const areas = readCsv(path.join(dir, 'areas.csv')).rows;
  const trails = readCsv(path.join(dir, 'trails.csv')).rows;
  const kindOf = (r: Row, fromTrails: boolean): Control['kind'] | null => {
    if (!fromTrails) return 'closed-area';
    if ((r['open'] ?? '').includes('개방')) return 'trail-open';
    if ((r['open'] ?? '').includes('폐쇄')) return 'trail-closed';
    return null;
  };
  const all: { row: Row; kind: Control['kind'] }[] = [];
  for (const r of areas) all.push({ row: r, kind: 'closed-area' });
  for (const r of trails) {
    const k = kindOf(r, true);
    if (k) all.push({ row: r, kind: k });
  }
  const candidates = all.filter((x) => bySigungu.has(x.row['sigungu'] ?? ''));
  const targets = probe > 0 ? all.slice(0, probe) : candidates;
  log(
    `${tag}: 필지 ${all.length}행(통제구역 ${areas.length} · 등산로 ${trails.length}) · 우리 시군 ${candidates.length} · 조회 ${targets.length} (계곡 ${valleys.length})`,
  );

  type Hit = { pnus: string[]; minM: number; labels: Set<string> };
  const hits = new Map<string, Hit>(); // key `${valleyId}|${kind}`
  let resolved = 0;
  for (const { row: r, kind } of targets) {
    const sigungu = r['sigungu'] ?? '';
    const ri = r['ri'] ?? '';
    const jibun = (r['jibun'] ?? '').replace(/[가-힣]$/, (ch) => (ch === '산' ? ch : ''));
    const query = `${sigungu} ${r['eupmyeon'] ?? ''} ${ri} ${jibun}`.replace(/\s+/g, ' ').trim();
    const parcel = await lookupPnu(query, [sigungu, ri].filter(Boolean), keys, domain);
    if (!parcel) {
      warn(`  지번 못 찾음: ${query}`);
      continue;
    }
    resolved += 1;
    const rings = await fetchParcelRings(parcel.pnu, keys, domain);
    if (rings.length === 0) {
      warn(`  폴리곤 없음: ${parcel.address} (${parcel.pnu})`);
      continue;
    }
    const pool = probe > 0 ? valleys : (bySigungu.get(sigungu) ?? []);
    for (const v of pool) {
      const m = polygonToLineM(rings, v.line);
      if (m > ACCESS_BUFFER_M) continue;
      const k = `${v.id}|${kind}`;
      const hit = hits.get(k) ?? { pnus: [], minM: Number.POSITIVE_INFINITY, labels: new Set() };
      hit.pnus.push(parcel.pnu);
      hit.minM = Math.min(hit.minM, Math.round(m));
      hit.labels.add(
        kind === 'closed-area'
          ? (r['mountain'] ?? '')
          : `${r['mountain'] ?? ''} ${r['section'] ?? ''} ${r['km'] ?? ''}km`.trim(),
      );
      hits.set(k, hit);
    }
  }
  for (const [k, hit] of hits) {
    const [valleyId, kind] = k.split('|') as [string, Control['kind']];
    const what =
      kind === 'closed-area' ? '통제구역' : kind === 'trail-open' ? '개방 등산로' : '폐쇄 등산로';
    push({
      valleyId,
      kind,
      basis: 'parcel',
      agency: meta.agency,
      sourceUrl: meta.sourceUrl,
      note: `${[...hit.labels].filter(Boolean).join(' · ')} — ${what} 필지 ${hit.pnus.length}개, 중심선까지 ${hit.minM} m (PNU ${hit.pnus.slice(0, 3).join(',')}${hit.pnus.length > 3 ? '…' : ''})`,
    });
  }

  log(
    `  지번 해석 ${resolved}/${targets.length} · 교차 (계곡, 종류) ${hits.size} → 기록 ${controls.length}`,
  );
  for (const [k, hit] of hits) {
    const [valleyId, kind] = k.split('|');
    const v = valleys.find((x) => x.id === valleyId);
    log(`  ${v?.name ?? valleyId} ${kind}: 필지 ${hit.pnus.length}, ${hit.minM} m`);
  }

  if (dry || probe > 0) {
    log(probe > 0 ? '  --probe 라 쓰지 않는다' : '  --dry 라 쓰지 않는다');
    return;
  }
  fs.mkdirSync(ACCESS_DIR, { recursive: true });
  const out = path.join(ACCESS_DIR, `${tag}.json`);
  fs.writeFileSync(
    out,
    dumpsFile({
      metadata: {
        tag: meta.tag,
        agency: meta.agency,
        sourceUrl: meta.sourceUrl,
        sourceFile: meta.sourceFile,
        seasons: meta.seasons,
        method: `고시 필지(통제구역·등산로) 지번 → 브이월드 PNU·지적 폴리곤 → 계곡 중심선 ${ACCESS_BUFFER_M} m 버퍼 교차. 기하 저장 없음.`,
        parcelsListed: all.length,
        parcelsQueried: targets.length,
        parcelsResolved: resolved,
        builtAt: new Date().toISOString().slice(0, 10),
      },
      controls,
    }),
  );
  log(`→ ${path.relative(process.cwd(), out)}`);
}

await main();
