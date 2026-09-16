/**
 * 알약형 공유 컴포넌트(DS3, 분석 2026-09-08 — `docs/TODO.md` "DS3" 절).
 *
 * 알약형은 **2단계뿐**이다 — `badge`(읽는 것, 상태) · `chip`(누르는 것, 조작). 여덟 곳이
 * 각자 `StyleSheet` 를 갖고 눈대중 값을 넣던 것(좌우패딩 5가지·테두리 2가지·높이 두 갈래)을
 * 여기 한 벌로 모은다. 크기·패딩·테두리·gap 은 `theme/tokens.ts` 의 `PILL` 을 그대로 쓴다 —
 * **색은 인자로 받는다**(경보·그늘·유형색처럼 의미가 있는 색은 호출부가 안다).
 *
 * 경보·그늘 배지(F3b·N5)는 색이 뜻인 자리라 굵기 700 을 유지한다(DS1 범위, 색·채움은
 * 그대로) — `weight` 로 규격의 600 을 덮어쓴다.
 */
import type { ReactNode } from 'react';
import {
  type AccessibilityRole,
  type AccessibilityState,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { FONT_FAMILY } from '@/theme/theme';
import { PILL, RADII } from '@/theme/tokens';

export type BadgeProps = {
  readonly label: string;
  /** 라벨 앞 아이콘(제보 유형 글리프 등). 없으면 텍스트만 그린다. */
  readonly icon?: ReactNode;
  readonly textColor: string;
  readonly borderColor: string;
  /** 색이 뜻인 배지(경보·그늘)만 700 을 넘긴다. 기본은 규격의 600. */
  readonly weight?: TextStyle['fontWeight'] | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
  readonly dataSet?: Record<string, string> | undefined;
};

/** `badge` 단계 — 읽는 것(상태). 11 · 600 · 좌우 8 · 상하 3 · 높이 내용 · 테두리 1 · gap 4. */
export function Badge({ label, icon, textColor, borderColor, weight, style, dataSet }: BadgeProps) {
  return (
    <View
      style={[styles.badge, { borderColor }, style]}
      {...(dataSet === undefined ? null : { dataSet })}
    >
      {icon}
      <Text
        style={[
          styles.badgeText,
          { color: textColor },
          weight === undefined ? null : { fontWeight: weight },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export type ChipProps = {
  readonly children: ReactNode;
  readonly borderColor?: string | undefined;
  readonly backgroundColor?: string | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
  readonly onPress?: ((event: GestureResponderEvent) => void) | undefined;
  readonly onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly accessibilityRole?: AccessibilityRole | undefined;
  readonly accessibilityLabel?: string | undefined;
  readonly accessibilityState?: AccessibilityState | undefined;
  readonly dataSet?: Record<string, string> | undefined;
};

/**
 * `chip` 단계 — 누르는 것(조작). 13 · 600 · 좌우 12 · 높이 32 고정 · 테두리 1 · gap 7.
 * 내용(아이콘·라벨·구분선)은 호출부가 채운다 — 칩마다 내용 구성이 달라서다
 * (`FilterChipRow` 는 라벨+개수, `ReportTypeChipRow` 는 아이콘+라벨).
 */
export function Chip({
  children,
  borderColor,
  backgroundColor,
  style,
  dataSet,
  ...pressableProps
}: ChipProps) {
  return (
    <Pressable
      style={[
        styles.chip,
        borderColor === undefined ? null : { borderColor },
        backgroundColor === undefined ? null : { backgroundColor },
        style,
      ]}
      {...(dataSet === undefined ? null : { dataSet })}
      {...pressableProps}
    >
      {children}
    </Pressable>
  );
}

/** `chip` 라벨 공통 타이포 — 색만 호출부가 얹는다. */
export const chipLabelStyle: TextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: PILL.chip.fontSize,
  fontWeight: PILL.chip.fontWeight,
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PILL.badge.gap,
    borderWidth: PILL.badge.borderWidth,
    borderRadius: RADII.pill,
    paddingHorizontal: PILL.badge.paddingHorizontal,
    paddingVertical: PILL.badge.paddingVertical,
  },
  badgeText: {
    fontFamily: FONT_FAMILY,
    fontSize: PILL.badge.fontSize,
    fontWeight: PILL.badge.fontWeight,
  },
  chip: {
    flexDirection: 'row',
    // 내용을 **가운데**로 맞춘다 — `baseline` 은 개수 같은 계량값을 라벨의 꼬리처럼 붙여
    // "화장실 19" 가 한 낱말로 읽혔다(`FilterChipRow`, 2026-09-08 사용자 지적).
    alignItems: 'center',
    gap: PILL.chip.gap,
    height: PILL.chip.height,
    paddingHorizontal: PILL.chip.paddingHorizontal,
    borderWidth: PILL.chip.borderWidth,
    borderRadius: RADII.pill,
  },
});
