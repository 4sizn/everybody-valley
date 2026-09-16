import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../../..');
export const HERE = import.meta.dirname;
export const CACHE_DIR = path.join(HERE, '.cache');

/** `.env.local` 을 dotenv 없이 읽는다. 값 뒤의 `  # 주석` 을 떼고, 따옴표를 벗긴다. 값은 절대 로그에 쓰지 않는다. */
export function loadEnvLocal(): Record<string, string> {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) throw new Error(`.env.local 이 없다: ${file}`);
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(raw);
    if (!m) continue;
    const key = m[1] ?? '';
    let value = (m[2] ?? '').replace(/\s+#.*$/, '').trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (value) out[key] = value;
  }
  return out;
}

export interface Keys {
  hrfco: string;
  kma: string;
  vworld: string;
}

export function requireKeys(): Keys {
  const env = loadEnvLocal();
  const need = (k: string): string => {
    const v = env[k];
    if (!v) throw new Error(`.env.local 에 ${k} 가 비어 있다`);
    return v;
  };
  return { hrfco: need('HRFCO_API_KEY'), kma: need('KMA_APIHUB_KEY'), vworld: need('VWORLD_API_KEY') };
}

/** 오류 메시지·URL 에 키가 섞여 나가지 않도록 가린다. */
export function redact(text: string, keys: Keys): string {
  let t = text;
  for (const k of [keys.hrfco, keys.kma, keys.vworld]) if (k) t = t.split(k).join('<KEY>');
  return t;
}
