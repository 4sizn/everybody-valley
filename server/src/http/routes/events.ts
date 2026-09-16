/**
 * `GET /api/events?channel=hydro,aws` — SSE. 연결 직후 `hello`, 갱신마다 채널 이름의 이벤트, 15 s `heartbeat`.
 * 연결이 끊기면 구독을 정리한다.
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { type EventHub, parseChannels } from '../../events/EventHub';

export function eventsRoutes(hub: EventHub): Hono {
  const app = new Hono();

  app.get('/', (c) => {
    const channels = parseChannels(c.req.query('channel') ?? c.req.query('channels'));
    c.header('cache-control', 'no-store');
    c.header('x-accel-buffering', 'no');
    return streamSSE(c, async (stream) => {
      await new Promise<void>((resolve) => {
        const sub = hub.subscribe(channels, (m) =>
          stream.writeSSE({
            event: m.event,
            data: m.data,
            ...(m.id !== undefined ? { id: m.id } : {}),
          }),
        );
        stream.onAbort(() => {
          sub.close();
          resolve();
        });
      });
    });
  });

  return app;
}
