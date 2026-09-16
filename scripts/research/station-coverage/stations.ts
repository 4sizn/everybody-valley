import { cached } from './cache.ts';
import type { Keys } from './env.ts';
import { dmsSuspicious, dmsToDecimal } from './geo.ts';
import { fetchJson, fetchText } from './http.ts';
import { warn } from './log.ts';

export type StationKind = 'rain-hrfco' | 'rain-kma' | 'waterlevel-hrfco';

export interface Station {
  kind: StationKind;
  code: string;
  name: string;
  lng: number;
  lat: number;
  /** 제원에 있는 표고(m). HRFCO 강우 관측소는 없음 → 표고 타일에서 채운다. */
  elevSpec?: number;
  /** 제원 좌표 표기가 의심스러움(초 ≥ 60 등). */
  suspicious?: boolean;
  agency?: string;
}

interface HrfcoWl {
  wlobscd: string;
  obsnm: string;
  agcnm: string;
  addr: string;
  lon: string;
  lat: string;
  gdt: string;
}
interface HrfcoRf {
  rfobscd: string;
  obsnm: string;
  agcnm: string;
  addr: string;
  lon: string;
  lat: string;
}

/** 한강홍수통제소 관측소 제원. 원본 응답은 `.cache/` 에만 둔다(재배포 금지). */
export async function loadHrfco(keys: Keys): Promise<{ rain: Station[]; waterlevel: Station[] }> {
  const wl = await cached<HrfcoWl[]>('hrfco-waterlevel-info.json', async () => {
    const j = await fetchJson<{ content: HrfcoWl[] }>(`https://api.hrfco.go.kr/${keys.hrfco}/waterlevel/info.json`, keys);
    return j.content;
  });
  const rf = await cached<HrfcoRf[]>('hrfco-rainfall-info.json', async () => {
    const j = await fetchJson<{ content: HrfcoRf[] }>(`https://api.hrfco.go.kr/${keys.hrfco}/rainfall/info.json`, keys);
    return j.content;
  });
  const toStation = (kind: StationKind, code: string, r: { obsnm: string; agcnm: string; lon: string; lat: string; gdt?: string }): Station | undefined => {
    const lng = dmsToDecimal(r.lon);
    const lat = dmsToDecimal(r.lat);
    if (lng === undefined || lat === undefined) return undefined;
    const s: Station = { kind, code, name: r.obsnm.trim(), lng, lat, agency: r.agcnm };
    const gdt = Number.parseFloat(r.gdt ?? '');
    if (Number.isFinite(gdt)) s.elevSpec = gdt;
    if (dmsSuspicious(r.lon) || dmsSuspicious(r.lat)) s.suspicious = true;
    return s;
  };
  const waterlevel = wl.map((r) => toStation('waterlevel-hrfco', r.wlobscd, r)).filter((s): s is Station => s !== undefined);
  const rain = rf.map((r) => toStation('rain-hrfco', r.rfobscd, r)).filter((s): s is Station => s !== undefined);
  warn(`HRFCO 수위 ${wl.length}→좌표 있음 ${waterlevel.length} · 강우 ${rf.length}→${rain.length}`);
  return { rain, waterlevel };
}

/**
 * 기상청 API허브 AWS 지점정보. EUC-KR, `#` 주석 + 공백 구분 컬럼(help=1 로 확인: STN_ID LON LAT STN_SP HT HT_WD LAU_ID STN_AD STN_KO STN_EN FCT_ID LAW_ID BASIN LAW_ADDR).
 * 지점명(STN_KO)에는 공백이 없어 9번째 토큰으로 읽는다.
 */
export async function loadKmaAws(keys: Keys): Promise<Station[]> {
  const text = await cached<string>('kma-aws-stn-inf.json', async () => {
    const tm = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '').slice(0, 12);
    return fetchText(
      `https://apihub.kma.go.kr/api/typ01/url/stn_inf.php?inf=AWS&stn=&tm=${tm}&help=0&authKey=${keys.kma}`,
      keys,
      'euc-kr',
    );
  });
  const out: Station[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const t = line.trim().split(/\s+/);
    const code = t[0] ?? '';
    const lng = Number(t[1]);
    const lat = Number(t[2]);
    const ht = Number(t[4]);
    const name = t[8] ?? '';
    if (!/^\d+$/.test(code) || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const s: Station = { kind: 'rain-kma', code, name, lng, lat, agency: '기상청 AWS' };
    if (Number.isFinite(ht) && ht > -90) s.elevSpec = ht;
    out.push(s);
  }
  warn(`KMA AWS 지점 ${out.length}`);
  return out;
}
