/**
 * `ALL /api/vworld/*` — 브이월드 프록시. 키 은닉·허용목록·저장 금지(no-store).
 *
 * 응답 본문은 스트림으로 흘려보내고 어디에도 쓰지 않는다. 로그에는 서비스 이름·상태·소요 시간만 남기며,
 * 업스트림 URL 은 `Redactor` 를 거친 뒤 debug 레벨로만 남긴다.
 */
import type { Logger } from '@modu-valley/core';
import { type Context, Hono } from 'hono';
import type { Redactor } from '../../logging/redact';
import {
  PASSTHROUGH_RESPONSE_HEADERS,
  resolveVworldUpstream,
  type VworldCredentials,
} from '../../vworld/allowlist';

export interface VworldRouteDeps {
  readonly credentials: VworldCredentials | undefined;
  readonly logger: Logger;
  readonly redact: Redactor;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly now?: () => number;
}

const USER_AGENT = 'modu-valley-server/0.1 (+https://github.com/4sizn/modu-valley)';

/** 클라이언트 요청 헤더 중 업스트림에 넘길 것. */
const FORWARD_REQUEST_HEADERS = ['accept', 'content-type', 'accept-language'] as const;

async function upstreamInit(c: Context, timeoutMs: number): Promise<RequestInit> {
  const headers = new Headers({ 'user-agent': USER_AGENT });
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = c.req.header(name);
    if (v) headers.set(name, v);
  }
  const method = c.req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'manual',
  };
  if (method === 'POST') init.body = await c.req.arrayBuffer();
  return init;
}

/** 허용한 헤더만 옮기고 `no-store` 를 붙인다(브이월드 약관 §19 데이터 저장 금지). */
function relay(upstream: Response, service: string, method: string): Response {
  const out = new Headers();
  for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) out.set(name, v);
  }
  out.set('cache-control', 'no-store');
  out.set('x-upstream-service', `vworld:${service}`);
  return new Response(method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

function rejection(c: Context, reason: 'not-allowed' | 'method-not-allowed'): Response {
  return reason === 'method-not-allowed'
    ? c.json({ error: 'method_not_allowed' }, 405)
    : c.json({ error: 'not_allowed', allowed: ['wfs', 'wms', 'search', 'address'] }, 404);
}

export function vworldRoutes(deps: VworldRouteDeps): Hono {
  const app = new Hono();
  const doFetch = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 20_000;
  const now = deps.now ?? Date.now;

  app.all('/*', async (c) => {
    if (deps.credentials === undefined) return c.json({ error: 'vworld_key_missing' }, 503);
    const subpath = c.req.path.replace(/^\/api\/vworld\/?/, '');
    const query = new URL(c.req.url).search;
    const resolved = resolveVworldUpstream(subpath, query, c.req.method, deps.credentials);
    if (!resolved.ok) return rejection(c, resolved.reason);

    const init = await upstreamInit(c, timeoutMs);
    const startedAt = now();
    try {
      const upstream = await doFetch(resolved.url, init);
      deps.logger.debug('vworld proxied', {
        service: resolved.service,
        status: upstream.status,
        ms: now() - startedAt,
        url: deps.redact(resolved.url.toString()),
      });
      return relay(upstream, resolved.service, init.method ?? 'GET');
    } catch (error) {
      deps.logger.warn('vworld upstream failed', {
        service: resolved.service,
        ms: now() - startedAt,
        error: deps.redact(error instanceof Error ? error.message : String(error)),
      });
      return c.json({ error: 'upstream_unavailable' }, 502);
    }
  });

  return app;
}
