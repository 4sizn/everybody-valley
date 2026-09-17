/**
 * 홈 콘텐츠 초기 자료 채우기 (운영자 요청 2026-09-17 "빈약한 데이터를 크롤링으로 기입").
 *
 * 공개 출처에서 계곡별 **배너**(`kind: 'banner'`)를 모아 운영자 API `/api/admin/discovery` 로
 * 등록한다. 배너는 원문 링크를 비우므로 누르면 해당 계곡 미리보기가 열린다(`docs/CONTENT.md`).
 *
 * 출처는 재게시 권한이 분명한 둘만 쓴다 — 임의 블로그·검색 결과를 긁지 않는다.
 *   - `tour`    한국관광공사 TourAPI(KorService2). 공공누리 제1유형, 출처 표시로 상업 이용 가능.
 *               `.env.local` 의 `DATA_GO_KR_KEY_ENCODING` 필요. data.go.kr 에서 "국문 관광정보
 *               서비스_GW" 활용신청(개발계정 즉시 승인, 1,000건/일).
 *   - `commons` Wikimedia Commons 지리검색. 키가 없어도 되지만 계곡 사진 자체가 드물어
 *               2026-09-17 실측 33곳 중 3곳만 맞았다. `tour` 가 못 채운 자리만 메운다.
 *
 * 사진은 내려받지 않고 원 주소를 그대로 보여준다(`docs/CONTENT.md`). 그래서 등록 전에 이미지
 * 주소가 실제로 열리는지 HEAD 로 확인하고, 안 열리면 그 계곡은 건너뛴다.
 *
 *   pnpm seed:discovery                          # 수집만 하고 표로 보여준다(등록하지 않음)
 *   pnpm seed:discovery --apply                  # 실제로 등록한다
 *   pnpm seed:discovery --source commons         # 출처 하나만
 *   pnpm seed:discovery --valley eobi --apply
 *   API_BASE=https://app.example.com pnpm seed:discovery --apply
 *
 * 토큰은 `.env.local` 의 `ADMIN_TOKEN` 또는 환경변수에서 읽고 로그에 싣지 않는다.
 * 등록은 운영자 레이트리밋(기본 20건/분)에 맞춰 천천히 보낸다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvLocal, SEED_DIR, todayKst } from './env.mts';
import { log, warn } from './log.mts';

interface SeedValley {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly lat: number;
  readonly lng: number;
  readonly note?: string;
  /** 시딩용 검색어. 대안이 있으면 `|` 로 이어 붙어 있다. */
  readonly query?: string;
}
interface Story {
  /** 어떤 항목에서 왔는지 — 로그로만 쓰고 등록 본문에는 넣지 않는다. */
  matched?: string;
  id: string;
  kind: 'banner';
  valleyId: string;
  title: string;
  description: string;
  imageUrl: string;
  imageCredit: string;
  url: string;
  author: string;
  publishedOn: string;
  startsOn: string;
  endsOn: string;
  sponsored: boolean;
  enabled: boolean;
}

/** 서버가 그대로 되돌려주는 한도(`discoveryRoutes.parseStory`) — 보내기 전에 여기서 자른다. */
const MAX = { title: 100, description: 300, author: 80, imageCredit: 160, url: 2000 };
/** 노출 기간. 운영자가 어드민에서 언제든 줄이거나 비공개로 바꾼다. */
const SHOW_DAYS = 90;
/**
 * 배너 소개문 길이. 서버 한도는 300자지만 홈 히어로는 사진이 주인공이라 세 줄에서 잘린다 —
 * 잘려서 안 보일 글자를 굳이 저장하지 않는다.
 */
const HERO_TEXT = 150;
/** Commons 지리검색 반경(m). */
const COMMONS_RADIUS_M = 4000;
/** 등록 간격(ms). `ADMIN_RATE_LIMIT_PER_MIN` 기본 20 보다 여유를 둔다. */
const POST_GAP_MS = 3200;
/** 출처 호출 간격(ms). Commons 는 이보다 빠르면 429 를 낸다. */
const HOST_GAP_MS = 1500;
/** Wikimedia 는 사람이 읽을 수 있는 User-Agent 를 요구한다(없으면 403). 헤더는 ASCII 만 된다. */
const WIKI_UA = 'everybody-valley-seed/1.0 (home content seeding; contact: repo maintainer)';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
/** TourAPI overview 에는 `<br>` 과 실체참조가 섞여 있다. */
const plain = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
/** 300자에서 끊을 때 문장 중간보다 마지막 마침표에서 끊는다. */
function summarize(text: string, max: number): string {
  const flat = plain(text);
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다. '), cut.lastIndexOf('다.'));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : clamp(flat, max);
}
const addDays = (isoDay: string, days: number): string =>
  new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);

/**
 * `valleys.json` 의 `note` 에서 사람에게 보여줄 위치만 남긴다 — 같은 칸에 `R3b·P1 샘플 계곡`
 * 같은 내부 표기가 섞여 있어 그대로 쓰면 앱 소개문에 새어 나간다.
 */
function place(valley: SeedValley): string {
  const parts = (valley.note ?? '')
    .split(/[.,·]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !/[A-Z]\d|샘플/.test(part));
  return parts.length ? ` (${parts.join(', ')})` : '';
}

/** 이미지 주소가 열리는지 본다. 열리지 않는 사진은 앱에서 "이미지 준비 중"이 되므로 버린다. */
async function imageLoads(url: string): Promise<boolean> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const response = await fetch(url, { method, headers: { 'User-Agent': WIKI_UA } });
      if (response.ok && (response.headers.get('content-type') ?? '').startsWith('image/'))
        return true;
    } catch {
      /* 다음 방법으로 */
    }
  }
  return false;
}

/** 출처별 마지막 호출 시각 — Commons 는 연속 질의에 429 를 준다(실측 2026-09-17). */
const lastCall = new Map<string, number>();
async function getJson<T>(url: string, ua?: string): Promise<T> {
  const host = new URL(url).host;
  for (const retryWait of [0, 5_000, 20_000]) {
    if (retryWait) await sleep(retryWait);
    const gap = (lastCall.get(host) ?? 0) + HOST_GAP_MS - Date.now();
    if (gap > 0) await sleep(gap);
    lastCall.set(host, Date.now());
    const response = await fetch(url, ua ? { headers: { 'User-Agent': ua } } : undefined);
    if (response.ok) return (await response.json()) as T;
    if (response.status !== 429 && response.status < 500)
      throw new Error(`HTTP ${response.status} ${host}`);
  }
  throw new Error(`HTTP 429/5xx ${host} — 재시도 후에도 실패`);
}

// ── 출처 1: 한국관광공사 TourAPI (KorService2) ───────────────────────────────────
interface TourItem {
  contentid?: string;
  contenttypeid?: string;
  title?: string;
  firstimage?: string;
  firstimage2?: string;
  mapx?: string;
  mapy?: string;
  modifiedtime?: string;
}
const tourUrl = (operation: string, key: string, params: Record<string, string>): string => {
  const query = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'modu-valley',
    _type: 'json',
    ...params,
  });
  return `https://apis.data.go.kr/B551011/KorService2/${operation}?serviceKey=${key}&${query}`;
};
function tourItems(body: unknown): TourItem[] {
  const item = (body as { response?: { body?: { items?: { item?: unknown } } } })?.response?.body
    ?.items?.item;
  return Array.isArray(item) ? (item as TourItem[]) : item ? [item as TourItem] : [];
}
/** 좌표가 이 거리 안이면 같은 계곡으로 본다(km). 관광지 좌표는 골짜기 입구를 가리킨다. */
const TOUR_MAX_KM = 8;
const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number =>
  Math.hypot((lat2 - lat1) * 111, (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180));

/**
 * 이름으로 찾고 좌표로 확인한다. 좌표 주변 목록만 훑으면 `명지계곡` 처럼 이름이 정확히 같은
 * 항목도 반경·페이지 밖으로 밀려 놓치고, 반대로 이름만 믿으면 다른 지역의 동명 계곡이 붙는다.
 * `valleys.json` 의 `query` 에 이미 검색어(대안은 `|` 로 구분)가 들어 있어 그것을 쓴다.
 */
async function fromTour(valley: SeedValley, key: string): Promise<Story | null> {
  // `계곡`·괄호를 떼면 관광공사가 쓰는 이름(`소요산`, `사나사`)에 걸린다. 거리 검증이 동명이지를 막는다.
  const bare = valley.name
    .replace(/\(.*?\)/g, '')
    .replace(/계곡|폭포/g, '')
    .trim();
  const keywords = [
    ...new Set([...(valley.query ?? '').split('|'), valley.name, bare].map((k) => k.trim())),
  ]
    .filter((k) => k.length >= 2)
    .slice(0, 6);
  let best: { item: TourItem; typeRank: number; km: number } | null = null;
  for (const keyword of keywords) {
    const found = tourItems(
      await getJson(
        tourUrl('searchKeyword2', key, { keyword, numOfRows: '30', pageNo: '1', arrange: 'A' }),
      ),
    );
    for (const item of found) {
      const lat = Number(item.mapy);
      const lng = Number(item.mapx);
      if (!item.contentid || !(item.firstimage || item.firstimage2) || !lat || !lng) continue;
      const km = distanceKm(valley.lat, valley.lng, lat, lng);
      if (km > TOUR_MAX_KM) continue;
      // 관광지(12)가 축제·식당·숙소보다 계곡 자체에 가깝다.
      const typeRank = item.contenttypeid === '12' ? 0 : 1;
      if (!best || typeRank < best.typeRank || (typeRank === best.typeRank && km < best.km))
        best = { item, typeRank, km };
    }
    if (best?.typeRank === 0) break;
  }
  if (!best) return null;
  const { item } = best;
  const detail = tourItems(
    await getJson(tourUrl('detailCommon2', key, { contentId: item.contentid ?? '' })),
  )[0];
  const image = (detail?.firstimage || item.firstimage || item.firstimage2 || '').replace(
    /^http:/,
    'https:',
  );
  if (!image) return null;
  const overview = (detail as { overview?: string } | undefined)?.overview ?? '';
  const published = (item.modifiedtime ?? '').slice(0, 8);
  return {
    matched: item.title,
    id: `${valley.id}-tour`,
    kind: 'banner',
    valleyId: valley.id,
    title: clamp(`${valley.name} · ${valley.region}`, MAX.title),
    description: summarize(
      overview ||
        `${valley.region} ${valley.name}${place(valley)}. 사진과 소개는 한국관광공사 관광정보의 ${item.title ?? ''} 자료다.`,
      HERO_TEXT,
    ),
    imageUrl: image,
    imageCredit: clamp('한국관광공사 (공공누리 제1유형)', MAX.imageCredit),
    url: '',
    author: '한국관광공사',
    publishedOn: /^\d{8}$/.test(published)
      ? `${published.slice(0, 4)}-${published.slice(4, 6)}-${published.slice(6, 8)}`
      : todayKst(),
    startsOn: todayKst(),
    endsOn: addDays(todayKst(), SHOW_DAYS),
    sponsored: false,
    enabled: true,
  };
}

// ── 출처 2: Wikimedia Commons 지리검색 ──────────────────────────────────────────
/** 제목이 계곡·폭포·계류인 사진만 받는다. 근처라는 이유로 위성사진·역사(驛舍)가 붙는 것을 막는다. */
const ON_TOPIC = /계곡|폭포|계류|용소|valley|waterfall|falls|stream|creek|gorge/i;
/** 재게시·수정이 자유로운 라이선스만. NC·ND 는 광고 배너가 있는 앱에서 쓸 수 없다. */
const REUSABLE = /^(cc[ -]?by(-sa)?|cc0|cc[ -]?zero|public domain|pd)/i;
interface CommonsPage {
  title: string;
  imageinfo?: {
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}
async function fromCommons(valley: SeedValley): Promise<Story | null> {
  const query = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'geosearch',
    ggscoord: `${valley.lat}|${valley.lng}`,
    ggsradius: String(COMMONS_RADIUS_M),
    ggslimit: '40',
    ggsnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1600',
  });
  const body = await getJson<{ query?: { pages?: Record<string, CommonsPage> } }>(
    `https://commons.wikimedia.org/w/api.php?${query}`,
    WIKI_UA,
  );
  for (const page of Object.values(body.query?.pages ?? {})) {
    const file = page.title.replace(/^File:/, '');
    const info = page.imageinfo?.[0];
    if (!info || !ON_TOPIC.test(file)) continue;
    const meta = info.extmetadata ?? {};
    const license = meta['LicenseShortName']?.value ?? '';
    if (!REUSABLE.test(plain(license))) continue;
    // Commons 는 thumburl 에 utm 추적 인자를 붙여 준다 — 운영 데이터에는 주소만 남긴다.
    const image = (info.thumburl ?? info.url)?.split('?')[0];
    if (!image?.startsWith('https://')) continue;
    const author = plain(meta['Artist']?.value ?? '') || 'Wikimedia Commons 기여자';
    const taken = (plain(meta['DateTimeOriginal']?.value ?? '').match(/\d{4}-\d{2}-\d{2}/) ??
      [])[0];
    return {
      matched: file,
      id: `${valley.id}-commons`,
      kind: 'banner',
      valleyId: valley.id,
      title: clamp(`${valley.name} · ${valley.region}`, MAX.title),
      description: summarize(
        `${valley.region} ${valley.name}${place(valley)}. 사진은 계곡 주변에서 찍힌 공개 사진이다.`,
        HERO_TEXT,
      ),
      imageUrl: image,
      imageCredit: clamp(`${author} / Wikimedia Commons (${plain(license)})`, MAX.imageCredit),
      url: info.descriptionurl?.startsWith('https://') ? info.descriptionurl : '',
      author: clamp(author, MAX.author),
      publishedOn: taken ?? todayKst(),
      startsOn: todayKst(),
      endsOn: addDays(todayKst(), SHOW_DAYS),
      sponsored: false,
      enabled: true,
    };
  }
  return null;
}

// ── 실행 ────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : undefined;
};
const apply = argv.includes('--apply');
const only = flag('valley');
const sources = (flag('source') ?? 'tour,commons').split(',');

const env = { ...loadEnvLocal(), ...process.env } as Record<string, string | undefined>;
const tourKey = env['DATA_GO_KR_KEY_ENCODING'] ?? env['DATA_GO_KR_KEY_DECODING'];
const apiBase = (env['API_BASE'] ?? 'http://localhost:8787').replace(/\/$/, '');
const adminToken = env['ADMIN_TOKEN'];

const catalog = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'valleys.json'), 'utf8')) as {
  valleys: SeedValley[];
};
const valleys = catalog.valleys.filter((valley) => !only || valley.id === only);
if (valleys.length === 0) throw new Error(`알 수 없는 계곡: ${only}`);
if (sources.includes('tour') && !tourKey)
  warn('DATA_GO_KR_KEY_ENCODING 이 없어 TourAPI 를 건너뛴다 — Commons 만 쓴다.');

const collected: Story[] = [];
for (const valley of valleys) {
  let story: Story | null = null;
  for (const source of sources) {
    try {
      if (source === 'tour' && tourKey) story = await fromTour(valley, tourKey);
      else if (source === 'commons') story = await fromCommons(valley);
    } catch (error) {
      warn(`${valley.id}: ${source} 조회 실패 — ${error instanceof Error ? error.message : error}`);
    }
    if (story) break;
  }
  if (!story) {
    log(`${valley.id.padEnd(18)}${valley.name.padEnd(20)}— 쓸 수 있는 자료 없음`);
    continue;
  }
  if (!(await imageLoads(story.imageUrl))) {
    log(`${valley.id.padEnd(18)}${valley.name.padEnd(20)}— 사진이 열리지 않아 건너뜀`);
    continue;
  }
  collected.push(story);
  log(
    `${valley.id.padEnd(18)}${valley.name.padEnd(20)}${(story.id.split('-').pop() ?? '').padEnd(8)}${(story.matched ?? '').padEnd(26)}${story.imageCredit}`,
  );
}

log(`\n모은 배너 ${collected.length}개 / 계곡 ${valleys.length}곳`);
if (!apply) {
  log('등록하지 않았다. 확인했으면 --apply 를 붙여 다시 실행한다.');
  process.exit(0);
}
if (!adminToken) throw new Error('ADMIN_TOKEN 이 없어 등록할 수 없다.');

let saved = 0;
for (const story of collected) {
  if (saved > 0) await sleep(POST_GAP_MS);
  const response = await fetch(`${apiBase}/api/admin/discovery`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...story, matched: undefined }),
  });
  if (!response.ok) {
    warn(`${story.id}: 등록 실패 HTTP ${response.status} ${(await response.text()).slice(0, 120)}`);
    continue;
  }
  saved += 1;
}
log(`등록 ${saved}개. 앱 홈과 해당 계곡 미리보기에서 확인한다.`);
