/**
 * 시간 트랙 — 9개 정시 눌림 눈금 + ‹ › (F4 결정 (b)).
 *
 * 연속 슬라이더가 아니다. 데이터가 정시 9개뿐이라 연속값이 의미가 없고, 세 플랫폼
 * 공통 슬라이더 모듈을 하나 더 들이지 않는다. 눈금은 core 의 `SHADE_HOURS` 그대로 —
 * 인덱스가 `shadeByHour`·`shadow-<HH>` 파일과 같은 축이다.
 *
 * 자리: 컨트롤 열 왼쪽, 시트 바로 위(`bottomRow` 와 같은 높이 규칙). 데스크톱 컬럼
 * (560px)에서는 제보 버튼과 같은 행에 놓여도 겹치지 않고, 컬럼이 그보다 좁은 화면에서는
 * 티커 규칙처럼 컨트롤 행 **위**로 올라간다(`narrow`). 그 행에는 "계곡으로" 원형 버튼이
 * 있으므로 오른쪽은 그 버튼 폭만큼 비우고, 우측 `HH:00` 은 뺀다 — 굵은 현재 눈금이 이미
 * 시각을 말하고, 9개 눈금이 남은 폭(폰에서 ~270px)을 나눠 써야 한다.
 *
 * 그늘이 켜진 동안만 보인다. 상태는 `MapSession.setShadeHour` 로만 바꾼다.
 */
import { clampShadeHourIndex, SHADE_HOUR_COUNT, SHADE_HOURS } from '@modu-valley/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppState, useSession } from '@/session';
import { VALLEY_COPY } from '@/theme/copy';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII, SIZES } from '@/theme/tokens';

export type ShadeHourTrackProps = {
  /** 시트 위로 띄우는 높이. 컨트롤 열과 같은 값이거나, 좁은 화면에서는 그 행 위. */
  readonly bottom: number;
  /** 컬럼이 데스크톱 폭(`SIZES.column`)보다 좁다 — 컬럼 폭을 다 쓰고 눈금이 늘어난다. */
  readonly narrow: boolean;
};

const HOUR_TICKS = SHADE_HOURS.map((hour) => hour.slice(0, 2));

export function ShadeHourTrack({ bottom, narrow }: ShadeHourTrackProps) {
  const session = useSession();
  const visible = useAppState((state) => state.shadeVisible);
  const hour = useAppState((state) => state.shadeHourIndex);
  const themed = useThemedStyles();
  const copy = VALLEY_COPY.shadeTrack;

  if (!visible) return null;

  const atStart = hour === 0;
  const atEnd = hour === SHADE_HOUR_COUNT - 1;
  const step = (delta: number): void => {
    session.setShadeHour(clampShadeHourIndex(hour + delta));
  };

  return (
    <View
      style={[styles.pill, themed.pill, { bottom }, narrow ? styles.pillNarrow : null]}
      dataSet={{ mv: 'ctrl' }}
      accessibilityRole="toolbar"
      accessibilityLabel={copy.label}
    >
      <Pressable
        style={[styles.arrow, atStart ? styles.arrowDisabled : null]}
        accessibilityRole="button"
        accessibilityLabel={copy.previous}
        accessibilityState={{ disabled: atStart }}
        disabled={atStart}
        onPress={() => step(-1)}
      >
        <Text style={[styles.arrowText, themed.arrowText]}>‹</Text>
      </Pressable>

      <View style={[styles.ticks, narrow ? styles.ticksNarrow : null]}>
        {HOUR_TICKS.map((tick, index) => {
          const active = index === hour;
          return (
            <Pressable
              key={tick}
              style={[styles.tick, narrow ? styles.tickNarrow : null]}
              accessibilityRole="button"
              accessibilityLabel={copy.hour(tick)}
              accessibilityState={{ selected: active }}
              onPress={() => session.setShadeHour(clampShadeHourIndex(index))}
            >
              <View style={[styles.tickDot, active ? themed.tickDotOn : themed.tickDot]} />
              <Text
                style={[
                  styles.tickLabel,
                  active ? [styles.tickLabelOn, themed.tickLabelOn] : themed.tickLabel,
                ]}
              >
                {tick}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.arrow, atEnd ? styles.arrowDisabled : null]}
        accessibilityRole="button"
        accessibilityLabel={copy.next}
        accessibilityState={{ disabled: atEnd }}
        disabled={atEnd}
        onPress={() => step(1)}
      >
        <Text style={[styles.arrowText, themed.arrowText]}>›</Text>
      </Pressable>

      {narrow ? null : <Text style={[styles.time, themed.time]}>{SHADE_HOURS[hour]}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: SIZES.gutter,
    height: SIZES.reportHeight,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
    // 컬럼의 `box-none` 을 되살린다 — 트랙 위에서는 지도가 아니라 눈금이 눌린다.
    pointerEvents: 'auto',
  },
  /** 좁은 화면: 같은 행의 원형 컨트롤("계곡으로")을 피해 그 왼쪽까지만 채우고, 눈금이 남은 폭을 나눠 쓴다. */
  pillNarrow: {
    right: SIZES.gutter + SIZES.controlSize + 8,
    paddingHorizontal: 4,
  },
  arrow: {
    width: 28,
    height: SIZES.reportHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    opacity: 0.35,
  },
  arrowText: {
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '500',
  },
  ticks: {
    flexDirection: 'row',
    gap: 2,
  },
  ticksNarrow: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 0,
  },
  tick: {
    width: 26,
    height: SIZES.reportHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tickNarrow: {
    width: 'auto',
    flex: 1,
  },
  tickDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tickLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '500',
  },
  tickLabelOn: {
    fontWeight: '700',
  },
  time: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 6,
    minWidth: 40,
    textAlign: 'right',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  pill: { backgroundColor: theme.colors.bg },
  arrowText: { color: theme.colors.fg2 },
  tickDot: { backgroundColor: theme.colors.line2 },
  tickDotOn: { backgroundColor: theme.colors.accent },
  tickLabel: { color: theme.colors.fg3 },
  tickLabelOn: { color: theme.colors.fg },
  time: { color: theme.colors.fg },
}));
