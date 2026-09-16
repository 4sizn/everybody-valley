import { type Keys, redact } from './env.ts';

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let lastCall = new Map<string, number>();

/** 호스트별 최소 간격을 지키며 fetch. 실패는 3회까지 재시도(지수 백오프). 오류 메시지의 키는 가린다. */
export async function fetchBytes(url: string, keys: Keys, minGapMs = 0): Promise<Buffer> {
  const host = new URL(url).host;
  const last = lastCall.get(host) ?? 0;
  const wait = last + minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    lastCall = new Map(lastCall).set(host, Date.now());
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${redact(url, keys)}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      await sleep(500 * 2 ** attempt);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(redact(msg, keys));
}

export async function fetchText(url: string, keys: Keys, encoding: 'utf8' | 'euc-kr' = 'utf8', minGapMs = 0): Promise<string> {
  const buf = await fetchBytes(url, keys, minGapMs);
  return encoding === 'euc-kr' ? new TextDecoder('euc-kr').decode(buf) : buf.toString('utf8');
}

export async function fetchJson<T>(url: string, keys: Keys, minGapMs = 0): Promise<T> {
  const text = await fetchText(url, keys, 'utf8', minGapMs);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSON 아님 (${redact(url, keys)}): ${text.slice(0, 200)}`);
  }
}
