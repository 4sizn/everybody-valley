import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from './env.ts';

function ensureDir(p: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

export function readJson<T>(rel: string): T | undefined {
  const p = path.join(CACHE_DIR, rel);
  if (!fs.existsSync(p)) return undefined;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

export function writeJson(rel: string, value: unknown): void {
  const p = path.join(CACHE_DIR, rel);
  ensureDir(p);
  fs.writeFileSync(p, JSON.stringify(value));
}

export function readBytes(rel: string): Buffer | undefined {
  const p = path.join(CACHE_DIR, rel);
  return fs.existsSync(p) ? fs.readFileSync(p) : undefined;
}

export function writeBytes(rel: string, bytes: Buffer): void {
  const p = path.join(CACHE_DIR, rel);
  ensureDir(p);
  fs.writeFileSync(p, bytes);
}

/** 캐시가 있으면 그대로, 없으면 만들어 저장. */
export async function cached<T>(rel: string, make: () => Promise<T>): Promise<T> {
  const hit = readJson<T>(rel);
  if (hit !== undefined) return hit;
  const v = await make();
  writeJson(rel, v);
  return v;
}
