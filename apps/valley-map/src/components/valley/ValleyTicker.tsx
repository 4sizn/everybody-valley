/**
 * 계곡 실시간 티커(F5c, 화면 결정 (f)(g)) — festival `components/festival/Ticker.tsx` 의
 * **클론**이다.
 *
 * 재사용하지 않는다 — CLAUDE.md `/firework` 결과물 보존 규칙과 2026-09-07 사용자 지시
 * ("festival 의 Ticker·NewsTickerController·TickerMessage 를 재사용하지 마라. 건드리지도
 * 마라") 때문이다. 시작 모양(위치·2층 구조·페이드)은 그 컴포넌트에서 그대로 베꼈지만,
 * 이후로는 이 파일만 계곡 요구를 따라 바뀐다:
 *   · 문구는 고정 배열이 아니라 제보 피드(core `reportTickerMessages`) — 유형 + 본문뿐,
 *     시각은 없다(결정 (g)). 최근 24시간 제보가 없으면 계곡 기본 문구로 돌아간다.
 *   · 회전 색인·페이드 상태는 `valleyTickerIndex`/`valleyTickerVisible`(festival 의
 *     `tickerIndex`/`tickerVisible` 과는 분리된 필드, `ValleyTickerController` 가 돌린다).
 *   · 티커를 숨기는 조건이 다르다 — 명당(`selectedSpotId`) 대신 구간·제보 상세
 *     (`selectedSegmentId`·`selectedReportId`)가 열려 있을 때 숨는다.
 */
import { reportTickerMessages, VALLEY_TICKER_FALLBACK_MESSAGES } from '@modu-valley/core';
import { StyleSheet, Text, View } from 'react-native';
import { useAppState } from '@/session';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { SIZES } from '@/theme/tokens';

export type ValleyTickerProps = {
  /** 시트 위로 띄우는 높이 — festival `Ticker` 와 같은 자리 규칙(`MapScreen` 이 계산). */
  readonly bottom: number;
};

export function ValleyTicker({ bottom }: ValleyTickerProps) {
  const index = useAppState((state) => state.valleyTickerIndex);
  const textVisible = useAppState((state) => state.valleyTickerVisible);
  const reports = useAppState((state) => state.reports);
  const selectedSegmentId = useAppState((state) => state.selectedSegmentId);
  const selectedReportId = useAppState((state) => state.selectedReportId);
  const themed = useThemedStyles();

  const messages = reportTickerMessages(reports ?? [], new Date(), VALLEY_TICKER_FALLBACK_MESSAGES);
  const message = messages[index % messages.length];
  const hasDetailOpen = selectedSegmentId !== null || selectedReportId !== null;

  return (
    <View
      style={[styles.ticker, { bottom, opacity: hasDetailOpen ? 0 : 1 }]}
      dataSet={{ mv: 'valley-ticker' }}
    >
      <View style={styles.head}>
        <View style={[styles.dot, themed.dot]} dataSet={{ mv: 'live-dot' }} />
        <Text style={[styles.headText, themed.headText]}>실시간 정보</Text>
      </View>
      <Text
        style={[styles.line, themed.line, { opacity: textVisible ? 1 : 0 }]}
        dataSet={{ mv: 'valley-ticker-line' }}
      >
        {message?.headline ?? ''}
        <Text style={[styles.badge, themed.badge]}>{`  ${message?.badge ?? ''}`}</Text>
      </Text>
    </View>
  );
}

/** festival `Ticker` 와 같은 치수 — 같은 자리를 차지해야 레이아웃이 익숙하다. */
const styles = StyleSheet.create({
  ticker: {
    position: 'absolute',
    left: SIZES.gutter,
    width: 300,
    pointerEvents: 'none',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  headText: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
  },
  line: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '400',
  },
});

/** 티커는 시트가 아니라 지도 위에 놓인다 — 지도 명도를 따르는 map* 토큰을 쓴다(festival 과 같은 이유). */
const useThemedStyles = createThemedStyles((theme) => ({
  dot: { backgroundColor: theme.colors.live },
  headText: { color: theme.colors.liveText },
  line: { color: theme.colors.mapFg },
  badge: { color: theme.colors.mapFg2 },
}));
