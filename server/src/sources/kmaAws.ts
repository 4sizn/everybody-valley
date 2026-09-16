/**
 * 기상청 API허브 방재기상관측(AWS) 파서.
 *
 * - 매분자료 `nph-aws2_min?tm1&tm2&stn=0&disp=1` — 전체 지점 × 분. 실측: 10분 창 = 736 지점 × 11 분 ≈ 8,100 행,
 *   0.6 s, 795 KB. 컬럼: YYMMDDHHMI STN WD1 WS1 WDS WSS WD10 WS10 TA RE RN-15m RN-60m RN-12H RN-DAY HM PA PS TD.
 *   -50 이하는 결측. 행 끝에 `,=` 가 붙는다.
 *   **함정**: 긴 창(하루치)은 200 인 채로 중간에 끊긴다 — 종료 표식 `#7777END` 가 없으면 불완전으로 본다.
 * - 지점정보 `stn_inf.php?inf=AWS` — EUC-KR, `#` 주석 + 공백 구분(STN_ID LON LAT STN_SP HT HT_WD LAU_ID STN_AD STN_KO …).
 */
import type { ObservationRecord, StationRecord } from '../records';
import { kstYmdhmToIso } from '../time';

export const KMA_APIHUB_ORIGIN = 'https://apihub.kma.go.kr';

export function awsMinutesUrl(key: string, tm1: string, tm2: string): string {
  return `${KMA_APIHUB_ORIGIN}/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1}&tm2=${tm2}&stn=0&disp=1&help=0&authKey=${key}`;
}

export function awsStationsUrl(key: string, tm: string): string {
  return `${KMA_APIHUB_ORIGIN}/api/typ01/url/stn_inf.php?inf=AWS&stn=&tm=${tm}&help=0&authKey=${key}`;
}

export const AWS_END_MARK = '#7777END';

const MISSING_BELOW = -50;

function val(t: string | undefined): number | null {
  const n = Number(t);
  return Number.isFinite(n) && n > MISSING_BELOW ? n : null;
}

export interface AwsMinutesParse {
  readonly rows: ObservationRecord[];
  /** `#7777END` 가 있었는가. 없으면 잘린 응답이다. */
  readonly complete: boolean;
}

/** 지점당 1분 1행. value = RN-60m(mm), extra = { rn15, rn12h, rnDay, ta, re }. */
export function parseAwsMinutes(text: string): AwsMinutesParse {
  const rows: ObservationRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const t = line.split(',').map((s) => s.trim());
    if (t.length < 14 || !/^\d{12}$/.test(t[0] ?? '')) continue;
    const observedAt = kstYmdhmToIso(t[0] ?? '');
    const code = t[1];
    if (!observedAt || !code) continue;
    rows.push({
      kind: 'aws',
      code,
      observedAt,
      value: val(t[11]),
      extra: {
        rn15: val(t[10]),
        rn12h: val(t[12]),
        rnDay: val(t[13]),
        ta: val(t[8]),
        re: val(t[9]),
      },
    });
  }
  return { rows, complete: text.includes(AWS_END_MARK) };
}

/** 지점명(STN_KO)에는 공백이 없어 9번째 토큰으로 읽는다. 표고 -90 이하는 결측. */
export function parseAwsStations(text: string): StationRecord[] {
  const out: StationRecord[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const t = line.trim().split(/\s+/);
    const code = t[0] ?? '';
    const lng = Number(t[1]);
    const lat = Number(t[2]);
    const ht = Number(t[4]);
    const name = t[8] ?? '';
    if (!/^\d+$/.test(code) || !Number.isFinite(lng) || !Number.isFinite(lat) || !name) continue;
    out.push({
      kind: 'aws',
      code,
      name,
      agency: '기상청 AWS',
      lng,
      lat,
      elevationM: Number.isFinite(ht) && ht > -90 ? ht : null,
      attrs: null,
      suspicious: false,
    });
  }
  return out;
}
