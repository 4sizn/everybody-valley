/**
 * 상세 패널의 정보 카드 한 칸. 데모의 `.icard`.
 */
import type { SpotInfoRow } from '@modu-valley/core';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { InfoRowIcon } from '@/icons/InfoRowIcon';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';

export type InfoCardProps = {
  readonly row: SpotInfoRow;
  /** 칸 폭. 데모의 `.grid2{grid-template-columns:1fr 1fr}` 에 대응. */
  readonly width: number;
  readonly staggerIndex: number;
  readonly generation: number;
};

export function InfoCard({ row, width, staggerIndex, generation }: InfoCardProps) {
  const entrance = useStaggerEntrance(staggerIndex, generation);
  const themed = useThemedStyles();

  return (
    <Animated.View style={[styles.card, themed.card, { width }, entrance]}>
      <View style={styles.labelRow}>
        <InfoRowIcon kind={row.kind} />
        <Text style={[styles.label, themed.label]}>{row.label}</Text>
      </View>
      <Text style={[styles.value, themed.value]}>{row.value}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADII.info,
    padding: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '500',
  },
  value: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line },
  label: { color: theme.colors.fg3 },
  value: { color: theme.colors.fg },
}));
