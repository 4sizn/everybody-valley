import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { DISCOVERY_KINDS, type DiscoveryFeed, type DiscoveryStory } from '@modu-valley/core';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Db } from '../../db/Database';
import { clientIp } from '../rateLimit';

type Deps = { db: Db; knownValleyIds: ReadonlySet<string>; now: () => number; trustProxy: boolean };
const day = (time: number) => new Date(time + 9 * 3600_000).toISOString().slice(0, 10);
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s).toISOString().startsWith(s);
function publicUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      u.hostname.includes('.') &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) &&
      !u.hostname.startsWith('[')
    );
  } catch {
    return false;
  }
}
function parseStory(input: unknown, valleys: ReadonlySet<string>): DiscoveryStory | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  const s = (key: string) => (typeof p[key] === 'string' ? p[key].trim() : '');
  const kind = DISCOVERY_KINDS.find((k) => k === p['kind']);
  if (!kind) return null;
  const story: DiscoveryStory = {
    id: s('id') || randomUUID(),
    kind,
    valleyId: s('valleyId'),
    title: s('title'),
    description: s('description'),
    imageUrl: s('imageUrl'),
    imageCredit: s('imageCredit'),
    url: s('url'),
    author: s('author'),
    publishedOn: s('publishedOn'),
    startsOn: s('startsOn'),
    endsOn: s('endsOn'),
    sponsored: p['sponsored'] === true,
    enabled: p['enabled'] === true,
  };
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(story.id) || !valleys.has(story.valleyId)) return null;
  if (
    !story.title ||
    story.title.length > 100 ||
    story.description.length > 300 ||
    !story.author ||
    story.author.length > 80 ||
    story.imageCredit.length > 160
  )
    return null;
  // 팁·명소는 사진 없이도 올린다(글이 주인공). 사진이 있으면 출처는 언제나 필수다.
  const imageOptional = story.kind === 'tip' || story.kind === 'spot';
  if (story.imageUrl || !imageOptional) {
    if (!publicUrl(story.imageUrl) || story.imageUrl.length > 2000 || !story.imageCredit)
      return null;
  } else if (story.imageCredit) return null;
  if (
    (story.kind === 'blog' || story.sponsored || story.url) &&
    (!publicUrl(story.url) || story.url.length > 2000)
  )
    return null;
  if (
    !validDate(story.publishedOn) ||
    !validDate(story.startsOn) ||
    !validDate(story.endsOn) ||
    story.endsOn < story.startsOn
  )
    return null;
  if (typeof p['enabled'] !== 'boolean' || typeof p['sponsored'] !== 'boolean') return null;
  return story;
}
function stories(db: Db): DiscoveryStory[] {
  return (
    db.prepare('SELECT payload FROM discovery_stories ORDER BY updated_at DESC, id').all() as {
      payload: string;
    }[]
  ).map((r) => JSON.parse(r.payload) as DiscoveryStory);
}
function prune(db: Db, from: string) {
  db.prepare('DELETE FROM discovery_interest WHERE day < ?').run(from);
}
export function discoveryRoutes({ db, knownValleyIds, now, trustProxy }: Deps): Hono {
  const app = new Hono();
  db.prepare('INSERT OR IGNORE INTO discovery_secret (id,value) VALUES (1,?)').run(
    randomBytes(32).toString('hex'),
  );
  const secret = (
    db.prepare('SELECT value FROM discovery_secret WHERE id=1').get() as { value: string }
  ).value;
  app.get('/', (c) => {
    const to = day(now()),
      from = day(now() - 6 * 86400_000);
    prune(db, from);
    const counts = db
      .prepare(
        'SELECT valley_id AS valleyId, COUNT(*) AS count FROM discovery_interest WHERE day >= ? AND day <= ? GROUP BY valley_id ORDER BY count DESC, valley_id LIMIT 5',
      )
      .all(from, to) as { valleyId: string; count: number }[];
    let rank = 1;
    const feed: DiscoveryFeed = {
      period: { from, to },
      ranking: counts.map((r, i) => {
        if (i && counts[i - 1]?.count !== r.count) rank = i + 1;
        return { ...r, rank };
      }),
      stories: stories(db).filter(
        (s) => s.enabled && s.startsOn <= to && s.endsOn >= to && knownValleyIds.has(s.valleyId),
      ),
    };
    c.header('Cache-Control', 'no-store');
    return c.json(feed);
  });
  app.post('/interest/:valleyId', (c) => {
    const valley = c.req.param('valleyId');
    if (!knownValleyIds.has(valley)) return c.json({ error: 'invalid_valley' }, 400);
    const today = day(now());
    const hash = createHmac('sha256', secret)
      .update(`${today}:${clientIp(c, trustProxy)}`)
      .digest('hex');
    // ponytail: one connection/valley/day limits casual repeats; verified-visit ranking needs an explicit check-in model.
    prune(db, day(now() - 6 * 86400_000));
    db.prepare(
      'INSERT OR IGNORE INTO discovery_interest(day,valley_id,visitor_hash) VALUES(?,?,?)',
    ).run(today, valley, hash);
    return c.body(null, 204);
  });
  return app;
}
/** Mounted behind the existing /api/admin/* authentication and request limits. */
export function discoveryAdminRoutes({ db, knownValleyIds, now }: Deps): Hono {
  const app = new Hono();
  app.use('*', bodyLimit({ maxSize: 16 * 1024 }));
  app.get('/', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ stories: stories(db) });
  });
  app.post('/', async (c) => {
    let input: unknown;
    try {
      input = await c.req.json();
    } catch {
      return c.json({ error: 'bad_request' }, 400);
    }
    const story = parseStory(input, knownValleyIds);
    if (!story) return c.json({ error: 'invalid_story' }, 400);
    const existing = db.prepare('SELECT id FROM discovery_stories WHERE id=?').get(story.id);
    const count = (db.prepare('SELECT COUNT(*) AS n FROM discovery_stories').get() as { n: number })
      .n;
    if (!existing && count >= 200) return c.json({ error: 'content_limit' }, 409);
    db.prepare(
      'INSERT INTO discovery_stories(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
    ).run(story.id, JSON.stringify(story), new Date(now()).toISOString());
    return c.json(story, existing ? 200 : 201);
  });
  app.delete('/:id', (c) => {
    const result = db.prepare('DELETE FROM discovery_stories WHERE id=?').run(c.req.param('id'));
    return result.changes ? c.body(null, 204) : c.json({ error: 'not_found' }, 404);
  });
  return app;
}
