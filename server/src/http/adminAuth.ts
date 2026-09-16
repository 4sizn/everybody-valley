/**
 * 관리자 인증 미들웨어(OPS1). 클라이언트가 보낸 `isAdmin` 류 플래그는 어디서도 신뢰하지
 * 않는다 — 유일한 권한 증명은 `Authorization: Bearer <token>` 이 `ADMIN_TOKEN`(환경변수)과
 * 일치하는 것뿐이다.
 *
 * `ADMIN_TOKEN` 이 설정되지 않은 서버는 관리자 API 자체가 없는 것처럼 404 를 낸다(존재를
 * 드러내지 않는다 — 503 은 "지금은 안 되지만 있다"를 암시해 피한다). 토큰 비교는
 * `crypto.timingSafeEqual` 로 상수시간이다 — 길이가 다르면 바로 실패하되, 그 실패까지
 * 걸리는 시간이 길이에 따라 갈리지 않도록 고정 길이 해시(SHA-256)를 먼저 씌운다.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

/** 두 문자열이 같은지, 길이·내용 어느 쪽으로도 타이밍이 새지 않게 비교한다. */
export function constantTimeEqual(a: string, b: string): boolean {
  const hashOf = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(hashOf(a), hashOf(b));
}

const BEARER_PREFIX = /^Bearer\s+(.+)$/;

export interface AdminAuthOptions {
  /** `undefined` 면 관리자 API 를 통째로 비활성한다. */
  readonly token: string | undefined;
}

export function adminAuth(options: AdminAuthOptions): MiddlewareHandler {
  return async (c, next) => {
    if (options.token === undefined) return c.json({ error: 'not_found' }, 404);
    const header = c.req.header('authorization') ?? '';
    const match = BEARER_PREFIX.exec(header);
    const provided = match?.[1];
    if (!provided || !constantTimeEqual(provided, options.token)) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    return next();
  };
}
