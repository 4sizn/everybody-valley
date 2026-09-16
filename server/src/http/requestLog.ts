/**
 * 요청 로깅. 메서드·경로·상태·소요·IP 만 남기고 쿼리 문자열은 마스킹한 뒤 debug 로만 — 클라이언트가
 * 키를 보낼 일은 없지만 규약상 어떤 문자열도 `Redactor` 를 거치지 않고 로그에 닿지 않는다.
 */
import type { Logger } from '@modu-valley/core';
import type { MiddlewareHandler } from 'hono';
import type { Redactor } from '../logging/redact';
import { clientIp } from './rateLimit';

export interface RequestLogOptions {
  readonly logger: Logger;
  readonly redact: Redactor;
  readonly trustProxy: boolean;
  readonly now?: () => number;
}

export function requestLog(options: RequestLogOptions): MiddlewareHandler {
  const now = options.now ?? Date.now;
  return async (c, next) => {
    const startedAt = now();
    await next();
    const ms = now() - startedAt;
    const fields = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms,
      ip: clientIp(c, options.trustProxy),
    };
    if (c.res.status >= 500) options.logger.warn('request', fields);
    else options.logger.info('request', fields);
    const search = new URL(c.req.url).search;
    if (search)
      options.logger.debug('request query', { path: c.req.path, query: options.redact(search) });
  };
}
