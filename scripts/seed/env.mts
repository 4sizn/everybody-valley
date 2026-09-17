/**
 * 시딩 스크립트 환경 — 경로와 `.env.local` 키 (SD1 (h)).
 *
 * 키는 저장소 루트 `.env.local`(gitignore)에서만 읽고, 값은 로그·오류 메시지에 절대 싣지 않는다
 * (`redact`). `scripts/research/station-coverage/env.ts` 와 같은 규약을 `.mts` 로 옮겼다 —
 * 루트 package.json 은 `type: module` 이 아니라 top-level await 스크립트는 `.mts` 여야 한다.
 */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const HERE = import.meta.dirname;
/** 응답 캐시(Overpass·Terrarium). 브이월드 응답은 **저장하지 않는다**(약관 §19) — 통계만 남긴다. */
export const CACHE_DIR = path.join(HERE, '.cache');
export const DATA_DIR = path.join(ROOT, 'data');
export const SEED_DIR = path.join(DATA_DIR, 'seed');
export const VALLEYS_DIR = path.join(DATA_DIR, 'valleys');
export const FACILITIES_DIR = path.join(DATA_DIR, 'facilities');
export const SHADE_DIR = path.join(DATA_DIR, 'shade');
/** 사용자가 내려받은 표준데이터 CSV(gitignore). */
export const STD_DIR = path.join(SEED_DIR, 'std');

/** `.env.local` 을 dotenv 없이 읽는다. 값 뒤의 `  # 주석` 을 떼고 따옴표를 벗긴다. */
export function loadEnvLocal(): Record<string, string> {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(raw);
    if (!match) continue;
    const key = match[1] ?? '';
    let value = (match[2] ?? '').replace(/\s+#.*$/, '').trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (value) out[key] = value;
  }
  return out;
}

export interface Keys {
  /** 브이월드 개발키. 없으면 하천망 비교·유역 조회를 건너뛴다. */
  readonly vworld: string | undefined;
  /** 공공데이터포털 인증키(Encoding). 없으면 관광정보 시딩을 건너뛴다. */
  readonly dataGoKr: string | undefined;
}

export function loadKeys(): Keys {
  const env = loadEnvLocal();
  return {
    vworld: env['VWORLD_API_KEY'],
    dataGoKr: env['DATA_GO_KR_KEY_ENCODING'] ?? env['DATA_GO_KR_KEY_DECODING'],
  };
}

/** 오류 메시지·URL 에 키가 섞여 나가지 않도록 가린다. */
export function redact(text: string, keys: Keys): string {
  let out = text;
  for (const key of [keys.vworld, keys.dataGoKr]) if (key) out = out.split(key).join('<KEY>');
  return out;
}

/** 오늘 KST 날짜 'YYYY-MM-DD' — datasetVersion·collectedAt 의 재료. */
export function todayKst(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
