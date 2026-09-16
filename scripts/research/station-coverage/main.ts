/**
 * R1 — 상류 관측소 커버리지 실측.
 *
 *   pnpm research:coverage            # 캐시 재사용, valleys.json 있으면 재검색 안 함
 *   pnpm research:coverage --regeocode
 *
 * 흐름: 관측소 3종 적재(HRFCO 강우·수위, KMA AWS) → 계곡 30개 좌표(VWorld 검색) → 계곡·관측소 표고(Terrarium)
 *       → 표준유역/중권역 코드(VWorld WFS, 코드만 캐시) → 계곡별 상류 매칭 → results.json · results.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { HERE, requireKeys } from './env.ts';
import { elevationAt } from './elevation.ts';
import { type Valley, geocodeValleys } from './geocode.ts';
import { distanceKm } from './geo.ts';
import { log, warn } from './log.ts';
import { type Station, type StationKind, loadHrfco, loadKmaAws } from './stations.ts';
import { type Basin, lookupBasin } from './vworld.ts';

const RADII_KM = [15, 10] as const;
type Radius = (typeof RADII_KM)[number];
const PREFILTER_KM = Math.max(...RADII_KM);

interface StationEx extends Station {
  elev: number;
  elevSource: 'spec' | 'terrarium';
  basin?: Basin;
}

interface Match {
  kind: StationKind;
  code: string;
  name: string;
  distKm: number;
  elev: number;
  /** 관측소 표고 − 계곡 표고 */
  elevDiff: number;
  sbsncd: string;
  sameSbsn: boolean;
}

interface RadiusResult {
  rainHrfco: number;
  rainKma: number;
  rainTotal: number;
  waterlevel: number;
  rainSameSbsn: number;
  /** 민감도: 표고 조건을 빼고(같은 중권역·거리만) 센 강우 관측소 수 */
  rainNoElev: number;
  /** 민감도: 유역 조건을 빼고(표고·거리만) 센 강우 관측소 수 */
  rainNoBasin: number;
  /** 엄격: 기준 조건 + 표고차 ≥ 50 m (평지 이웃 관측소 제외) */
  rainStrict: number;
  nearestRain?: Match;
  matches: Match[];
}

interface ValleyResult {
  valley: Valley;
  elev: number;
  basin?: Basin;
  byRadius: Record<Radius, RadiusResult>;
  /** 유역 무시, 가장 가까운 강우 관측소(진단용) */
  nearestRainAny?: { kind: StationKind; name: string; distKm: number; elevDiff: number; sameMbsn: boolean };
}

const KIND_LABEL: Record<StationKind, string> = { 'rain-hrfco': '홍수통제소 강우', 'rain-kma': 'AWS', 'waterlevel-hrfco': '수위' };

async function main(): Promise<void> {
  const keys = requireKeys();
  const regeocode = process.argv.includes('--regeocode');

  log('1) 계곡 좌표');
  const valleys = await geocodeValleys(keys, regeocode);
  log(`   ${valleys.length}개 (vworld-search ${valleys.filter((v) => v.source === 'vworld-search').length} · manual ${valleys.filter((v) => v.source === 'manual').length})`);

  log('2) 관측소 적재');
  const hrfco = await loadHrfco(keys);
  const kma = await loadKmaAws(keys);
  const all: Station[] = [...hrfco.rain, ...hrfco.waterlevel, ...kma];
  const near = all.filter((s) => valleys.some((v) => distanceKm(s, v) <= PREFILTER_KM));
  const count = (k: StationKind): number => near.filter((s) => s.kind === k).length;
  log(`   전체 ${all.length} → 계곡 ${PREFILTER_KM} km 안 ${near.length} (강우 HRFCO ${count('rain-hrfco')} · AWS ${count('rain-kma')} · 수위 ${count('waterlevel-hrfco')})`);

  log('3) 표고 (Terrarium z12; 제원 표고가 있으면 제원)');
  const valleyElev = new Map<string, number>();
  for (const v of valleys) valleyElev.set(v.id, await elevationAt(v, keys));
  const stations: StationEx[] = [];
  for (const s of near) {
    const elev = s.elevSpec ?? (await elevationAt(s, keys));
    stations.push({ ...s, elev, elevSource: s.elevSpec === undefined ? 'terrarium' : 'spec' });
  }
  log(`   관측소 표고 제원 ${stations.filter((s) => s.elevSource === 'spec').length} · 타일 ${stations.filter((s) => s.elevSource === 'terrarium').length}`);

  log(`4) 표준유역/중권역 (VWorld WFS, 점 ${valleys.length + stations.length}개, 코드만 캐시)`);
  const valleyBasin = new Map<string, Basin | undefined>();
  for (const v of valleys) {
    const b = await lookupBasin(v, keys);
    if (!b) warn(`   계곡 ${v.name}: 유역 없음`);
    valleyBasin.set(v.id, b);
  }
  let done = 0;
  for (const s of stations) {
    const sb = await lookupBasin(s, keys);
    if (sb) s.basin = sb;
    done++;
    if (done % 50 === 0) log(`   관측소 ${done}/${stations.length}`);
  }
  const noBasin = stations.filter((s) => !s.basin);
  if (noBasin.length) warn(`   유역 없는 관측소 ${noBasin.length}: ${noBasin.map((s) => s.name).join(', ')}`);

  log('5) 매칭');
  const results: ValleyResult[] = valleys.map((v) => {
    const elev = valleyElev.get(v.id) ?? 0;
    const basin = valleyBasin.get(v.id);
    const byRadius = {} as Record<Radius, RadiusResult>;
    for (const r of RADII_KM) {
      const matches: Match[] = stations
        .filter((s) => basin && s.basin && s.basin.mbsncd === basin.mbsncd && s.elev >= elev)
        .map((s) => ({ s, d: distanceKm(s, v) }))
        .filter(({ d }) => d <= r)
        .sort((a, b) => a.d - b.d)
        .map(({ s, d }) => ({
          kind: s.kind,
          code: s.code,
          name: s.name,
          distKm: Math.round(d * 10) / 10,
          elev: s.elev,
          elevDiff: Math.round(s.elev - elev),
          sbsncd: s.basin?.sbsncd ?? '',
          sameSbsn: s.basin?.sbsncd === basin?.sbsncd,
        }));
      const rain = matches.filter((m) => m.kind !== 'waterlevel-hrfco');
      const rainStations = stations.filter((s) => s.kind !== 'waterlevel-hrfco');
      const within = (s: StationEx): boolean => distanceKm(s, v) <= r;
      const rainNoElev = rainStations.filter((s) => within(s) && !!basin && s.basin?.mbsncd === basin.mbsncd).length;
      const rainNoBasin = rainStations.filter((s) => within(s) && s.elev >= elev).length;
      const res: RadiusResult = {
        rainHrfco: rain.filter((m) => m.kind === 'rain-hrfco').length,
        rainKma: rain.filter((m) => m.kind === 'rain-kma').length,
        rainTotal: rain.length,
        waterlevel: matches.filter((m) => m.kind === 'waterlevel-hrfco').length,
        rainSameSbsn: rain.filter((m) => m.sameSbsn).length,
        rainNoElev,
        rainNoBasin,
        rainStrict: rain.filter((m) => m.elevDiff >= 50).length,
        matches,
      };
      if (rain[0]) res.nearestRain = rain[0];
      byRadius[r] = res;
    }
    const vr: ValleyResult = { valley: v, elev, byRadius };
    if (basin) vr.basin = basin;
    const anyRain = stations
      .filter((s) => s.kind !== 'waterlevel-hrfco')
      .map((s) => ({ s, d: distanceKm(s, v) }))
      .sort((a, b) => a.d - b.d)[0];
    if (anyRain) {
      vr.nearestRainAny = {
        kind: anyRain.s.kind,
        name: anyRain.s.name,
        distKm: Math.round(anyRain.d * 10) / 10,
        elevDiff: Math.round(anyRain.s.elev - elev),
        sameMbsn: !!basin && anyRain.s.basin?.mbsncd === basin.mbsncd,
      };
    }
    return vr;
  });

  const md = render(results);
  fs.writeFileSync(path.join(HERE, 'results.md'), md);
  fs.writeFileSync(
    path.join(HERE, 'results.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), radiiKm: RADII_KM, results }, null, 2)}\n`,
  );
  log(md);
  log('→ results.md · results.json 저장');
}

function pct(n: number, d: number): string {
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function verdict(p: number): string {
  return p >= 70 ? '진행(≥70%)' : p >= 40 ? '부분 노출(40~70%)' : 'MVP-3 재설계(<40%)';
}

function render(results: ValleyResult[]): string {
  const n = results.length;
  const lines: string[] = [];
  lines.push('## 커버리지 요약 (상류 강우 관측소 ≥ 1 인 계곡 비율)');
  lines.push('');
  lines.push('상류 = 같은 중권역(mbsncd) ∧ 관측소 표고 ≥ 계곡 표고 ∧ 거리 ≤ 반경.');
  lines.push('');
  lines.push('| 반경 | HRFCO 강우만 | AWS 만 | HRFCO + AWS | (참고) 표준유역 일치 강우 | (보조) 수위 ≥1 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of RADII_KM) {
    const c = (f: (x: RadiusResult) => boolean): number => results.filter((v) => f(v.byRadius[r])).length;
    const h = c((x) => x.rainHrfco >= 1);
    const k = c((x) => x.rainKma >= 1);
    const t = c((x) => x.rainTotal >= 1);
    const sb = c((x) => x.rainSameSbsn >= 1);
    const wl = c((x) => x.waterlevel >= 1);
    lines.push(`| ${r} km | ${h}/${n} (${pct(h, n)}) | ${k}/${n} (${pct(k, n)}) | **${t}/${n} (${pct(t, n)})** | ${sb}/${n} (${pct(sb, n)}) | ${wl}/${n} (${pct(wl, n)}) |`);
  }
  lines.push('');
  lines.push('| 기준 | 판정(valley-ds §A) |');
  lines.push('| --- | --- |');
  for (const r of RADII_KM) {
    const t = results.filter((v) => v.byRadius[r].rainTotal >= 1).length;
    const h = results.filter((v) => v.byRadius[r].rainHrfco >= 1).length;
    lines.push(`| ${r} km · HRFCO + AWS | ${pct(t, n)} → ${verdict((t / n) * 100)} |`);
    lines.push(`| ${r} km · HRFCO 만 | ${pct(h, n)} → ${verdict((h / n) * 100)} |`);
  }
  lines.push('');
  lines.push('## 민감도 — 조건을 하나씩 빼면');
  lines.push('');
  lines.push('| 반경 | 기준(중권역 ∧ 표고 ∧ 거리) | 엄격(기준 ∧ 표고차 ≥ 50 m) | 표고 조건 제외 | 유역 조건 제외 | 거리만 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of RADII_KM) {
    const base = results.filter((v) => v.byRadius[r].rainTotal >= 1).length;
    const st = results.filter((v) => v.byRadius[r].rainStrict >= 1).length;
    const ne = results.filter((v) => v.byRadius[r].rainNoElev >= 1).length;
    const nb = results.filter((v) => v.byRadius[r].rainNoBasin >= 1).length;
    const dOnly = results.filter((v) => v.nearestRainAny && v.nearestRainAny.distKm <= r).length;
    lines.push(`| ${r} km | ${base}/${n} (${pct(base, n)}) | ${st}/${n} (${pct(st, n)}) | ${ne}/${n} (${pct(ne, n)}) | ${nb}/${n} (${pct(nb, n)}) | ${dOnly}/${n} (${pct(dOnly, n)}) |`);
  }
  lines.push('');
  lines.push('## 계곡별 결과');
  lines.push('');
  lines.push('강우 열은 `HRFCO+AWS` (HRFCO / AWS), 최근접은 상류 강우 관측소 중 가장 가까운 것(종류 · 거리 · 표고차 = 관측소 − 계곡). "표준유역" 은 15 km 안 상류 강우 관측소 중 계곡과 같은 sbsncd 인 수.');
  lines.push('');
  lines.push('| # | 계곡 | 시군 | 좌표 출처 | 표고 m | 중권역 | 표준유역 | 강우 15km | 강우 10km | 수위 15/10 | 최근접 상류 강우 | 표준유역 일치 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  results.forEach((v, i) => {
    const r15 = v.byRadius[15];
    const r10 = v.byRadius[10];
    const near = r15.nearestRain
      ? `${r15.nearestRain.name} (${KIND_LABEL[r15.nearestRain.kind]} · ${r15.nearestRain.distKm} km · +${r15.nearestRain.elevDiff} m)`
      : v.nearestRainAny
        ? `— (유역 무시 최근접 ${v.nearestRainAny.name} ${v.nearestRainAny.distKm} km, ${v.nearestRainAny.sameMbsn ? '같은 중권역·표고 낮음' : '다른 중권역'})`
        : '—';
    const src = v.valley.source === 'manual' ? 'manual' : 'vworld';
    lines.push(
      `| ${i + 1} | ${v.valley.name} | ${v.valley.region} | ${src} | ${Math.round(v.elev)} | ${v.basin?.mbsncd ?? '—'} | ${v.basin ? `${v.basin.sbsncd} ${v.basin.sbsnnm}` : '—'} | **${r15.rainTotal}** (${r15.rainHrfco}/${r15.rainKma}) | **${r10.rainTotal}** (${r10.rainHrfco}/${r10.rainKma}) | ${r15.waterlevel}/${r10.waterlevel} | ${near} | ${r15.rainSameSbsn} |`,
    );
  });
  lines.push('');
  lines.push('## 계곡별 상류 관측소 목록 (15 km)');
  lines.push('');
  for (const v of results) {
    const m = v.byRadius[15].matches;
    lines.push(`- **${v.valley.name}** (${v.valley.region}, 표고 ${Math.round(v.elev)} m, 중권역 ${v.basin?.mbsncd ?? '—'}): ${m.length ? '' : '상류 관측소 없음'}`);
    for (const x of m) {
      lines.push(`  - ${KIND_LABEL[x.kind]} \`${x.code}\` ${x.name} — ${x.distKm} km, 표고 ${Math.round(x.elev)} m (+${x.elevDiff}), 표준유역 ${x.sbsncd}${x.sameSbsn ? ' ✓동일' : ''}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

main().catch((e: unknown) => {
  warn(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
