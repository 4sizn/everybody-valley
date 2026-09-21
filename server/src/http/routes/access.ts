/**
 * `GET /api/access` — 계곡 전부의 출입(입산) 통제 상태. `data/access/*.json`(시더 `pnpm seed:access`
 * 산출, 계곡 기준으로 이미 좁혀진 기록)을 서버 시작 시 한 번 읽어 core `evaluateAccess` 로
 * 오늘 날짜에 맞춘다. 기록이 하나도 없는 계곡은 `unknown` — "열림" 이 아니다(원칙).
 *
 * 파일이 늘면(가을 고시 적재) 서버를 다시 띄운다 — 계곡 파일과 같은 규칙.
 */
import fs from 'node:fs';
import path from 'node:path';
import { type AccessControl, evaluateAccess } from '@modu-valley/core';
import { Hono } from 'hono';
import { kstDayOf } from '../../db/repos';

export interface AccessRouteDeps {
  readonly accessDir: string;
  readonly valleyIds: ReadonlySet<string>;
  readonly now?: () => number;
}

/** `data/access/*.json` 의 `controls` 를 전부 모은다. 없는 디렉터리는 빈 목록. */
export function loadAccessControls(dir: string): readonly AccessControl[] {
  if (!fs.existsSync(dir)) return [];
  const out: AccessControl[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as {
        controls?: AccessControl[];
      };
      for (const c of parsed.controls ?? []) out.push(c);
    } catch {
      // 깨진 파일 하나가 전체를 막지 않게 — 시더가 쓴 파일만 놓이는 디렉터리다.
    }
  }
  return out;
}

export function accessRoutes(deps: AccessRouteDeps, cacheSec = 300): Hono {
  const app = new Hono();
  const now = deps.now ?? Date.now;
  const controls = loadAccessControls(deps.accessDir);
  const byValley = new Map<string, AccessControl[]>();
  for (const c of controls) {
    const list = byValley.get(c.valleyId) ?? [];
    list.push(c);
    byValley.set(c.valleyId, list);
  }

  app.get('/', (c) => {
    const nowIso = new Date(now()).toISOString();
    const today = kstDayOf(nowIso);
    const access = [...deps.valleyIds].sort().map((valleyId) => ({
      valleyId,
      ...evaluateAccess({ controls: byValley.get(valleyId) ?? [], today }),
    }));
    c.header('cache-control', `public, max-age=${cacheSec}`);
    return c.json({ count: access.length, now: nowIso, today, sources: controls.length, access });
  });
  return app;
}
