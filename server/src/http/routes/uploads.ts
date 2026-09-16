/**
 * `GET /uploads/:file` — 제보 사진 정적 서빙(F5a 결정 (d)). 서버가 리사이즈해 만든 JPEG 만 있다
 * (원본은 보관하지 않는다) — 파일 이름은 서버가 붙인 `<uuid>.jpg` 형식뿐이라 그 패턴만 허용해
 * 경로 조작(`../`)을 막는다.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';

const FILENAME_PATTERN = /^[a-zA-Z0-9-]+\.jpg$/;

export function uploadsRoutes(uploadsDir: string): Hono {
  const app = new Hono();

  app.get('/:file', async (c) => {
    const file = c.req.param('file');
    if (!FILENAME_PATTERN.test(file)) return c.json({ error: 'not_found' }, 404);
    try {
      const data = await fs.readFile(path.join(uploadsDir, file));
      c.header('content-type', 'image/jpeg');
      c.header('cache-control', 'public, max-age=31536000, immutable');
      return c.body(data);
    } catch {
      return c.json({ error: 'not_found' }, 404);
    }
  });

  return app;
}
