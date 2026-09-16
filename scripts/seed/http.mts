/**
 * 호스트별 최소 간격을 지키는 fetch + 디스크 캐시.
 *
 * 간격(SD1 지시): Overpass 는 요청 간 1 s 이상, 브이월드 WFS 는 100 ms 이상.
 * 실패는 3회까지 지수 백오프로 재시도하고, 오류 메시지의 키는 가린다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, type Keys, redact } from './env.mts';

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const OVERPASS_GAP_MS = 1100;
export const VWORLD_GAP_MS = 150;
export const TERRARIUM_GAP_MS = 50;

const lastCall = new Map<string, number>();

export async function fetchBytes(
  url: string,
  keys: Keys,
  minGapMs: number,
  init?: RequestInit,
): Promise<Buffer> {
  const host = new URL(url).host;
  const last = lastCall.get(host) ?? 0;
  const wait = last + minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    lastCall.set(host, Date.now());
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = (await response.text()).slice(0, 200);
        throw new Error(`HTTP ${response.status} ${redact(url, keys)} ${redact(body, keys)}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      await sleep(1500 * 2 ** attempt);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(redact(message, keys));
}

export async function fetchJson<T>(
  url: string,
  keys: Keys,
  minGapMs: number,
  init?: RequestInit,
): Promise<T> {
  const text = (await fetchBytes(url, keys, minGapMs, init)).toString('utf8');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSON 아님 (${redact(url, keys)}): ${redact(text.slice(0, 200), keys)}`);
  }
}

// ── 캐시 ─────────────────────────────────────────────────────────────

function cachePath(rel: string): string {
  return path.join(CACHE_DIR, rel);
}

export function readCachedJson<T>(rel: string): T | undefined {
  const file = cachePath(rel);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeCachedJson(rel: string, value: unknown): void {
  const file = cachePath(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

export function readCachedBytes(rel: string): Buffer | undefined {
  const file = cachePath(rel);
  return fs.existsSync(file) ? fs.readFileSync(file) : undefined;
}

export function writeCachedBytes(rel: string, bytes: Buffer): void {
  const file = cachePath(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}

/** 캐시가 있으면 그대로, 없으면 만들어 저장. `--refresh` 는 호출자가 캐시 파일을 지워 처리한다. */
export async function cached<T>(rel: string, make: () => Promise<T>): Promise<T> {
  const hit = readCachedJson<T>(rel);
  if (hit !== undefined) return hit;
  const value = await make();
  writeCachedJson(rel, value);
  return value;
}
