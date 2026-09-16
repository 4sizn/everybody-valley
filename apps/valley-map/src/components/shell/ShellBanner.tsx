/**
 * 셸 배너 — 상단바 아래 띠 하나(C7 결정 (c)).
 *
 * 이 자리에 올 수 있는 것은 둘이고 한 번에 하나만 보인다.
 *   경보(F3b, 상류 강우·수위)  >  베이스맵 헬스(타일을 못 받고 있음)
 * 우선순위는 `pickBanner` 가 정한다. 경보 배너는 `warning` 이상일 때만, **계곡 장면에서만**
 * 뜬다(`/firework` 는 계곡 데이터를 모른다 — 다크 픽셀 파리티가 이 위에 서 있다, CLAUDE.md).
 * 여러 계곡이 동시에 경보라면 `worstActiveAlert` 가 가장 급한 것(등급 → 발령 시각)을 고른다.
 *
 * 헬스 배너는 `AppState.baseMapHealth.outage` 가 참일 때만 그린다. 정상이면 **아무것도
 * 렌더하지 않는다** — `/firework` 다크 파리티(픽셀 diff 0)가 그 위에 서 있다(결정 (d)).
 * "다시 시도" 는 세션 `retryBaseMap`(엔진 소스 reload). 스타일 자체가 실패한 경우는 배너가
 * 아니라 전면 `RetryState` 다.
 *
 * 경보 배너 색은 `ALERT_LEVEL_COLORS`(F3b, 두 테마 같은 지시등) — 헬스 배너는 그대로 토큰만.
 */
import { type AlertLevel, alertLevelLabel } from '@modu-valley/core';
import { ALERT_LEVEL_COLORS } from '@modu-valley/map-style';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppState, useSession } from '@/session';
import { BASEMAP_HEALTH_COPY, VALLEY_COPY } from '@/theme/copy';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII, SIZES } from '@/theme/tokens';
import { pickBanner, type ShellBannerItem, worstActiveAlert } from './shellBannerLogic';

export type { ShellBannerItem } from './shellBannerLogic';
export { pickBanner, worstActiveAlert } from './shellBannerLogic';

const ALERT_BANNER_INSTRUCTION: Readonly<Record<AlertLevel, string>> = {
  watch: VALLEY_COPY.alertBanner.watch,
  warning: VALLEY_COPY.alertBanner.warning,
  evacuate: VALLEY_COPY.alertBanner.evacuate,
};

/** 상단바 아래 간격. 상단바(48) 와 같은 리듬의 8px. */
const BANNER_GAP = 8;

export function ShellBanner() {
  const session = useSession();
  const outage = useAppState((state) => state.baseMapHealth.outage);
  const alerts = useAppState((state) => state.alerts);
  const valleys = useAppState((state) => state.valleys);
  const insets = useSafeAreaGutters();
  const themed = useThemedStyles();

  const worst = session.scene === 'valley' ? worstActiveAlert(alerts) : null;
  const alertItem: ShellBannerItem | null =
    worst === null
      ? null
      : {
          kind: 'alert',
          level: worst.alert.level,
          message: VALLEY_COPY.alertBanner.message(
            valleys?.find((v) => v.id === worst.valleyId)?.name ?? worst.valleyId,
            alertLevelLabel(worst.alert.level),
            ALERT_BANNER_INSTRUCTION[worst.alert.level],
          ),
        };
  const banner = pickBanner(alertItem, outage);
  if (banner === null) return null;

  const top = insets.top + SIZES.gutter + SIZES.topbarHeight + BANNER_GAP;
  const alertColor = banner.kind === 'alert' ? ALERT_LEVEL_COLORS[banner.level] : null;
  return (
    <View
      style={[
        styles.banner,
        themed.banner,
        alertColor === null ? null : { borderColor: alertColor },
        { top },
      ]}
      dataSet={{
        mv: 'shell-banner',
        kind: banner.kind,
        level: banner.kind === 'alert' ? banner.level : undefined,
      }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[
          styles.message,
          themed.message,
          alertColor === null ? null : { color: alertColor, fontWeight: '700' },
        ]}
        numberOfLines={2}
      >
        {banner.kind === 'health' ? BASEMAP_HEALTH_COPY.outage : banner.message}
      </Text>
      {banner.kind === 'health' ? (
        <Pressable
          style={[styles.retry, themed.retry]}
          dataSet={{ mv: 'shell-banner-retry' }}
          accessibilityRole="button"
          accessibilityLabel={BASEMAP_HEALTH_COPY.retry}
          onPress={() => void session.retryBaseMap()}
        >
          <Text style={styles.retryLabel}>{BASEMAP_HEALTH_COPY.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: SIZES.gutter,
    right: SIZES.gutter,
    // 상단바(6) 와 같은 층 — 시트(5) 위, 내비(7) 아래.
    zIndex: 6,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  message: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  retry: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** accent 위의 흰 글자 — CTA 와 같고 두 테마가 같다. */
  retryLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  banner: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line },
  message: { color: theme.colors.fg },
  retry: { backgroundColor: theme.colors.accent },
}));
