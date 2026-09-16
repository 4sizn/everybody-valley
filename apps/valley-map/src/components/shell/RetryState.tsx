/**
 * 전면 재시도 화면 — 지도 **스타일 자체**를 못 받아 세션 초기화가 `failed` 로 끝났을 때(C7).
 *
 * 타일 몇 장이 빠지는 것은 배너(`ShellBanner`)로 충분하지만, 스타일이 없으면 지도가 아예 없다.
 * 그래서 화면 전체를 덮고 하나만 묻는다 — 다시 시도할 것인가. 재시도는 소스 reload 가 아니라
 * **세션 재생성**이다(`useSessionRestart`): 엔진이 스타일 fetch 부터 다시 한다. 테마를 바꿀 때
 * 세션이 다시 만들어지는 경로와 같다(C9 결정 (d)).
 *
 * 세션 상태가 `failed` 가 아니면 아무것도 그리지 않는다. 색은 토큰만(`bg`·`surface`·`fg`·`fg2`·`accent`).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppState, useSessionRestart } from '@/session';
import { BASEMAP_HEALTH_COPY } from '@/theme/copy';
import { ABSOLUTE_FILL } from '@/theme/layout';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';

export function RetryState() {
  const status = useAppState((state) => state.status);
  const errorCode = useAppState((state) => state.lastError?.code ?? null);
  const restart = useSessionRestart();
  const themed = useThemedStyles();

  if (status !== 'failed') return null;

  return (
    <View style={[styles.backdrop, themed.backdrop]} dataSet={{ mv: 'retry-state' }}>
      <View style={[styles.card, themed.card]}>
        <Text style={[styles.title, themed.title]} accessibilityRole="header">
          {BASEMAP_HEALTH_COPY.styleFailedTitle}
        </Text>
        <Text style={[styles.note, themed.note]}>{BASEMAP_HEALTH_COPY.styleFailedNote}</Text>
        {errorCode === null ? null : <Text style={[styles.code, themed.code]}>{errorCode}</Text>}
        <Pressable
          style={[styles.retry, themed.retry]}
          dataSet={{ mv: 'retry-state-button' }}
          accessibilityRole="button"
          accessibilityLabel={BASEMAP_HEALTH_COPY.retry}
          onPress={restart}
        >
          <Text style={styles.retryLabel}>{BASEMAP_HEALTH_COPY.retry}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...ABSOLUTE_FILL,
    // 내비(7) 위 — 지도가 없으니 나머지 셸도 뜻이 없다.
    zIndex: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    borderRadius: RADII.card,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  note: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  code: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
  },
  retry: {
    marginTop: 12,
    height: 40,
    paddingHorizontal: 24,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  backdrop: { backgroundColor: theme.colors.bg },
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line },
  title: { color: theme.colors.fg },
  note: { color: theme.colors.fg2 },
  code: { color: theme.colors.fg3 },
  retry: { backgroundColor: theme.colors.accent },
}));
