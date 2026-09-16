/**
 * `/api/admin/*` — 제보 운영 도구(OPS1). 인증(`adminAuth`)·레이트리밋은 `app.ts` 가 이 라우트
 * 앞에 미들웨어로 건다 — 여기서는 이미 인증된 요청만 받는다고 가정한다.
 *
 * 감사 로그는 **무엇을(제보 id) 언제 숨겼나만** 남긴다. 제보 본문·닉네임·IP·토큰은 절대
 * 넣지 않는다(사용자 보안 규칙) — `logger.info` 호출에 그 필드들을 넘기지 않는 것으로 지킨다.
 */
import type { Logger } from '@modu-valley/core';
import { Hono } from 'hono';
import {
  decodeReportCursor,
  encodeReportCursor,
  type ReportCursor,
  type Repos,
} from '../../db/repos';
import { parseLimit, toApiReport } from './reports';

export interface AdminRouteDeps {
  readonly repos: Repos;
  readonly logger: Logger;
}

export function adminRoutes(deps: AdminRouteDeps): Hono {
  const app = new Hono();

  app.get('/reports', (c) => {
    const valleyId = c.req.query('valleyId') || undefined;
    const includeHidden = c.req.query('includeHidden') === '1';
    const limit = parseLimit(c.req.query('limit'));
    const cursorRaw = c.req.query('cursor');
    let before: ReportCursor | undefined;
    if (cursorRaw) {
      const decoded = decodeReportCursor(cursorRaw);
      if (!decoded) return c.json({ error: 'bad_cursor' }, 400);
      before = decoded;
    }
    const rows = deps.repos.reports.list({
      ...(valleyId ? { valleyId } : {}),
      limit: limit + 1,
      includeHidden,
      ...(before ? { before } : {}),
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? encodeReportCursor({ createdAt: last.createdAt, id: last.id })
        : null;
    return c.json({
      count: page.length,
      reports: page.map((r) => toApiReport(r, { includeHidden: true })),
      nextCursor,
    });
  });

  app.patch('/reports/:id/hidden', async (c) => {
    const id = c.req.param('id');
    let payload: { hidden?: unknown };
    try {
      payload = (await c.req.json()) as { hidden?: unknown };
    } catch {
      return c.json({ error: 'bad_request' }, 400);
    }
    if (typeof payload.hidden !== 'boolean') {
      return c.json({ error: 'invalid_field' }, 400);
    }
    const changed = deps.repos.reports.setHidden(id, payload.hidden);
    if (!changed) return c.json({ error: 'not_found' }, 404);
    // 감사 로그 — 제보 id·새 hidden 값만. 본문·닉네임·IP·토큰은 여기 없다.
    deps.logger.info('관리자: 제보 숨김 상태 변경', { reportId: id, hidden: payload.hidden });
    const updated = deps.repos.reports.get(id);
    if (!updated) return c.json({ error: 'not_found' }, 404);
    return c.json(toApiReport(updated, { includeHidden: true }));
  });

  app.get('/flags', (c) => {
    return c.json({ flags: deps.repos.reports.flagsSummary() });
  });

  return app;
}
