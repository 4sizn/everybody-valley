/**
 * 상세 면의 정보 타일 — 라벨 + 값 한 칸. 2×2 격자로 놓인다.
 *
 * 명당의 `festival/InfoCard` 와 같은 표면(테두리·반경 8·패딩 12)이지만 아이콘이
 * 없다. 명당 아이콘 5종은 명당 정보 종류에 묶여 있고, 계곡 아이콘 심볼은 C5 가
 * 가져온다 — 그때 이 컴포넌트에 아이콘 자리만 열면 된다.
 */
import { Animated, StyleSheet, Text } from 'react-native';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';

export type InfoTileProps = {
  readonly label: string;
  readonly value: string;
  /** 칸 폭. `(innerWidth - 8) / 2`. */
  readonly width: number;
  readonly staggerIndex: number;
  readonly generation: number;
  /** 값이 아직 없는 자리(그늘 등) — 점선 테두리, 흐린 글자. */
  readonly pending?: boolean;
};

export function InfoTile({
  label,
  value,
  width,
  staggerIndex,
  generation,
  pending,
}: InfoTileProps) {
  const entrance = useStaggerEntrance(staggerIndex, generation);
  const themed = useThemedStyles();

  return (
    <Animated.View
      style={[
        styles.tile,
        themed.tile,
        pending === true ? styles.tilePending : null,
        { width },
        entrance,
      ]}
    >
      <Text style={[styles.label, themed.label]}>{label}</Text>
      <Text style={[styles.value, pending === true ? themed.valuePending : themed.value]}>
        {value}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 1,
    borderRadius: RADII.info,
    padding: 12,
  },
  tilePending: {
    borderStyle: 'dashed',
  },
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  value: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  tile: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line },
  label: { color: theme.colors.fg3 },
  value: { color: theme.colors.fg },
  valuePending: { color: theme.colors.fg3 },
}));
