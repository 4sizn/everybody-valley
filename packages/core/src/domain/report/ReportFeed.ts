/**
 * 제보 피드·티커 순수 함수(F5c, `docs/TODO.md` F5 "화면 결정 확정").
 *
 * 결정 (h) — 피드·상세는 만료가 없다. 완화로 카드에는 상대 시각을 **항상 크게**
 * 보여준다(`reportRelativeTimeLabel`). 정렬은 항상 최신순이라 오래된 제보가 밀려도
 * 사라지지 않고 뒤로 갈 뿐이다.
 *
 * 화면 결정 (g) 상충 해소(2026-09-07, 메인 세션 판단으로 확정) — 티커 한 줄은
 * "유형 + 본문"뿐이라 시각이 없다. 그 대신 티커에는 최근 `REPORT_TICKER_MAX_AGE_HOURS`
 * 시간 안의 제보만 올린다 — 오래된 글이 "실시간"으로 도는 것을 막는다. 그 창에
 * 하나도 없으면 `VALLEY_TICKER_FALLBACK_MESSAGES` 로 돌아간다(빈 티커 금지).
 *
 * 계곡 전용 티커(`ValleyTickerController`, `ValleyTicker`)가 이 파일을 쓴다 —
 * festival 의 `TickerMessage`/`TICKER_MESSAGES`(`domain/news/TickerMessage.ts`)는
 * 재사용하지도, import 하지도 않는다(CLAUDE.md `/firework` 보존 규칙, 2026-09-07
 * 사용자 지시 "클론이지 공유가 아니다").
 */
import { type ReportType, reportTypeLabel } from './Report';

/** 티커에 올릴 제보의 최대 나이(시간). 나중에 조정 가능하도록 상수로 둔다(화면 결정 (g)). */
export const REPORT_TICKER_MAX_AGE_HOURS = 24;

/** 목록 면 "실시간 정보" 섹션의 카드 수(화면 결정 (f)). */
export const REPORT_FEED_LIMIT = 3;

/** 계곡 티커 한 줄. festival `TickerMessage` 와 모양은 같지만 독립된 타입이다(클론 규칙). */
export type ValleyTickerMessage = {
  readonly headline: string;
  readonly badge: string;
};

/** `selectFeedReports`·`selectTickerReports` 가 다루는 최소 모양 — `Report`·`ApiReport` 모두 맞는다. */
export type ReportFeedItem = {
  readonly createdAt: string;
  readonly type: ReportType;
  readonly body: string;
};

function byCreatedAtDesc<T extends ReportFeedItem>(a: T, b: T): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * 목록 면 "실시간 정보" 섹션(화면 결정 (f)) — 최신순으로 최대 `limit`건. 서버 응답이
 * 이미 최신순이어도 방어적으로 다시 정렬한다("최신순 절단"이 이 함수의 계약이다).
 * 나이 제한은 없다(결정 (h) — 만료가 없다).
 */
export function selectFeedReports<T extends ReportFeedItem>(
  reports: readonly T[],
  limit: number = REPORT_FEED_LIMIT,
): readonly T[] {
  return [...reports].sort(byCreatedAtDesc).slice(0, limit);
}

/** 제보 하나가 지금(`now`) 기준 티커 창(`maxAgeHours` 이내) 안에 있는가 — 23시간 59분은 포함, 24시간 1분은 제외. */
export function isWithinTickerWindow(
  createdAt: string,
  now: Date,
  maxAgeHours: number = REPORT_TICKER_MAX_AGE_HOURS,
): boolean {
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return ageMs <= maxAgeHours * 60 * 60 * 1000;
}

/** 티커 후보 — 최근 `maxAgeHours` 이내만, 최신순. */
export function selectTickerReports<T extends ReportFeedItem>(
  reports: readonly T[],
  now: Date,
  maxAgeHours: number = REPORT_TICKER_MAX_AGE_HOURS,
): readonly T[] {
  return reports
    .filter((report) => isWithinTickerWindow(report.createdAt, now, maxAgeHours))
    .sort(byCreatedAtDesc);
}

/**
 * 티커 한 줄에 담는 본문 길이 상한. 제보 본문은 최대 500자(폼 제약)라 그대로 실으면
 * 티커가 여러 줄로 접힌다 — 뉴스 티커는 한 줄이 관례다(festival `TICKER_MESSAGES` 도
 * 전부 한 줄 길이). 자르기는 표시용일 뿐 원문(카드·상세)은 그대로 둔다.
 */
export const REPORT_TICKER_HEADLINE_MAX_LENGTH = 24;

function truncateForTicker(body: string, maxLength: number): string {
  const trimmed = body.trim();
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

/** 제보 하나 → 티커 한 줄(화면 결정 (g) "유형 + 본문", 시각은 넣지 않는다). 본문은 한 줄 길이로 자른다. */
export function reportTickerMessage(
  report: ReportFeedItem,
  maxLength: number = REPORT_TICKER_HEADLINE_MAX_LENGTH,
): ValleyTickerMessage {
  return {
    headline: truncateForTicker(report.body, maxLength),
    badge: reportTypeLabel(report.type),
  };
}

/**
 * 계곡 티커에 올릴 문구 목록. 최근 창 안에 제보가 있으면 그걸로, 하나도 없으면
 * `fallback` 으로 돌아간다(빈 티커 금지, 화면 결정 (g)).
 */
export function reportTickerMessages<T extends ReportFeedItem>(
  reports: readonly T[],
  now: Date,
  fallback: readonly ValleyTickerMessage[] = VALLEY_TICKER_FALLBACK_MESSAGES,
  maxAgeHours: number = REPORT_TICKER_MAX_AGE_HOURS,
): readonly ValleyTickerMessage[] {
  const recent = selectTickerReports(reports, now, maxAgeHours);
  // `map(reportTickerMessage)` 는 `map` 의 (value, index) 를 그대로 (report, maxLength) 로
  // 넘겨 index=0 인 첫 항목이 0자로 잘리는 버그가 났다 — 화살표로 인자를 하나로 좁힌다.
  return recent.length === 0 ? fallback : recent.map((report) => reportTickerMessage(report));
}

/**
 * 24시간 안에 제보가 하나도 없을 때 계곡 티커의 기본 문구(화면 결정 (g) "빈 티커를 두지
 * 않는다"). festival `TICKER_MESSAGES` 와 내용은 겹치지만(둘 다 "지금 상황을 제보해
 * 주세요" 류의 일반 문구다) 독립된 상수다 — 그 배열을 import 하지 않는다(클론 규칙).
 */
export const VALLEY_TICKER_FALLBACK_MESSAGES: readonly ValleyTickerMessage[] = [
  // 배지는 계곡 화면의 제보 버튼 문구(`VALLEY_COPY.reportButton` = "제보")와 같은 말을 쓴다.
  // 클론할 때 festival 의 "현장 제보"(`FESTIVAL_COPY.reportButton`)가 그대로 따라와, 버튼은
  // "제보" 인데 티커는 "현장 제보" 라 부르는 불일치가 있었다(2026-09-08 문구 규칙 정리).
  { headline: '지금 상황을 제보해 주세요', badge: '제보' },
  { headline: '위험·쓰레기·새 소식도 여기 모여요', badge: '실시간 정보' },
];

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * 카드·상세의 상대 시각 — "방금 · N분 전 · N시간 전 · N일 전"(결정 (h) 완화 — 상대 시각을
 * 항상 크게 보여 오래된 제보를 숨기지 않고 드러낸다).
 */
export function reportRelativeTimeLabel(createdAt: string, now: Date): string {
  const ageMs = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  if (ageMs < MINUTE_MS) return '방금';
  if (ageMs < HOUR_MS) return `${Math.floor(ageMs / MINUTE_MS)}분 전`;
  if (ageMs < DAY_MS) return `${Math.floor(ageMs / HOUR_MS)}시간 전`;
  return `${Math.floor(ageMs / DAY_MS)}일 전`;
}
