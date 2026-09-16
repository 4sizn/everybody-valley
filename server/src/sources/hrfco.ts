/**
 * 한강홍수통제소 수문 Open API 파서(`scripts/research/station-coverage/stations.ts` 재사용).
 *
 * - 제원 `waterlevel/info.json` · `rainfall/info.json` — 좌표가 `"128-33-04"` 도분초 문자열, 십진도로 변환해 저장.
 * - 최신 `waterlevel/list/10M.json` · `rainfall/list/10M.json` — 전체 관측소의 가장 최근 10분 값 1건씩(실측 1,203 · 628 행).
 *   한 호출로 끝나므로 분당 1,000건 한도와 무관하다.
 */
import type { ObservationRecord, StationRecord } from '../records';
import { kstYmdhmToIso } from '../time';

export const HRFCO_ORIGIN = 'https://api.hrfco.go.kr';

export type HrfcoKind = 'waterlevel' | 'rainfall';

export function hrfcoUrl(key: string, kind: HrfcoKind, resource: 'info' | 'list/10M'): string {
  return `${HRFCO_ORIGIN}/${key}/${kind}/${resource}.json`;
}

/** `"128-33-04"` → 십진도. 빈 값·`- -  -` 은 undefined. */
export function dmsToDecimal(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const parts = s
    .trim()
    .split('-')
    .map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return undefined;
  const [d, m, sec] = parts.map(Number) as [number, number, number];
  return d + m / 60 + sec / 3600;
}

/** 초·분이 60 이상인 오기(예 `37-20-91`). 값은 그대로 두고 표시만 한다. */
export function dmsSuspicious(s: string | undefined): boolean {
  if (!s) return false;
  const parts = s.trim().split('-').map(Number);
  return parts.length === 3 && ((parts[1] ?? 0) >= 60 || (parts[2] ?? 0) >= 60);
}

type Row = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const trimmed = (v: unknown): string | undefined => {
  const s = str(v)?.trim();
  return s ? s : undefined;
};

/** 수위 4단계·계획홍수위·홍수특보지점 여부 + 주소. 숫자 필드는 숫자로. */
const WL_NUMERIC = ['attwl', 'wrnwl', 'almwl', 'srswl', 'pfh'] as const;
const TEXT_ATTRS = ['fstnyn', 'addr', 'etcaddr'] as const;

function attrsOf(kind: HrfcoKind, row: Row): Readonly<Record<string, unknown>> | null {
  const attrs: Record<string, unknown> = {};
  if (kind === 'waterlevel') {
    for (const k of WL_NUMERIC) {
      const v = num(row[k]);
      if (v !== null) attrs[k] = v;
    }
  }
  for (const k of TEXT_ATTRS) {
    const v = trimmed(row[k]);
    if (v && (kind === 'waterlevel' || k !== 'fstnyn')) attrs[k] = v;
  }
  return Object.keys(attrs).length > 0 ? attrs : null;
}

const codeField = (kind: HrfcoKind): string => (kind === 'waterlevel' ? 'wlobscd' : 'rfobscd');
const stationKind = (kind: HrfcoKind): StationRecord['kind'] =>
  kind === 'waterlevel' ? 'hrfco-waterlevel' : 'hrfco-rainfall';

function stationOf(kind: HrfcoKind, row: Row): StationRecord | undefined {
  const code = trimmed(row[codeField(kind)]);
  const name = trimmed(row['obsnm']);
  if (!code || !name) return undefined;
  const lonRaw = str(row['lon']);
  const latRaw = str(row['lat']);
  return {
    kind: stationKind(kind),
    code,
    name,
    agency: trimmed(row['agcnm']) ?? null,
    lng: dmsToDecimal(lonRaw) ?? null,
    lat: dmsToDecimal(latRaw) ?? null,
    elevationM: kind === 'waterlevel' ? num(row['gdt']) : null,
    attrs: attrsOf(kind, row),
    suspicious: dmsSuspicious(lonRaw) || dmsSuspicious(latRaw),
  };
}

function latestOf(kind: HrfcoKind, row: Row): ObservationRecord | undefined {
  const code = trimmed(row[codeField(kind)]);
  const observedAt = kstYmdhmToIso(str(row['ymdhm']) ?? '');
  if (!code || !observedAt) return undefined;
  if (kind === 'rainfall') {
    return { kind: 'hrfco-rainfall', code, observedAt, value: num(row['rf']), extra: null };
  }
  const fw = num(row['fw']);
  return {
    kind: 'hrfco-waterlevel',
    code,
    observedAt,
    value: num(row['wl']),
    extra: fw === null ? null : { fw },
  };
}

function contentRows(kind: HrfcoKind, resource: string, body: unknown): Row[] {
  const content = (body as { content?: unknown })?.content;
  if (!Array.isArray(content)) throw new Error(`HRFCO ${kind}/${resource}: content 배열이 없다`);
  return content.filter((r): r is Row => typeof r === 'object' && r !== null);
}

export function parseHrfcoStations(kind: HrfcoKind, body: unknown): StationRecord[] {
  return contentRows(kind, 'info', body)
    .map((row) => stationOf(kind, row))
    .filter((s): s is StationRecord => s !== undefined);
}

export function parseHrfcoLatest(kind: HrfcoKind, body: unknown): ObservationRecord[] {
  return contentRows(kind, 'list/10M', body)
    .map((row) => latestOf(kind, row))
    .filter((o): o is ObservationRecord => o !== undefined);
}
