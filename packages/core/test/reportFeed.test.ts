/**
 * 제보 피드·티커 순수 함수 테스트(F5c) — 24시간 경계, 피드 절단, 상대 시각, 빈 티커 대체.
 */
import { describe, expect, it } from 'vitest';
import {
  isWithinTickerWindow,
  REPORT_FEED_LIMIT,
  REPORT_TICKER_HEADLINE_MAX_LENGTH,
  REPORT_TICKER_MAX_AGE_HOURS,
  type ReportFeedItem,
  reportRelativeTimeLabel,
  reportTickerMessage,
  reportTickerMessages,
  selectFeedReports,
  selectTickerReports,
  VALLEY_TICKER_FALLBACK_MESSAGES,
} from '../src/domain/report/ReportFeed';

const NOW = new Date('2026-09-07T12:00:00.000Z');

function itemAt(hoursAgo: number, overrides: Partial<ReportFeedItem> = {}): ReportFeedItem {
  return {
    createdAt: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
    type: 'trash',
    body: `${hoursAgo}시간 전 제보`,
    ...overrides,
  };
}

describe('REPORT_TICKER_MAX_AGE_HOURS / REPORT_FEED_LIMIT', () => {
  it('24시간 · 3건이다', () => {
    expect(REPORT_TICKER_MAX_AGE_HOURS).toBe(24);
    expect(REPORT_FEED_LIMIT).toBe(3);
  });
});

describe('isWithinTickerWindow / selectTickerReports — 24시간 경계', () => {
  it('23시간 59분은 포함, 24시간 1분은 제외한다', () => {
    const at2359 = new Date(NOW.getTime() - (23 * 60 + 59) * 60 * 1000).toISOString();
    const at2401 = new Date(NOW.getTime() - (24 * 60 + 1) * 60 * 1000).toISOString();
    expect(isWithinTickerWindow(at2359, NOW)).toBe(true);
    expect(isWithinTickerWindow(at2401, NOW)).toBe(false);
  });

  it('정확히 24시간(경계값)은 포함이다', () => {
    const at2400 = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinTickerWindow(at2400, NOW)).toBe(true);
  });

  it('selectTickerReports 는 창 안의 것만 최신순으로 돌려준다', () => {
    const inWindow = itemAt(1, { body: '1시간 전' });
    const alsoInWindow = itemAt(23.5, { body: '23시간 반 전' });
    const outOfWindow = itemAt(25, { body: '25시간 전' });
    const result = selectTickerReports([outOfWindow, inWindow, alsoInWindow], NOW);
    expect(result.map((r) => r.body)).toEqual(['1시간 전', '23시간 반 전']);
  });
});

describe('selectFeedReports — 최신순 절단(화면 결정 (f)(h))', () => {
  it('3건 이하면 그대로, 초과하면 최신순으로 3건만 남긴다', () => {
    const items = [itemAt(5), itemAt(1), itemAt(48), itemAt(0.5)];
    const result = selectFeedReports(items);
    expect(result).toHaveLength(REPORT_FEED_LIMIT);
    expect(result.map((r) => r.createdAt)).toEqual(
      [...items]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3)
        .map((r) => r.createdAt),
    );
  });

  it('나이 제한이 없다 — 오래된 제보도 절단 전에는 포함될 수 있다(결정 (h))', () => {
    const veryOld = itemAt(24 * 30); // 30일 전
    const result = selectFeedReports([veryOld]);
    expect(result).toEqual([veryOld]);
  });

  it('입력 순서가 뒤섞여 있어도 방어적으로 다시 정렬한다', () => {
    const oldest = itemAt(10, { body: 'oldest' });
    const newest = itemAt(1, { body: 'newest' });
    const middle = itemAt(5, { body: 'middle' });
    expect(selectFeedReports([oldest, newest, middle]).map((r) => r.body)).toEqual([
      'newest',
      'middle',
      'oldest',
    ]);
  });

  it('limit 을 넘겨주면 그 값을 쓴다', () => {
    const items = [itemAt(1), itemAt(2), itemAt(3), itemAt(4)];
    expect(selectFeedReports(items, 2)).toHaveLength(2);
  });
});

describe('reportTickerMessage / reportTickerMessages — 유형 + 본문, 시각 없음(화면 결정 (g))', () => {
  it('한 제보를 유형 라벨(badge) + 본문(headline) 으로 옮긴다', () => {
    const message = reportTickerMessage(itemAt(1, { type: 'emergency', body: '조난자가 있어요' }));
    expect(message).toEqual({ headline: '조난자가 있어요', badge: '긴급 신고' });
  });

  it('본문이 길면 한 줄 길이로 자르고 말줄임표를 붙인다 — 원문은 건드리지 않는다', () => {
    const longBody = '가'.repeat(60);
    const message = reportTickerMessage(itemAt(1, { body: longBody }));
    expect(message.headline).toBe(`${'가'.repeat(REPORT_TICKER_HEADLINE_MAX_LENGTH)}…`);
    expect(message.headline.length).toBe(REPORT_TICKER_HEADLINE_MAX_LENGTH + 1);
  });

  it('상한보다 짧은 본문은 그대로 둔다', () => {
    const message = reportTickerMessage(itemAt(1, { body: '짧은 본문' }));
    expect(message.headline).toBe('짧은 본문');
  });

  it('최근 24시간 안에 제보가 있으면 그걸로 만든다', () => {
    const recent = itemAt(1, { body: '최근 제보' });
    const old = itemAt(48, { body: '오래된 제보' });
    const messages = reportTickerMessages([old, recent], NOW);
    expect(messages).toEqual([{ headline: '최근 제보', badge: '쓰레기' }]);
  });

  it('24시간 안에 하나도 없으면 fallback 으로 돌아간다 — 빈 티커를 두지 않는다', () => {
    const old = itemAt(25);
    expect(reportTickerMessages([old], NOW)).toBe(VALLEY_TICKER_FALLBACK_MESSAGES);
    expect(reportTickerMessages([], NOW)).toBe(VALLEY_TICKER_FALLBACK_MESSAGES);
    expect(VALLEY_TICKER_FALLBACK_MESSAGES.length).toBeGreaterThan(0);
  });

  it('fallback 을 직접 넘기면 그걸 쓴다', () => {
    const fallback = [{ headline: 'x', badge: 'y' }];
    expect(reportTickerMessages([], NOW, fallback)).toBe(fallback);
  });
});

describe('reportRelativeTimeLabel — 카드·상세의 상대 시각(결정 (h) 완화)', () => {
  it('1분 미만은 방금', () => {
    const at = new Date(NOW.getTime() - 30_000).toISOString();
    expect(reportRelativeTimeLabel(at, NOW)).toBe('방금');
  });

  it('분·시간·일 단위로 내림한다', () => {
    expect(reportRelativeTimeLabel(new Date(NOW.getTime() - 5 * 60_000).toISOString(), NOW)).toBe(
      '5분 전',
    );
    expect(
      reportRelativeTimeLabel(new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString(), NOW),
    ).toBe('3시간 전');
    expect(
      reportRelativeTimeLabel(new Date(NOW.getTime() - 2 * 24 * 60 * 60_000).toISOString(), NOW),
    ).toBe('2일 전');
  });

  it('미래 시각(시계 오차)은 음수 대신 방금으로 바닥을 둔다', () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(reportRelativeTimeLabel(future, NOW)).toBe('방금');
  });
});
