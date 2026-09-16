/**
 * 배치 전환 세그먼트 (행 / 타일). 데모의 `.segbar`.
 *
 * 누르는 순서가 중요하다.
 *   1) `capture()` — 배치가 바뀌기 **전** 항목 위치를 잰다 (FLIP 의 First)
 *   2) 상태 변경 — 유즈케이스가 배치를 바꾸고 영속화한다
 *   3) `play()`   — 커밋 직후 목록 쪽에서 호출한다 (Last/Invert/Play)
 * 3번은 목록 컴포넌트의 `useLayoutEffect` 가 맡는다.
 */
import { SPOT_LAYOUTS, type SpotLayout } from '@modu-valley/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { RowsIcon, TilesIcon } from '@/icons';
import { FESTIVAL_COPY } from '@/theme/copy';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { RADII } from '@/theme/tokens';

const ICONS: Readonly<Record<SpotLayout, (props: { color: string }) => React.ReactElement>> = {
  rows: ({ color }) => <RowsIcon color={color} />,
  tiles: ({ color }) => <TilesIcon color={color} />,
};

const LABELS: Readonly<Record<SpotLayout, string>> = {
  rows: FESTIVAL_COPY.controlTitles.rows,
  tiles: FESTIVAL_COPY.controlTitles.tiles,
};

export type LayoutSegmentsProps = {
  readonly value: SpotLayout;
  readonly onSelect: (layout: SpotLayout) => void;
};

export function LayoutSegments({ value, onSelect }: LayoutSegmentsProps) {
  const theme = useTheme();
  const themed = useThemedStyles();
  return (
    <View style={[styles.bar, themed.bar]}>
      {SPOT_LAYOUTS.map((layout) => {
        const isActive = layout === value;
        const Icon = ICONS[layout];
        return (
          <Pressable
            key={layout}
            style={[styles.segment, isActive ? themed.segmentActive : null]}
            dataSet={{ mv: 'seg', act: isActive }}
            accessibilityLabel={LABELS[layout]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(layout)}
          >
            <Icon color={isActive ? theme.colors.fg : theme.colors.fg3} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 2,
    padding: 2,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  segment: {
    width: 30,
    height: 26,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  bar: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line },
  segmentActive: { backgroundColor: theme.colors.segActive },
}));
