/**
 * 단풍 판정용 일 최저·최고기온 백필 — 기상청 API허브 AWS 매분자료를 지난 날짜로 다시 받아
 * `daily_temps` 에 접는다. 폴러는 서버가 뜬 뒤부터만 쌓으므로 시즌 앞부분(9월 초)이 비어 있다.
 *
 *   pnpm server:backfill -- --from 20260901 --to 20260920
 *
 * 매분자료는 `stn=0` 이라 한 호출이 전체 지점(~740곳)을 담는다 — 지점을 고를 필요 없이 날짜 창만
 * 돈다. 창이 크면 서버가 504 를 내므로(하루 창은 항상, 6시간 창은 4개 중 1개꼴 — 2026-09-21 실측)
 * 3시간 창으로 시작해 실패하면 반으로 쪼개 내려간다(최소 30분). 응답은 창 6시간에 ~25 MB.
 * 접기는 MIN/MAX 라 다시 돌려도 안전하다(samples 만 늘어난다). 서버가 같은 DB 를 쓰고 있어도
 * 된다(WAL, busy_timeout 5 s).
 */
import path from 'node:path';
import { loadConfig, mergeEnv, readEnvLocal } from '../src/config';
import { openDatabase } from '../src/db/Database';
import { runMigrations } from '../src/db/migrate';
import { createRepos } from '../src/db/repos';
import { awsMinutesUrl, parseAwsMinutes } from '../src/sources/kmaAws';

const SERVER_DIR = path.resolve(import.meta.dirname, '..');
const GAP_MS = 1100;
const WINDOW_MIN = 180;
const WINDOW_MIN_FLOOR = 30;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function days(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6, 8)));
  const end = Date.UTC(+to.slice(0, 4), +to.slice(4, 6) - 1, +to.slice(6, 8));
  while (d.getTime() <= end) {
    out.push(d.toISOString().slice(0, 10).replaceAll('-', ''));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const say = (line: string) => process.stdout.write(`${line}\n`);

/** 한 번 받아 본다. 200 + `#7777END` 면 본문, 아니면 null(호출자가 창을 쪼갠다). */
async function fetchOnce(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    const text = await res.text();
    if (res.ok && text.includes('#7777END')) return text;
    say(`  ${res.status}${text.includes('#7777END') ? '' : ' (잘림)'}`);
  } catch (e) {
    say(`  ${(e as Error).message}`);
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}${pad(min % 60)}`;

/**
 * `day` 의 [fromMin, toMin) 창을 받아 접는다. 실패하면 반으로 쪼개 재귀. 바닥(30분)에서도
 * 실패하면 그 창은 건너뛰고 `failures` 에 남긴다. 접은 행 수를 돌려준다.
 */
async function backfillWindow(
  key: string,
  fold: (text: string) => number,
  day: string,
  fromMin: number,
  toMin: number,
  failures: string[],
): Promise<number> {
  const url = awsMinutesUrl(key, `${day}${hhmm(fromMin)}`, `${day}${hhmm(toMin - 1)}`);
  const text = await fetchOnce(url);
  await sleep(GAP_MS);
  if (text !== null) return fold(text);
  if (toMin - fromMin <= WINDOW_MIN_FLOOR) {
    failures.push(`${day} ${hhmm(fromMin)}-${hhmm(toMin - 1)}`);
    return 0;
  }
  const mid = fromMin + Math.floor((toMin - fromMin) / 2 / 10) * 10;
  say(`  창 쪼갬 ${hhmm(fromMin)}-${hhmm(toMin - 1)} → ${hhmm(mid)}`);
  return (
    (await backfillWindow(key, fold, day, fromMin, mid, failures)) +
    (await backfillWindow(key, fold, day, mid, toMin, failures))
  );
}

async function main(): Promise<void> {
  const from = arg('from');
  const to = arg('to');
  if (!from || !to) throw new Error('--from YYYYMMDD --to YYYYMMDD 가 필요하다');
  const env = mergeEnv(process.env, readEnvLocal(path.resolve(SERVER_DIR, '..', '.env.local')));
  const config = loadConfig({ serverDir: SERVER_DIR, env });
  const key = config.kmaKey;
  if (!key) throw new Error('KMA_APIHUB_KEY 가 없다');

  const db = openDatabase({ path: config.dbPath });
  runMigrations(db, config.migrationsDir);
  const repos = createRepos(db);
  const fold = (text: string) =>
    repos.dailyTemps.fold(parseAwsMinutes(text).rows, new Date().toISOString());

  const dayList = days(from, to);
  say(`${dayList.length}일 × ${(24 * 60) / WINDOW_MIN}창(${WINDOW_MIN}분) — 전체 지점 한 번에`);
  const failures: string[] = [];
  for (const day of dayList) {
    let folded = 0;
    for (let m = 0; m < 24 * 60; m += WINDOW_MIN) {
      folded += await backfillWindow(key, fold, day, m, m + WINDOW_MIN, failures);
    }
    const iso = day.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const n = (
      db.prepare('SELECT COUNT(*) AS n FROM daily_temps WHERE day_kst = ?').get(iso) as {
        n: number;
      }
    ).n;
    say(`${iso} 접은 행 ${folded} · 지점 ${n} · 누적 실패 창 ${failures.length}`);
  }
  say(`끝. 실패 창 ${failures.length}`);
  if (failures.length) say(`실패 목록:\n${failures.join('\n')}`);
  db.close();
}

await main();
