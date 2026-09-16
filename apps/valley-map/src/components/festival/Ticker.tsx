/**
 * 실시간 소식 티커. 데모의 `.ticker`.
 *
 * 문구 순환은 코어의 `NewsTickerController` 가 굴린다(3200ms 주기, 350ms
 * 페이드). 여기서는 상태를 opacity 로만 옮긴다.
 *
 * 붉은 점의 맥박(`@keyframes pulse`)과 문구의 `text-shadow` 는 web 전역
 * 스타일시트가 맡는다.
 */
import { TICKER_HEADER, TICKER_MESSAGES } from '@modu-valley/core';
import { StyleSheet, Text, View } from 'react-native';
import { useAppState } from '@/session';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { SIZES } from '@/theme/tokens';

export type TickerProps = {
  /**
   * 시트 위로 띄우는 높이. 데모 `bottom: calc(var(--sheet-h) + 20px)`.
   *
   * 좁은 화면에서는 호출부(`app/index.tsx`)가 이 값을 키워 제보·줌 버튼 행
   * 위로 올린다 — 데모의 데스크톱 폭에서는 겹치지 않던 문구가 휴대폰에서는
   * 가려지기 때문이다.
   */
  readonly bottom: number;
};

export function Ticker({ bottom }: TickerProps) {
  const index = useAppState((state) => state.tickerIndex);
  const textVisible = useAppState((state) => state.tickerVisible);
  const selected = useAppState((state) => state.selectedSpotId);
  const message = TICKER_MESSAGES[index % TICKER_MESSAGES.length];
  const themed = useThemedStyles();

  // 데모는 상세가 열리면 티커 전체를 opacity 0 으로 감춘다(`#ticker`),
  // 문구 교체 때는 문장만 감춘다(`#tickerLine`). 두 층을 그대로 나눈다.
  return (
    <View
      style={[styles.ticker, { bottom, opacity: selected === null ? 1 : 0 }]}
      dataSet={{ mv: 'ticker' }}
    >
      <View style={styles.head}>
        <View style={[styles.dot, themed.dot]} dataSet={{ mv: 'live-dot' }} />
        <Text style={[styles.headText, themed.headText]}>{TICKER_HEADER}</Text>
      </View>
      <Text
        style={[styles.line, themed.line, { opacity: textVisible ? 1 : 0 }]}
        dataSet={{ mv: 'ticker-line' }}
      >
        {message?.headline ?? ''}
        <Text style={[styles.badge, themed.badge]}>{`  ${message?.badge ?? ''}`}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ticker: {
    position: 'absolute',
    left: SIZES.gutter,
    width: 300,
    // 데모 `.ticker{pointer-events:none}` — 티커 위에서도 지도를 끌 수 있다.
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

/** 티커는 시트가 아니라 지도 위에 놓인다 — 지도 명도를 따르는 map* 토큰을 쓴다. */
const useThemedStyles = createThemedStyles((theme) => ({
  dot: { backgroundColor: theme.colors.live },
  headText: { color: theme.colors.liveText },
  line: { color: theme.colors.mapFg },
  badge: { color: theme.colors.mapFg2 },
}));
