/**
 * F3a — 경보 캘리브레이션 스파이크.
 *
 *   pnpm research:calibration                 # 2026-07-01 ~ 08-31, 캐시(.cache/) 재사용
 *   pnpm research:calibration --years 2026,2025
 *
 * 흐름: 사례 쌍(pairs.ts) 마다 10분 강우(HRFCO·AWS)·10분 수위(HRFCO) 적재 → 강우 이벤트 추출 → 단계 도달 시각
 *       → 하류 수위 반응(Δ10 ≥ +5 cm)·피크·관측소 4단계 → 리드타임 · 혼동행렬(임계값 변형별) · 해제 규칙
 *       → results.json(이벤트 요약만) · results.md
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  type Confusion,
  type Outcome,
  type RainEvent,
  type RainSeries,
  type ReleaseSim,
  STAGES,
  STAGE_LABEL,
  type Series,
  type StageId,
  VARIANTS,
  type WaterResponse,
  classify,
  classifyTotal,
  deriveRain,
  emptyConfusion,
  extractEvents,
  median,
  simulateRelease,
  waterResponse,
} from './analysis.ts';
import { HERE, requireKeys } from './env.ts';
import { type Grid, dayList, formatShort, gridMinute, makeGrid } from './grid.ts';
import { type CasePair, PAIRS, RAIN_ONLY } from './pairs.ts';
import { type RainGauge, loadRain, loadHrfcoWaterlevel, loadWaterStages } from './sources.ts';
import { log, warn } from '../station-coverage/log.ts';

const STAGE_IDS = Object.keys(STAGES) as StageId[];

interface Args {
  years: number[];
}

function parseArgs(): Args {
  const i = process.argv.indexOf('--years');
  const raw = i >= 0 ? (process.argv[i + 1] ?? '') : '2026';
  const years = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  return { years: years.length ? years : [2026] };
}

interface Period {
  year: number;
  grid: Grid;
  days: string[];
}

const periodOf = (year: number): Period => ({
  year,
  grid: makeGrid(`${year}0701`, `${year}0901`),
  days: dayList(`${year}0701`, `${year}0831`),
});

/** 이벤트 1건 요약 — results.json 에 들어가는 것은 이것뿐(원본 시계열은 커밋하지 않는다). */
interface EventSummary {
  year: number;
  pair: string;
  gauge: string;
  gaugeName: string;
  start: string;
  end: string;
  durationMin: number;
  totalMm: number;
  maxR10: number;
  maxR60: number;
  maxR180: number;
  /** 1h 합 ≥ 10 mm 인 "사례" */
  isCase: boolean;
  stageAt: Record<StageId, string | null>;
  water: {
    baselineM: number | null;
    reactAt: string | null;
    reactCumAt: string | null;
    peakAt: string | null;
    peakM: number | null;
    riseM: number | null;
    maxDelta10M: number | null;
    stageReached: WaterResponse['stageReached'];
    attwlAt: string | null;
    rise2hAny: boolean;
    missingRatio: number;
  };
  /** 수위 반응 시작 − 기준 시각 (분). 양수 = 강우 신호가 먼저 */
  leadMin: { fromStart: number | null; fromAttention: number | null; fromCaution: number | null };
  /** 누적 +10 cm 반응 기준 리드 */
  leadCumMin: { fromStart: number | null; fromCaution: number | null };
  outcome: Record<string, Outcome>;
  /** 보조 정답(총 상승 ≥ 10 cm) 기준 */
  outcomeTotal: Record<string, Outcome>;
  release: {
    /** 주의 경보 뒤 §1.2 규칙(강우 30분 ∧ 수위 60분) */
    rule: { at: string | null; reRiseM: number | null; beforePeak: boolean } | null;
    /** 강우 조건만(수위 조건 없이) — 비교용 */
    rainOnly: { at: string | null; reRiseM: number | null; beforePeak: boolean } | null;
    /** 강화안: 규칙 + 3h 합 < 20 mm */
    strict: { at: string | null; reRiseM: number | null; beforePeak: boolean } | null;
  };
  /** 같은 쌍의 다른 우량계가 관심 시각 ±1시간 안에 1h 10 mm 를 넘겼는가 */
  cooccur: Record<string, boolean>;
}

interface LeadStats {
  n: number;
  median: number | null;
  min: number | null;
  max: number | null;
  ge30: number;
  negative: number;
}

interface GaugeSummary {
  pair: string;
  valley: string;
  gauge: string;
  gaugeName: string;
  note: string;
  years: number[];
  rainMissingRatio: number;
  events: number;
  cases: number;
  casesWithReaction: number;
  casesWithoutReaction: number;
  eventsWithReactionNoCase: number;
  lead: { fromStart: LeadStats; fromAttention: LeadStats; fromCaution: LeadStats };
  leadCum: { fromStart: LeadStats; fromCaution: LeadStats };
  confusion: Record<string, Confusion>;
  confusionTotal: Record<string, Confusion>;
  release: Record<'rule' | 'rainOnly' | 'strict', { n: number; beforePeak: number; reRise10: number }>;
  waterStage: { attwl: number; wrnwl: number; almwl: number; srswl: number };
  cooccur: Record<string, { n: number; yes: number }>;
}

const at = (g: Grid, i: number | null): string | null => (i === null ? null : formatShort(gridMinute(g, i)));
const minutesBetween = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : (a - b) * 10);

function leadStats(xs: (number | null)[]): LeadStats {
  const v = xs.filter((x): x is number => x !== null);
  return {
    n: v.length,
    median: median(v),
    min: v.length ? Math.min(...v) : null,
    max: v.length ? Math.max(...v) : null,
    ge30: v.filter((x) => x >= 30).length,
    negative: v.filter((x) => x < 0).length,
  };
}

function relSummary(g: Grid, r: ReleaseSim): { at: string | null; reRiseM: number | null; beforePeak: boolean } {
  return { at: at(g, r.releaseIdx), reRiseM: r.reRiseM, beforePeak: r.beforePeak };
}

async function main(): Promise<void> {
  const { years } = parseArgs();
  const keys = requireKeys();
  const periods = years.map(periodOf);
  log(`F3a 캘리브레이션 — ${years.map((y) => `${y}-07-01~08-31`).join(', ')}`);

  const allEvents: EventSummary[] = [];
  const gaugeSummaries: GaugeSummary[] = [];

  for (const pair of PAIRS) {
    const stages = await loadWaterStages(keys, pair.water.code);
    log(`\n## ${pair.valley} — 수위 ${pair.water.name} ${pair.water.code} (관심 ${stages.attwl} · 주의 ${stages.wrnwl} · 경계 ${stages.almwl} · 심각 ${stages.srswl} m)`);

    // 우량계별 요약 누적
    const acc = new Map<
      string,
      {
        gauge: RainGauge;
        events: EventSummary[];
        rainMissing: number;
        rainTotalCells: number;
        rel: { rule: ReleaseSim[]; rainOnly: ReleaseSim[]; strict: ReleaseSim[] };
        stageReached: WaterResponse['stageReached'][];
      }
    >();
    for (const g of pair.rain) acc.set(g.code, { gauge: g, events: [], rainMissing: 0, rainTotalCells: 0, rel: { rule: [], rainOnly: [], strict: [] }, stageReached: [] });

    for (const p of periods) {
      const wl = await loadHrfcoWaterlevel(keys, pair.water.code, p.days, p.grid);
      const wlMissing = wl.filter((v) => v === null).length;
      log(`- ${p.year}: 수위 ${p.grid.n} 칸 중 결측 ${wlMissing}`);

      const rainByGauge = new Map<string, RainSeries>();
      for (const g of pair.rain) {
        const r10 = await loadRain(keys, g, p.days, p.grid);
        rainByGauge.set(g.code, deriveRain(r10));
        const a = acc.get(g.code);
        if (a) {
          a.rainMissing += r10.filter((v) => v === null).length;
          a.rainTotalCells += r10.length;
        }
      }

      for (const g of pair.rain) {
        const rs = rainByGauge.get(g.code);
        const a = acc.get(g.code);
        if (!rs || !a) continue;
        const events = extractEvents(rs);
        for (const ev of events) {
          const resp = waterResponse(ev, wl, stages);
          const isCase = ev.stageIdx.attention !== null;
          const outcome: Record<string, Outcome> = {};
          const outcomeTotal: Record<string, Outcome> = {};
          for (const v of VARIANTS) {
            outcome[v.id] = classify(ev.variantIdx[v.id] ?? null, wl, resp);
            outcomeTotal[v.id] = classifyTotal(ev.variantIdx[v.id] ?? null, resp);
          }
          const cautionIdx = ev.stageIdx.caution;
          let release: EventSummary['release'] = { rule: null, rainOnly: null, strict: null };
          if (cautionIdx !== null) {
            const rule = simulateRelease(ev, cautionIdx, rs, wl, resp, 'rule');
            const rainOnly = simulateRelease(ev, cautionIdx, rs, wl, resp, 'rainOnly');
            const strict = simulateRelease(ev, cautionIdx, rs, wl, resp, 'strict');
            a.rel.rule.push(rule);
            a.rel.rainOnly.push(rainOnly);
            a.rel.strict.push(strict);
            release = { rule: relSummary(p.grid, rule), rainOnly: relSummary(p.grid, rainOnly), strict: relSummary(p.grid, strict) };
          }
          const cooccur: Record<string, boolean> = {};
          const attIdx = ev.stageIdx.attention;
          if (attIdx !== null) {
            for (const other of pair.rain) {
              if (other.code === g.code) continue;
              const ors = rainByGauge.get(other.code);
              if (!ors) continue;
              let yes = false;
              for (let k = Math.max(0, attIdx - 6); k <= Math.min(p.grid.n - 1, attIdx + 6); k++) if ((ors.r60[k] ?? 0) >= 10) yes = true;
              cooccur[other.code] = yes;
            }
          }
          if (isCase) a.stageReached.push(resp.stageReached);
          const s: EventSummary = {
            year: p.year,
            pair: pair.id,
            gauge: g.code,
            gaugeName: g.name,
            start: at(p.grid, ev.startIdx) ?? '',
            end: at(p.grid, ev.endIdx) ?? '',
            durationMin: (ev.endIdx - ev.firstWetIdx + 1) * 10,
            totalMm: ev.totalMm,
            maxR10: ev.maxR10,
            maxR60: ev.maxR60,
            maxR180: ev.maxR180,
            isCase,
            stageAt: Object.fromEntries(STAGE_IDS.map((k) => [k, at(p.grid, ev.stageIdx[k])])) as Record<StageId, string | null>,
            water: {
              baselineM: resp.baselineWl,
              reactAt: at(p.grid, resp.reactIdx),
              reactCumAt: at(p.grid, resp.reactCumIdx),
              peakAt: at(p.grid, resp.peakIdx),
              peakM: resp.peakWl,
              riseM: resp.riseM,
              maxDelta10M: resp.maxDelta10M,
              stageReached: resp.stageReached,
              attwlAt: at(p.grid, resp.attwlIdx),
              rise2hAny: resp.rise2hAny,
              missingRatio: resp.missingRatio,
            },
            leadMin: {
              fromStart: minutesBetween(resp.reactIdx, ev.startIdx),
              fromAttention: minutesBetween(resp.reactIdx, ev.stageIdx.attention),
              fromCaution: minutesBetween(resp.reactIdx, ev.stageIdx.caution),
            },
            leadCumMin: {
              fromStart: minutesBetween(resp.reactCumIdx, ev.startIdx),
              fromCaution: minutesBetween(resp.reactCumIdx, ev.stageIdx.caution),
            },
            outcome,
            outcomeTotal,
            release,
            cooccur,
          };
          a.events.push(s);
          allEvents.push(s);
        }
      }
    }

    for (const g of pair.rain) {
      const a = acc.get(g.code);
      if (!a) continue;
      const cases = a.events.filter((e) => e.isCase);
      const confusion: Record<string, Confusion> = {};
      const confusionTotal: Record<string, Confusion> = {};
      for (const v of VARIANTS) {
        const c = emptyConfusion();
        const ct = emptyConfusion();
        for (const e of a.events) {
          c[e.outcome[v.id] ?? 'TN']++;
          ct[e.outcomeTotal[v.id] ?? 'TN']++;
        }
        confusion[v.id] = c;
        confusionTotal[v.id] = ct;
      }
      const relStat = (xs: ReleaseSim[]) => ({
        n: xs.length,
        beforePeak: xs.filter((r) => r.beforePeak).length,
        reRise10: xs.filter((r) => (r.reRiseM ?? 0) >= 0.1).length,
      });
      const cooccur: Record<string, { n: number; yes: number }> = {};
      for (const e of cases) {
        for (const [code, yes] of Object.entries(e.cooccur)) {
          const c = cooccur[code] ?? { n: 0, yes: 0 };
          c.n++;
          if (yes) c.yes++;
          cooccur[code] = c;
        }
      }
      const summary: GaugeSummary = {
        pair: pair.id,
        valley: pair.valley,
        gauge: g.code,
        gaugeName: g.name,
        note: g.note,
        years,
        rainMissingRatio: a.rainTotalCells ? Math.round((a.rainMissing / a.rainTotalCells) * 1000) / 1000 : 0,
        events: a.events.length,
        cases: cases.length,
        casesWithReaction: cases.filter((e) => e.water.reactAt !== null).length,
        casesWithoutReaction: cases.filter((e) => e.water.reactAt === null).length,
        eventsWithReactionNoCase: a.events.filter((e) => !e.isCase && e.water.reactAt !== null).length,
        lead: {
          fromStart: leadStats(cases.map((e) => e.leadMin.fromStart)),
          fromAttention: leadStats(cases.map((e) => e.leadMin.fromAttention)),
          fromCaution: leadStats(cases.map((e) => e.leadMin.fromCaution)),
        },
        leadCum: {
          fromStart: leadStats(cases.map((e) => e.leadCumMin.fromStart)),
          fromCaution: leadStats(cases.map((e) => e.leadCumMin.fromCaution)),
        },
        confusion,
        confusionTotal,
        release: { rule: relStat(a.rel.rule), rainOnly: relStat(a.rel.rainOnly), strict: relStat(a.rel.strict) },
        waterStage: {
          attwl: a.stageReached.filter((s) => s !== 'none').length,
          wrnwl: a.stageReached.filter((s) => s === 'caution' || s === 'alert' || s === 'severe').length,
          almwl: a.stageReached.filter((s) => s === 'alert' || s === 'severe').length,
          srswl: a.stageReached.filter((s) => s === 'severe').length,
        },
        cooccur,
      };
      gaugeSummaries.push(summary);
      const L = summary.lead;
      log(
        `- ${g.name} ${g.code}: 이벤트 ${summary.events} · 사례(1h≥10) ${summary.cases} · 수위 반응 ${summary.casesWithReaction}` +
          ` · 리드(주의) 중앙값 ${L.fromCaution.median ?? '—'} 분 (n=${L.fromCaution.n}, ≥30분 ${L.fromCaution.ge30}, 음수 ${L.fromCaution.negative})` +
          ` · 리드(시작) 중앙값 ${L.fromStart.median ?? '—'} 분 (≥30분 ${L.fromStart.ge30}/${L.fromStart.n})`,
      );
    }
  }

  // 하류 수위가 없는 우량계 — 이벤트 통계만
  const rainOnlyStats: { gauge: string; name: string; note: string; year: number; events: number; cases: number; caution: number; alert: number; severe: number; maxR60: number; maxR180: number; missingRatio: number }[] = [];
  for (const g of RAIN_ONLY) {
    for (const p of periods) {
      const r10 = await loadRain(keys, g, p.days, p.grid);
      const rs = deriveRain(r10);
      const evs = extractEvents(rs);
      rainOnlyStats.push({
        gauge: g.code,
        name: g.name,
        note: g.note,
        year: p.year,
        events: evs.length,
        cases: evs.filter((e) => e.stageIdx.attention !== null).length,
        caution: evs.filter((e) => e.stageIdx.caution !== null).length,
        alert: evs.filter((e) => e.stageIdx.alert !== null).length,
        severe: evs.filter((e) => e.stageIdx.severe !== null).length,
        maxR60: Math.max(0, ...evs.map((e) => e.maxR60)),
        maxR180: Math.max(0, ...evs.map((e) => e.maxR180)),
        missingRatio: Math.round((r10.filter((v) => v === null).length / r10.length) * 1000) / 1000,
      });
    }
  }

  const out = { generatedAt: new Date().toISOString(), years, pairs: PAIRS, gaugeSummaries, rainOnly: rainOnlyStats, events: allEvents };
  fs.writeFileSync(path.join(HERE, 'results.json'), `${JSON.stringify(out, null, 1)}\n`);
  fs.writeFileSync(path.join(HERE, 'results.md'), renderMarkdown(years, gaugeSummaries, rainOnlyStats, allEvents));
  log(`\nresults.json · results.md 저장 (${allEvents.length} 이벤트)`);
}

const f1 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : String(Math.round(v * 10) / 10));
const f2 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(2));
const t = (s: string | null): string => s ?? '—';

function renderMarkdown(
  years: number[],
  sums: GaugeSummary[],
  rainOnly: { gauge: string; name: string; note: string; year: number; events: number; cases: number; caution: number; alert: number; severe: number; maxR60: number; maxR180: number; missingRatio: number }[],
  events: EventSummary[],
): string {
  const L: string[] = [];
  L.push(`# F3a 결과 — ${years.map((y) => `${y}-07-01~08-31`).join(', ')} (\`pnpm research:calibration\` 산출물, 손으로 고치지 않는다)`);
  L.push('');
  L.push('용어: **이벤트** = 6시간 무강우로 끊은 강우 묶음(총 ≥ 3 mm) · **사례** = 1h 합 ≥ 10 mm(관심 도달) 이벤트 · **반응** = 하류 10분 Δ ≥ +5 cm 첫 시각 · **리드** = 반응 − 기준 시각(분, 양수면 강우 신호가 먼저).');
  L.push('');
  L.push('## 1. 쌍별 요약');
  L.push('');
  L.push('| 계곡 | 우량계 | 위치 | 이벤트 | 사례 | 반응 있음 | 반응 없음 | 리드(시작) 중앙/최소/최대 · ≥30 | 리드(관심) 중앙/최소 · ≥30 | 리드(주의) 중앙/최소 · ≥30 · 음수 | 누적+10cm 리드(시작) 중앙/최소 · ≥30 | 누적+10cm 리드(주의) 중앙/최소 · ≥30 · 음수 | 수위 attwl/wrnwl 도달 |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const s of sums) {
    const ls = (x: LeadStats): string => `${f1(x.median)}/${f1(x.min)}/${f1(x.max)} · ${x.ge30}/${x.n}`;
    const lc = (x: LeadStats): string => `${f1(x.median)}/${f1(x.min)} · ${x.ge30}/${x.n} · ${x.negative}`;
    L.push(
      `| ${s.valley} | ${s.gaugeName} \`${s.gauge}\` | ${s.note} | ${s.events} | ${s.cases} | ${s.casesWithReaction} | ${s.casesWithoutReaction} | ${ls(s.lead.fromStart)} | ${f1(s.lead.fromAttention.median)}/${f1(s.lead.fromAttention.min)} · ${s.lead.fromAttention.ge30}/${s.lead.fromAttention.n} | ${lc(s.lead.fromCaution)} | ${f1(s.leadCum.fromStart.median)}/${f1(s.leadCum.fromStart.min)} · ${s.leadCum.fromStart.ge30}/${s.leadCum.fromStart.n} | ${lc(s.leadCum.fromCaution)} | ${s.waterStage.attwl}/${s.waterStage.wrnwl} |`,
    );
  }
  L.push('');
  L.push('## 2. 혼동행렬 — 임계값 변형별 (이벤트 단위)');
  L.push('');
  L.push('정답 A(§ F3a 방법 4) = 경보 시각 뒤 2시간 안 하류 수위 +10 cm. **TP** 맞음 · **LATE** 경보 뒤엔 안 올랐지만 이벤트 안 어딘가에서 2시간 +10 cm 가 있었음(경보가 늦었거나 이미 오른 뒤) · **FP** 경보 났는데 이벤트 내내 +10 cm 없음 · **FN** 경보 없이 +10 cm · **TN** 둘 다 없음. 정밀도 = TP/(TP+LATE+FP), 재현율 = TP/(TP+LATE+FN). 정답 B(보조) = 이벤트 창 총 상승(피크 − 기저) ≥ 10 cm — 느린 상승도 정답으로 센다.');
  L.push('');
  for (const s of sums) {
    L.push(`### ${s.valley} — ${s.gaugeName} \`${s.gauge}\` → 수위`);
    L.push('');
    L.push('| 변형 | A: TP | LATE | FP | FN | TN | 정밀도 | 재현율 | B: TP | FP | FN | TN | 정밀도 | 재현율 |');
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const v of VARIANTS) {
      const c = s.confusion[v.id] ?? emptyConfusion();
      const prec = c.TP + c.LATE + c.FP ? (c.TP / (c.TP + c.LATE + c.FP)).toFixed(2) : '—';
      const rec = c.TP + c.LATE + c.FN ? (c.TP / (c.TP + c.LATE + c.FN)).toFixed(2) : '—';
      const b = s.confusionTotal[v.id] ?? emptyConfusion();
      const precB = b.TP + b.FP ? (b.TP / (b.TP + b.FP)).toFixed(2) : '—';
      const recB = b.TP + b.FN ? (b.TP / (b.TP + b.FN)).toFixed(2) : '—';
      L.push(`| ${v.label} | ${c.TP} | ${c.LATE} | ${c.FP} | ${c.FN} | ${c.TN} | ${prec} | ${rec} | ${b.TP} | ${b.FP} | ${b.FN} | ${b.TN} | ${precB} | ${recB} |`);
    }
    L.push('');
  }
  L.push('## 3. 해제 규칙 — 주의 경보가 난 이벤트에서');
  L.push('');
  L.push('§1.2 규칙 = 강우 < 관심 30분 연속 ∧ 수위 하강 60분 연속. 비교로 강우 조건만 쓴 경우, 그리고 강화안(규칙 + 3h 합 < 20 mm). **피크 전 해제** = 해제 시각이 창 안 최고 수위보다 앞섬 · **재상승 ≥10 cm** = 해제 뒤 수위가 해제 시점보다 10 cm 이상 다시 오름(해제가 12시간 안에 성립하지 않으면 n 에서 빠진다).');
  L.push('');
  L.push('| 계곡 | 우량계 | 주의 이벤트 | 규칙: 해제 n · 피크 전 · 재상승≥10 | 강우만: 해제 n · 피크 전 · 재상승≥10 | 강화안(+3h<20): 해제 n · 피크 전 · 재상승≥10 |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  for (const s of sums) {
    const r = (x: { n: number; beforePeak: number; reRise10: number }): string => `${x.n} · ${x.beforePeak} · ${x.reRise10}`;
    L.push(`| ${s.valley} | ${s.gaugeName} | ${s.release.rule.n} | ${r(s.release.rule)} | ${r(s.release.rainOnly)} | ${r(s.release.strict)} |`);
  }
  L.push('');
  L.push('## 4. 같은 쌍 안 우량계 동시성 — 사례의 관심 시각 ±1시간 안에 다른 우량계도 1h 10 mm 를 넘겼는가');
  L.push('');
  L.push('| 계곡 | 기준 우량계 | 상대 우량계 | 동시 / 사례 |');
  L.push('| --- | --- | --- | --- |');
  for (const s of sums) {
    for (const [code, c] of Object.entries(s.cooccur)) {
      const other = sums.find((x) => x.pair === s.pair && x.gauge === code);
      L.push(`| ${s.valley} | ${s.gaugeName} | ${other?.gaugeName ?? code} | ${c.yes}/${c.n} |`);
    }
  }
  L.push('');
  L.push('## 5. 하류 수위 없는 우량계 — 이벤트 통계');
  L.push('');
  L.push('| 우량계 | 계곡 | 연도 | 이벤트 | 사례(관심) | 주의 | 경계 | 심각 | 최대 1h | 최대 3h | 결측 |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rainOnly) {
    L.push(`| ${r.name} \`${r.gauge}\` | ${r.note} | ${r.year} | ${r.events} | ${r.cases} | ${r.caution} | ${r.alert} | ${r.severe} | ${f1(r.maxR60)} | ${f1(r.maxR180)} | ${(r.missingRatio * 100).toFixed(1)}% |`);
  }
  L.push('');
  L.push('## 6. 사례 표 — 이벤트별 (사례만, 시각 KST)');
  L.push('');
  for (const s of sums) {
    const rows = events.filter((e) => e.pair === s.pair && e.gauge === s.gauge && e.isCase);
    L.push(`### ${s.valley} — ${s.gaugeName} \`${s.gauge}\` (사례 ${rows.length})`);
    L.push('');
    L.push('| 연도 | 시작 | 끝 | 총 mm | 최대 10분/1h/3h | 관심 | 주의 | 경계 | 심각 | 기저 m | 반응 Δ10≥5 | 반응 누적+10 | 피크 (m, +cm) | 최대 Δ10 | 수위 단계 | 리드 시작/관심/주의 | 누적 리드 시작/주의 | 주의·경계·심각 판정(A) | 해제(규칙) |');
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const e of rows) {
      const rel = e.release.rule ? `${t(e.release.rule.at)}${e.release.rule.beforePeak ? ' ⚠피크 전' : ''}${(e.release.rule.reRiseM ?? 0) >= 0.1 ? ` 재상승 +${Math.round((e.release.rule.reRiseM ?? 0) * 100)}` : ''}` : '—';
      L.push(
        `| ${e.year} | ${e.start} | ${e.end} | ${f1(e.totalMm)} | ${f1(e.maxR10)}/${f1(e.maxR60)}/${f1(e.maxR180)} | ${t(e.stageAt.attention)} | ${t(e.stageAt.caution)} | ${t(e.stageAt.alert)} | ${t(e.stageAt.severe)} | ${f2(e.water.baselineM)} | ${t(e.water.reactAt)} | ${t(e.water.reactCumAt)} | ${t(e.water.peakAt)} (${f2(e.water.peakM)}, +${e.water.riseM === null ? '—' : Math.round(e.water.riseM * 100)}) | ${e.water.maxDelta10M === null ? '—' : `${Math.round(e.water.maxDelta10M * 100)} cm`} | ${e.water.stageReached === 'none' ? '—' : STAGE_LABEL[e.water.stageReached]} | ${f1(e.leadMin.fromStart)}/${f1(e.leadMin.fromAttention)}/${f1(e.leadMin.fromCaution)} | ${f1(e.leadCumMin.fromStart)}/${f1(e.leadCumMin.fromCaution)} | ${e.outcome['caution']}·${e.outcome['alert']}·${e.outcome['severe']} | ${rel} |`,
      );
    }
    L.push('');
  }
  return `${L.join('\n')}\n`;
}

main().catch((e: unknown) => {
  warn(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
